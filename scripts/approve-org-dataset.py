"""One-time organization administrator approval for a remote FL dataset.

Run inside the organization's AWS account after uploading its private data.csv
and public schema.json to the organization bucket. Existing approvals cannot be
overwritten; a new dataset ID is required for a changed policy or schema.
"""

import argparse
import json
import sys
from pathlib import Path

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_service.private_training import feature_names, rho_for_epsilon


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bucket', required=True)
    parser.add_argument('--registry-table', required=True)
    parser.add_argument('--privacy-table', required=True)
    parser.add_argument('--dataset-id', required=True)
    parser.add_argument('--data-key', required=True)
    parser.add_argument('--schema-key', required=True)
    parser.add_argument('--epsilon', type=float, required=True)
    parser.add_argument('--delta', type=float, required=True)
    args = parser.parse_args()
    if not args.data_key.startswith('datasets/') or not args.data_key.endswith('/data.csv'):
        parser.error('data key must be datasets/.../data.csv')
    if not args.schema_key.startswith('schemas/') or not args.schema_key.endswith('/schema.json'):
        parser.error('schema key must be schemas/.../schema.json')
    s3 = boto3.client('s3')
    schema = json.loads(s3.get_object(Bucket=args.bucket, Key=args.schema_key)['Body'].read())
    feature_names(schema)
    s3.head_object(Bucket=args.bucket, Key=args.data_key)
    limit = rho_for_epsilon(args.epsilon, args.delta)
    dynamodb = boto3.client('dynamodb')
    global_item = dynamodb.get_item(TableName=args.privacy_table,
        Key={'pk': {'S': 'BUDGET#GLOBAL'}}, ConsistentRead=True).get('Item')
    if not global_item or float(global_item['delta']['N']) != args.delta or limit > float(global_item['max_rho']['N']):
        parser.error('an organization-wide privacy cap with matching delta and enough rho is required')
    dynamodb.transact_write_items(TransactItems=[
        {'Put': {'TableName': args.registry_table,
                 'Item': {'pk': {'S': f'DATASET#{args.dataset_id}'},
                          'status': {'S': 'Approved'}, 'data_key': {'S': args.data_key},
                          'schema_key': {'S': args.schema_key}},
                 'ConditionExpression': 'attribute_not_exists(pk)'}},
        {'Put': {'TableName': args.privacy_table,
                 'Item': {'pk': {'S': f'BUDGET#{args.dataset_id}'},
                          'max_rho': {'N': str(limit)}, 'rho_used': {'N': '0'},
                          'delta': {'N': str(args.delta)}},
                 'ConditionExpression': 'attribute_not_exists(pk)'}},
    ])
    print(json.dumps({'datasetId': args.dataset_id, 'approvedEpsilon': args.epsilon,
                      'delta': args.delta, 'maxRho': limit}))


if __name__ == '__main__':
    main()
