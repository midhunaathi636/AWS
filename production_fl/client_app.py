"""Organization-owned Flower client. SecAgg+ masks all model parameters."""

import json
import hashlib
import os
from pathlib import Path

import numpy as np
from flwr.client import ClientApp, NumPyClient
from flwr.client.mod import secaggplus_mod
from flwr.common import Context

from ml_service.private_training import feature_names, prepare_patients, private_train_round, private_metric_counts
from ml_service.privacy_budget import consume_budget


class PrivateClient(NumPyClient):
    def __init__(self, context):
        self.context = context
        schema_text = Path(os.environ['FL_PUBLIC_SCHEMA_PATH']).read_text()
        self.schema = json.loads(schema_text)
        self.schema_hash = hashlib.sha256(schema_text.encode()).hexdigest()
        self.splits = prepare_patients(Path(os.environ['FL_CSV_PATH']).read_text(), self.schema,
                                       int(context.run_config['split-seed']))
        self.groups = self.splits['train']
        self.width = len(feature_names(self.schema))
        self.dataset_id = os.environ['FL_DATASET_ID']
        self.budget_table = os.environ['FL_PRIVACY_TABLE']
        if not self.groups:
            raise ValueError('this organization has no patients in its training split')

    def get_parameters(self, config):
        return [np.zeros(self.width + 4, dtype=np.float64)]

    def fit(self, parameters, config):
        if len(parameters) != 1 or len(parameters[0]) != self.width + 4:
            raise ValueError('the coordinator model does not match the public schema')
        if config.get('schema_sha256') != self.schema_hash:
            raise ValueError('organization schema does not match the public federation schema')
        round_number = int(config['round'])
        if round_number < 1:
            raise ValueError('round must be positive')
        epochs = int(self.context.run_config['local-epochs'])
        multiplier = float(self.context.run_config['noise-multiplier'])
        metric_multiplier = float(self.context.run_config['metric-noise-multiplier'])
        planned_rho = epochs / (2 * multiplier ** 2) + 2 / metric_multiplier ** 2
        # A duplicate invocation cannot obtain a second output for the same run/round.
        consume_budget(self.budget_table, self.dataset_id,
                       f'{self.context.run_id}:{round_number}:{self.dataset_id}', planned_rho)
        result = private_train_round(
            self.groups, parameters[0][:self.width].astype(float).tolist(), epochs=epochs,
            learning_rate=float(self.context.run_config['learning-rate']),
            clipping_norm=float(self.context.run_config['clipping-norm']),
            noise_multiplier=multiplier,
            normalization_count=int(self.context.run_config['normalization-count']),
        )
        weights = parameters[0][:self.width] + np.asarray(result['delta'], dtype=np.float64)
        normalization_count = int(self.context.run_config['normalization-count'])
        validation = private_metric_counts(self.splits['validation'], weights,
            noise_multiplier=metric_multiplier, normalization_count=normalization_count)
        test = private_metric_counts(self.splits['test'], weights,
            noise_multiplier=metric_multiplier, normalization_count=normalization_count)
        aggregate_vector = np.concatenate((weights, validation['coordinates'], test['coordinates']))
        # Fixed public weight: a private patient count must never reach the coordinator.
        return [aggregate_vector], 1, {}

    def evaluate(self, parameters, config):
        raise RuntimeError('individual evaluation is disabled; use a separately budgeted aggregate release')


def client_fn(context: Context):
    return PrivateClient(context).to_client()


app = ClientApp(client_fn=client_fn, mods=[secaggplus_mod])
