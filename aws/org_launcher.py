"""Organization-side launcher; coordinator never chooses image, role, or S3 path."""

import hashlib
import os
import re

import boto3
from botocore.exceptions import ClientError


def handler(event, _context):
    action = event.get('action')
    dataset_id = event.get('datasetId', '')
    experiment_id = event.get('experimentId', '')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', dataset_id) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', experiment_id):
        raise ValueError('invalid dataset or experiment identifier')
    digest = hashlib.sha256(f'{dataset_id}:{experiment_id}'.encode()).hexdigest()[:32]
    job_name = f'fl-{digest}'
    sagemaker = boto3.client('sagemaker')
    if action == 'status':
        result = sagemaker.describe_training_job(TrainingJobName=job_name)
        return {'jobName': job_name, 'status': result['TrainingJobStatus']}
    if action == 'stop':
        try:
            existing = sagemaker.describe_training_job(TrainingJobName=job_name)
        except ClientError as exc:
            if exc.response.get('Error', {}).get('Code') == 'ValidationException':
                return {'jobName': job_name, 'status': 'NotFound'}
            raise
        if existing['TrainingJobStatus'] in ('Completed', 'Failed', 'Stopped'):
            return {'jobName': job_name, 'status': existing['TrainingJobStatus']}
        sagemaker.stop_training_job(TrainingJobName=job_name)
        return {'jobName': job_name, 'status': 'Stopping'}
    if action != 'start':
        raise ValueError('unsupported launcher action')
    table = boto3.resource('dynamodb').Table(os.environ['FL_REGISTRY_TABLE'])
    record = table.get_item(Key={'pk': f'DATASET#{dataset_id}'}, ConsistentRead=True).get('Item')
    if not record or record.get('status') != 'Approved':
        raise ValueError('dataset is not approved by its owner for federation')
    bucket = os.environ['FL_DATA_BUCKET']
    data_key = record['data_key']
    schema_key = record['schema_key']
    if not data_key.startswith('datasets/') or not data_key.endswith('/data.csv') or not schema_key.startswith('schemas/') or not schema_key.endswith('/schema.json'):
        raise ValueError('registry keys must use approved prefixes')
    try:
        existing = sagemaker.describe_training_job(TrainingJobName=job_name)
        return {'jobName': job_name, 'status': existing['TrainingJobStatus']}
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'ValidationException':
            raise
    result = sagemaker.create_training_job(
        TrainingJobName=job_name,
        RoleArn=os.environ['FL_EXECUTION_ROLE_ARN'],
        AlgorithmSpecification={'TrainingImage': os.environ['FL_WORKER_IMAGE'], 'TrainingInputMode': 'File'},
        InputDataConfig=[
            {'ChannelName': 'training', 'DataSource': {'S3DataSource': {
                'S3DataType': 'S3Prefix', 'S3Uri': f's3://{bucket}/{data_key}',
                'S3DataDistributionType': 'FullyReplicated'}}},
            {'ChannelName': 'schema', 'DataSource': {'S3DataSource': {
                'S3DataType': 'S3Prefix', 'S3Uri': f's3://{bucket}/{schema_key}',
                'S3DataDistributionType': 'FullyReplicated'}}},
        ],
        OutputDataConfig={'S3OutputPath': f's3://{bucket}/job-output/',
                          'KmsKeyId': os.environ['FL_DATA_KEY_ARN']},
        ResourceConfig={'InstanceType': os.environ.get('FL_INSTANCE_TYPE', 'ml.m5.large'),
                        'InstanceCount': 1, 'VolumeSizeInGB': 20,
                        'VolumeKmsKeyId': os.environ['FL_DATA_KEY_ARN']},
        StoppingCondition={'MaxRuntimeInSeconds': 10800},
        VpcConfig={'Subnets': os.environ['FL_SUBNET_IDS'].split(','),
                   'SecurityGroupIds': os.environ['FL_SECURITY_GROUP_IDS'].split(',')},
        EnableNetworkIsolation=False,
        Environment={'FL_SUPERLINK_ADDRESS': os.environ['FL_SUPERLINK_ADDRESS'],
                     'FL_CA_SECRET_ARN': os.environ['FL_CA_SECRET_ARN'],
                     'FL_NODE_KEY_SECRET_ARN': os.environ['FL_NODE_KEY_SECRET_ARN'],
                     'FL_DATASET_ID': dataset_id,
                     'FL_PRIVACY_TABLE': os.environ['FL_PRIVACY_TABLE']},
    )
    return {'jobName': job_name, 'jobArn': result['TrainingJobArn'], 'status': 'Starting'}
