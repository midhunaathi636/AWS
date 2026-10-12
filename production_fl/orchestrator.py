"""Run one approved remote experiment from the coordinator account.

This task starts organization-owned SageMaker nodes, submits a Flower SecAgg+
run, waits for completion, then stores only cohort aggregates in PostgreSQL.
"""

import hashlib
import json
import math
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import boto3

from production_fl.simple_pdf import create_report
from ml_service.private_training import epsilon_for_rho


def _invoke(arn, action, experiment_id, dataset_id):
    response = boto3.client('lambda').invoke(FunctionName=arn, InvocationType='RequestResponse',
        Payload=json.dumps({'action': action, 'experimentId': experiment_id,
                            'datasetId': dataset_id}).encode())
    payload = json.loads(response['Payload'].read())
    if response.get('FunctionError'):
        raise RuntimeError(f'organization worker {action} failed')
    return payload


def _flwr(project_dir, *args):
    environment = os.environ.copy()
    environment['FLWR_HOME'] = str(Path(project_dir) / '.flwr')
    result = subprocess.run(['flwr', *args], cwd=project_dir, capture_output=True,
                            text=True, timeout=120, check=True, env=environment)
    data = json.loads(result.stdout)
    if data.get('success') is False:
        raise RuntimeError(data.get('error-message', 'Flower command failed'))
    return data


def _profile(directory, address, certificate):
    source = Path(__file__).resolve().parents[1]
    for name in ('production_fl', 'ml_service'):
        shutil.copytree(source / name, directory / name, ignore=shutil.ignore_patterns('__pycache__'))
    (directory / 'pyproject.toml').write_text((source / 'pyproject.toml').read_text())
    flower_home = directory / '.flwr'
    flower_home.mkdir(mode=0o700)
    (flower_home / 'config.toml').write_text(
        '[superlink.production]\n'
        f'address = {json.dumps(address)}\n'
        f'root-certificates = {json.dumps(str(certificate))}\n')


def stop_flower_run(run_id):
    with tempfile.TemporaryDirectory(prefix='fl-cancel-') as temporary:
        directory = Path(temporary)
        ca = boto3.client('secretsmanager').get_secret_value(
            SecretId=os.environ['FL_CONTROL_CA_SECRET_ARN'])['SecretString']
        certificate = directory / 'ca.pem'
        certificate.write_text(ca)
        certificate.chmod(0o600)
        _profile(directory, os.environ['FL_SUPERLINK_CONTROL_ADDRESS'], certificate)
        listing = _flwr(directory, 'list', 'production', '--run-id', str(run_id), '--format', 'json')
        runs = listing.get('runs', [])
        if runs and not runs[0]['status'].lower().startswith('finished:'):
            _flwr(directory, 'stop', str(run_id), 'production', '--format', 'json')


class WorkerCleanupError(RuntimeError):
    pass


def stop_workers(entries, experiment_id):
    pending = []
    for entry in entries:
        response = _invoke(entry['launcherArn'], 'stop', experiment_id, entry['datasetId'])
        if response['status'] not in ('Completed', 'Failed', 'Stopped', 'NotFound'):
            pending.append(entry)
    deadline = time.monotonic() + 600
    while pending and time.monotonic() < deadline:
        time.sleep(10)
        pending = [entry for entry in pending if _invoke(entry['launcherArn'], 'status',
            experiment_id, entry['datasetId'])['status'] not in ('Completed', 'Failed', 'Stopped')]
    if pending:
        raise WorkerCleanupError('organization workers did not stop')


def _db_connection():
    import psycopg
    if os.environ.get('PLATFORM_DATABASE_URL'):
        return psycopg.connect(os.environ['PLATFORM_DATABASE_URL'], sslmode='require')
    secret = json.loads(boto3.client('secretsmanager').get_secret_value(
        SecretId=os.environ['AWS_RDS_SECRET_ARN'])['SecretString'])
    return psycopg.connect(host=os.environ['AWS_RDS_PROXY_ENDPOINT'],
        dbname=os.environ['AWS_RDS_DATABASE'], user=secret['username'],
        password=secret['password'], sslmode='require')


