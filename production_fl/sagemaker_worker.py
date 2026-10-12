"""SageMaker entrypoint for an authenticated, private Flower SuperNode."""

import os
import subprocess
import tempfile
from pathlib import Path

import boto3


def _secret_file(client, arn, destination):
    value = client.get_secret_value(SecretId=arn)
    data = value.get('SecretString')
    if data is None:
        data = value['SecretBinary']
    path = Path(destination)
    path.write_bytes(data.encode() if isinstance(data, str) else data)
    path.chmod(0o600)
    return str(path)


def main():
    required = ('FL_SUPERLINK_ADDRESS', 'FL_CA_SECRET_ARN', 'FL_NODE_KEY_SECRET_ARN',
                'FL_DATASET_ID', 'FL_PRIVACY_TABLE')
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f'missing required worker configuration: {", ".join(missing)}')
    os.environ.setdefault('FL_CSV_PATH', '/opt/ml/input/data/training/data.csv')
    os.environ.setdefault('FL_PUBLIC_SCHEMA_PATH', '/opt/ml/input/data/schema/schema.json')
    if not Path(os.environ['FL_CSV_PATH']).is_file() or not Path(os.environ['FL_PUBLIC_SCHEMA_PATH']).is_file():
        raise RuntimeError('the organization-owned dataset and public schema channels are required')
    with tempfile.TemporaryDirectory(prefix='flower-credentials-') as directory:
        secrets = boto3.client('secretsmanager')
        ca = _secret_file(secrets, os.environ['FL_CA_SECRET_ARN'], f'{directory}/ca.pem')
        key = _secret_file(secrets, os.environ['FL_NODE_KEY_SECRET_ARN'], f'{directory}/node.key')
        command = ['flower-supernode', '--superlink', os.environ['FL_SUPERLINK_ADDRESS'],
                   '--root-certificates', ca, '--auth-supernode-private-key', key,
                   '--host', '127.0.0.1', '--port', '9094']
        subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
