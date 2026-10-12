"""Persist only a securely aggregated model and post-processed private metrics."""

import hashlib
import json
import math
import os
from pathlib import Path


def _accuracy(correct, count):
    if not math.isfinite(correct) or not math.isfinite(count) or count <= 0:
        return None
    return max(0.0, min(1.0, correct / count))


def aggregate_artifact(vector, schema, run_id, round_number):
    width = len(schema['feature_names'])
    if len(vector) != width + 4 or any(not math.isfinite(float(value)) for value in vector):
        raise ValueError('secure aggregate has invalid dimensions or non-finite values')
    weights = [float(value) for value in vector[:width]]
    return {
        'runId': str(run_id), 'round': round_number, 'algorithm': 'FedAvg',
        'featureNames': schema['feature_names'], 'labels': schema['labels'],
        'weights': weights,
        'validation': {'accuracy': _accuracy(float(vector[width]), float(vector[width + 1]))},
        'test': {'accuracy': _accuracy(float(vector[width + 2]), float(vector[width + 3]))},
        'metricRelease': 'patient-level Gaussian counts, SecAgg+ cohort aggregate',
        'schemaSha256': schema['sha256'],
    }


def public_schema_metadata(schema_text, names, labels):
    return {'feature_names': names, 'labels': labels,
            'sha256': hashlib.sha256(schema_text.encode()).hexdigest()}


def save_aggregate(artifact):
    body = json.dumps(artifact, separators=(',', ':'), allow_nan=False).encode()
    key = f"secure-aggregates/{artifact['runId']}/round-{artifact['round']}.json"
    bucket = os.environ.get('FL_MODEL_BUCKET')
    if bucket:
        import boto3
        boto3.client('s3').put_object(Bucket=bucket, Key=key, Body=body,
            ContentType='application/json', ServerSideEncryption='aws:kms')
        return f's3://{bucket}/{key}'
    directory = os.environ.get('FL_AGGREGATE_OUTPUT_DIR')
    if not directory:
        raise RuntimeError('FL_MODEL_BUCKET or FL_AGGREGATE_OUTPUT_DIR is required')
    target = Path(directory) / key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    return str(target)