def _persist(spec, run_id, artifacts, communication_bytes=None):
    bucket = os.environ['FL_MODEL_BUCKET']
    s3 = boto3.client('s3')
    experiment_id = spec['experimentId']
    final = artifacts[-1]
    rho_per_round = (int(spec['localEpochs']) / (2 * float(spec['noiseMultiplier']) ** 2)
                     + 2 / float(spec['metricNoiseMultiplier']) ** 2)
    per_org_rho = len(artifacts) * rho_per_round
    worst_case_rho = len(spec['datasets']) * per_org_rho
    privacy = {'unit': 'patient', 'accountant': 'Gaussian/zCDP',
               'rhoPerOrganization': per_org_rho, 'worstCaseRho': worst_case_rho,
               'epsilon': epsilon_for_rho(worst_case_rho, float(spec['privacyDelta'])),
               'delta': float(spec['privacyDelta'])}
    version = f"v1.{len(artifacts)}.0"
    model_id = f'model-{uuid.uuid4()}'
    report_id = f'rpt-{uuid.uuid4()}'
    schema_uri = urlparse(spec['schemaS3Uri'])
    if schema_uri.scheme != 's3' or schema_uri.netloc != bucket:
        raise ValueError('public schema must be stored in the coordinator model bucket')
    schema_body = s3.get_object(Bucket=bucket, Key=schema_uri.path.lstrip('/'))['Body'].read()
    if hashlib.sha256(schema_body).hexdigest() != spec['schemaSha256']:
        raise ValueError('public schema integrity check failed')
    model = {'weights': final['weights'], 'featureNames': final['featureNames'],
             'labels': final['labels'], 'publicSchema': json.loads(schema_body)}
    test = {**final['test'], 'data_split': 'test'}
    validation = {**final['validation'], 'data_split': 'validation'}
    model_body = json.dumps(model, allow_nan=False)
    s3.put_object(Bucket=bucket, Key=f'models/{experiment_id}/{version}.json',
                  Body=model_body.encode(), ContentType='application/json',
                  ServerSideEncryption='aws:kms')
    lines = [f"Experiment: {spec['name']}", 'Algorithm: private FedAvg with SecAgg+',
             f"Organizations: {len(spec['datasets'])}",
             f"Rounds: {len(artifacts)}",
             f"Validation accuracy: {validation['accuracy'] if validation['accuracy'] is not None else 'withheld'}",
             f"Test accuracy: {test['accuracy'] if test['accuracy'] is not None else 'withheld'}",
             f"Worst-case patient privacy: epsilon={privacy['epsilon']:.4f}, delta={privacy['delta']}",
             f"Flower network traffic: {communication_bytes if communication_bytes is not None else 'unavailable'} bytes",
             'Owner-enforced budget; independent review pending']
    pdf = create_report('Federated experiment report', lines)
    report_key = f'reports/{experiment_id}/{report_id}.pdf'
    s3.put_object(Bucket=bucket, Key=report_key, Body=pdf,
                  ContentType='application/pdf', ServerSideEncryption='aws:kms')
    with _db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT status FROM fl_experiments WHERE id = %s FOR UPDATE', (experiment_id,))
            row = cur.fetchone()
            if not row or row[0] not in ('Queued', 'Running'):
                raise RuntimeError('experiment is missing or cannot accept a remote result')
            for artifact in artifacts:
                metrics = {**artifact['validation'], 'data_split': 'validation',
                           'selected_clients': len(spec['datasets']),
                           'privacy_epsilon': epsilon_for_rho(
                               len(spec['datasets']) * int(artifact['round']) * rho_per_round,
                               float(spec['privacyDelta'])),
                           'privacy_delta': float(spec['privacyDelta'])}
                cur.execute('''INSERT INTO fl_rounds
                    (id, experiment_id, round_number, status, global_metrics_json,
                     client_metrics_json, model_artifact, created_at)
                    VALUES (%s, %s, %s, 'Completed', %s, '[]', %s, %s)
                    ON CONFLICT (experiment_id, round_number) DO UPDATE SET
                    status = 'Completed', global_metrics_json = EXCLUDED.global_metrics_json,
                    model_artifact = EXCLUDED.model_artifact''',
                    (f'round-{uuid.uuid4()}', experiment_id, artifact['round'],
                     json.dumps(metrics), json.dumps({'weights': artifact['weights'],
                     'featureNames': artifact['featureNames'], 'labels': artifact['labels']}),
                     time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())))
            cur.execute('''INSERT INTO model_versions
                (id, experiment_id, version, artifact_json, metrics_json, created_at, approved)
                VALUES (%s, %s, %s, %s, %s, %s, 0)''',
                (model_id, experiment_id, version, model_body, json.dumps(test),
                 time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())))
            cur.execute('''INSERT INTO experiment_reports
                (id, experiment_id, file_name, created_at, sha256_hash, s3_key)
                VALUES (%s, %s, %s, %s, %s, %s)''',
                (report_id, experiment_id, f'{report_id}.pdf',
                 time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                 hashlib.sha256(pdf).hexdigest(), report_key))
            cur.execute('''UPDATE fl_experiments SET status = 'Completed', current_round = %s,
                completed_at = %s, result_json = %s WHERE id = %s''',
                (len(artifacts), time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                 json.dumps({'validation': validation, 'test': test,
                             'deploymentMode': 'remote-secure', 'flowerRunId': str(run_id),
                             'privacy': privacy, 'communicationBytes': communication_bytes,
                             'cleanupPending': True}),
                 experiment_id))


