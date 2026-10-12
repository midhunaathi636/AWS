"""Start the persistent, TLS-authenticated Flower coordinator."""

import json
import os
import subprocess
import tempfile
from pathlib import Path

import boto3


def main():
    secret_arn = os.environ['FL_SUPERLINK_TLS_SECRET_ARN']
    bundle = json.loads(boto3.client('secretsmanager').get_secret_value(
        SecretId=secret_arn)['SecretString'])
    with tempfile.TemporaryDirectory(prefix='flower-tls-') as directory:
        paths = {}
        for field in ('ca', 'cert', 'key'):
            if not isinstance(bundle.get(field), str) or not bundle[field].strip():
                raise ValueError(f'SuperLink TLS secret lacks {field}')
            path = Path(directory) / f'{field}.pem'
            path.write_text(bundle[field])
            path.chmod(0o600)
            paths[field] = str(path)
        database = Path(os.environ.get('FL_SUPERLINK_DATABASE', '/state/state.db'))
        database.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            'flower-superlink', '--host', '0.0.0.0', '--port', '8000',
            '--ssl-ca-certfile', paths['ca'], '--ssl-certfile', paths['cert'],
            '--ssl-keyfile', paths['key'], '--enable-supernode-auth',
            '--disable-runtime-dependency-installation',
            '--database', str(database),
        ], check=True)


if __name__ == '__main__':
    main()
