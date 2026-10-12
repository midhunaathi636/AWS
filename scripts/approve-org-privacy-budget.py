"""Create one immutable organization-wide patient privacy cap in its own account."""

import argparse
import sys
from pathlib import Path

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_service.private_training import rho_for_epsilon


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--privacy-table', required=True)
    parser.add_argument('--epsilon', type=float, required=True)
    parser.add_argument('--delta', type=float, required=True)
    args = parser.parse_args()
    limit = rho_for_epsilon(args.epsilon, args.delta)
    boto3.client('dynamodb').put_item(
        TableName=args.privacy_table,
        Item={'pk': {'S': 'BUDGET#GLOBAL'}, 'max_rho': {'N': str(limit)},
              'rho_used': {'N': '0'}, 'delta': {'N': str(args.delta)}},
        ConditionExpression='attribute_not_exists(pk)',
    )
    print(f'Created organization privacy cap: epsilon={args.epsilon}, delta={args.delta}, rho={limit}')


if __name__ == '__main__':
    main()