def run(spec):
    datasets = spec['datasets']
    if len(datasets) != 3 or len({entry['organizationId'] for entry in datasets}) != 3:
        raise ValueError('the production pilot requires exactly three distinct organizations')
    if not 1 <= int(spec['rounds']) <= 100:
        raise ValueError('rounds must be between 1 and 100')
    started = []
    run_id = None
    try:
        for entry in datasets:
            _invoke(entry['launcherArn'], 'start', spec['experimentId'], entry['datasetId'])
            started.append(entry)
        deadline = time.monotonic() + int(os.environ.get('FL_WORKER_START_TIMEOUT', '900'))
        while time.monotonic() < deadline:
            statuses = [_invoke(entry['launcherArn'], 'status', spec['experimentId'],
                                entry['datasetId'])['status'] for entry in started]
            if all(status == 'InProgress' for status in statuses):
                break
            if any(status in ('Failed', 'Stopped', 'Completed') for status in statuses):
                raise RuntimeError('an organization worker failed to start')
            time.sleep(15)
        else:
            raise TimeoutError('organization workers did not become ready')
        with tempfile.TemporaryDirectory(prefix='fl-coordinator-') as temporary:
            directory = Path(temporary)
            ca = boto3.client('secretsmanager').get_secret_value(
                SecretId=os.environ['FL_CONTROL_CA_SECRET_ARN'])['SecretString']
            certificate = directory / 'ca.pem'
            certificate.write_text(ca)
            certificate.chmod(0o600)
            _profile(directory, os.environ['FL_SUPERLINK_CONTROL_ADDRESS'], certificate)
            config = (f"num-server-rounds={int(spec['rounds'])} min-clients={len(datasets)} "
                      f"schema-s3-uri={spec['schemaS3Uri']} "
                      f"local-epochs={int(spec['localEpochs'])} "
                      f"learning-rate={float(spec['learningRate'])} "
                      f"noise-multiplier={float(spec['noiseMultiplier'])} "
                      f"metric-noise-multiplier={float(spec['metricNoiseMultiplier'])} "
                      f"clipping-norm={float(spec['clippingNorm'])} "
                      f"normalization-count={int(spec['normalizationCount'])} "
                      f"split-seed={int(spec['splitSeed'])}")
            submission = _flwr(directory, 'run', '.', 'production', '--format', 'json',
                               '--run-config', config)
            run_id = str(submission['run-id'])
            with _db_connection() as conn:
                conn.execute('UPDATE fl_experiments SET result_json = %s WHERE id = %s AND status = %s',
                    (json.dumps({'deploymentMode': 'remote-secure', 'flowerRunId': run_id}),
                     spec['experimentId'], 'Running'))
            deadline = time.monotonic() + int(os.environ.get('FL_RUN_TIMEOUT', '7200'))
            while time.monotonic() < deadline:
                listing = _flwr(directory, 'list', 'production', '--run-id', run_id,
                                '--format', 'json')
                runs = listing.get('runs', [])
                if runs:
                    status = runs[0]['status'].lower()
                    if status == 'finished:completed':
                        break
                    if status.startswith('finished:') or status in ('failed', 'stopped'):
                        raise RuntimeError('secure Flower run failed')
                time.sleep(15)
            else:
                raise TimeoutError('secure Flower run timed out')
        s3 = boto3.client('s3')
        communication_bytes = runs[0].get('network-traffic', {}).get('total-bytes') if runs else None
        if not isinstance(communication_bytes, (int, float)) or communication_bytes < 0:
            communication_bytes = None
        artifacts = []
        for number in range(1, int(spec['rounds']) + 1):
            key = f'secure-aggregates/{run_id}/round-{number}.json'
            artifact = json.loads(s3.get_object(Bucket=os.environ['FL_MODEL_BUCKET'],
                                                Key=key)['Body'].read())
            if (artifact.get('runId') != run_id or artifact.get('round') != number or
                    artifact.get('schemaSha256') != spec['schemaSha256'] or
                    len(artifact.get('weights', [])) != len(artifact.get('featureNames', [])) or
                    any(not math.isfinite(float(value)) for value in artifact['weights'])):
                raise ValueError('secure aggregate artifact failed validation')
            artifacts.append(artifact)
        _persist(spec, run_id, artifacts, communication_bytes)
        return {'experimentId': spec['experimentId'], 'flowerRunId': run_id,
                'status': 'Completed'}
    except Exception:
        if run_id:
            stop_flower_run(run_id)
        with _db_connection() as conn:
            conn.execute("UPDATE fl_experiments SET status = 'Failed', result_json = %s WHERE id = %s",
                (json.dumps({'error': 'Remote training failed; inspect coordinator logs',
                             'flowerRunId': run_id, 'cleanupPending': True}),
                 spec['experimentId']))
        raise
    finally:
        try:
            stop_workers(started, spec['experimentId'])
            with _db_connection() as conn:
                row = conn.execute('SELECT status, result_json FROM fl_experiments WHERE id = %s',
                    (spec['experimentId'],)).fetchone()
                if row and row[0] in ('Completed', 'Failed'):
                    result = json.loads(row[1])
                    if result.get('cleanupPending'):
                        result['cleanupPending'] = False
                        conn.execute('UPDATE fl_experiments SET result_json = %s WHERE id = %s',
                            (json.dumps(result), spec['experimentId']))
        except Exception as exc:
            raise WorkerCleanupError('remote worker cleanup failed') from exc


if __name__ == '__main__':
    print(json.dumps(run(json.loads(os.environ['FL_EXPERIMENT_SPEC']))))
