"""Coordinator that can observe aggregate parameters only."""

import json
import os
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
from flwr.common import Context, ndarrays_to_parameters
from flwr.server import Grid, LegacyContext, ServerApp, ServerConfig
from flwr.server.strategy import FedAvg
from flwr.server.workflow import DefaultWorkflow, SecAggPlusWorkflow
from flwr.server.workflow.constant import MAIN_CONFIGS_RECORD, MAIN_PARAMS_RECORD, Key

from ml_service.private_training import feature_names
from production_fl.aggregate_store import aggregate_artifact, public_schema_metadata, save_aggregate


app = ServerApp()


def load_public_schema(context):
    uri = context.run_config.get('schema-s3-uri')
    if uri:
        parsed = urlparse(uri)
        if parsed.scheme != 's3' or not parsed.netloc or not parsed.path.strip('/'):
            raise ValueError('schema-s3-uri must be an S3 object URI')
        import boto3
        return boto3.client('s3').get_object(Bucket=parsed.netloc,
            Key=parsed.path.lstrip('/'))['Body'].read().decode()
    return Path(os.environ['FL_PUBLIC_SCHEMA_PATH']).read_text()


class PersistingSecureRound:
    def __init__(self, workflow, schema_metadata):
        self.workflow = workflow
        self.schema_metadata = schema_metadata

    def __call__(self, grid, context):
        before = context.state.array_records[MAIN_PARAMS_RECORD].to_numpy_ndarrays()[0].copy()
        self.workflow(grid, context)
        vector = context.state.array_records[MAIN_PARAMS_RECORD].to_numpy_ndarrays()[0]
        if np.array_equal(before, vector):
            raise RuntimeError('secure aggregation did not produce a new cohort model')
        round_number = int(context.state.config_records[MAIN_CONFIGS_RECORD][Key.CURRENT_ROUND])
        artifact = aggregate_artifact(vector, self.schema_metadata, context.run_id, round_number)
        save_aggregate(artifact)


@app.main()
def main(grid: Grid, context: Context):
    schema_text = load_public_schema(context)
    schema = json.loads(schema_text)
    names = feature_names(schema)
    width = len(names)
    min_clients = int(context.run_config['min-clients'])
    if min_clients < 3:
        raise ValueError('secure production rounds require at least three active organizations')
    schema_metadata = public_schema_metadata(schema_text, names, schema['labels'])
    strategy = FedAvg(
        fraction_fit=1.0, min_fit_clients=min_clients,
        min_available_clients=min_clients, fraction_evaluate=0.0,
        accept_failures=False,
        on_fit_config_fn=lambda round_number: {'round': round_number,
                                               'schema_sha256': schema_metadata['sha256']},
        initial_parameters=ndarrays_to_parameters([np.zeros(width + 4, dtype=np.float64)]),
    )
    legacy = LegacyContext(
        context=context, strategy=strategy,
        config=ServerConfig(num_rounds=int(context.run_config['num-server-rounds'])),
    )
    secure_round = SecAggPlusWorkflow(
        num_shares=min_clients, reconstruction_threshold=min_clients,
        max_weight=1, clipping_range=float(context.run_config['model-clipping-range']),
        timeout=float(context.run_config['round-timeout-seconds']),
    )
    workflow = DefaultWorkflow(fit_workflow=PersistingSecureRound(secure_round, schema_metadata))
    workflow(grid, legacy)
