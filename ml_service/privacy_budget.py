"""Organization-owned, atomic privacy budget consumption in DynamoDB.

Budget items are provisioned by an organization administrator with pk
``BUDGET#<dataset-id>`` and ``BUDGET#GLOBAL``, max_rho, rho_used, and delta
(DynamoDB Numbers). A run
consumes its full planned budget before any patient data is processed. No refunds
are made for failed or aborted jobs, which is conservative under retries.
"""

from decimal import Decimal
from .private_training import epsilon_for_rho


class BudgetExceeded(Exception):
    pass


def consume_budget(table_name, dataset_id, run_id, planned_rho, *, client=None):
    if planned_rho <= 0 or not dataset_id or not run_id:
        raise ValueError('a dataset, run, and positive planned rho are required')
    if client is None:
        import boto3
        client = boto3.client('dynamodb')
    budget_key = {'pk': {'S': f'BUDGET#{dataset_id}'}}
    global_key = {'pk': {'S': 'BUDGET#GLOBAL'}}
    item = client.get_item(TableName=table_name, Key=budget_key, ConsistentRead=True).get('Item')
    global_item = client.get_item(TableName=table_name, Key=global_key, ConsistentRead=True).get('Item')
    if not item or not global_item:
        raise BudgetExceeded('approved dataset and organization privacy policies are required')
    limit = Decimal(item['max_rho']['N'])
    spent = Decimal(item['rho_used']['N'])
    global_limit = Decimal(global_item['max_rho']['N'])
    global_spent = Decimal(global_item['rho_used']['N'])
    delta = Decimal(item['delta']['N'])
    if delta != Decimal(global_item['delta']['N']):
        raise BudgetExceeded('dataset and organization delta policies disagree')
    cost = Decimal(str(planned_rho))
    if spent + cost > limit or global_spent + cost > global_limit:
        raise BudgetExceeded('approved privacy budget would be exceeded')
    try:
        client.transact_write_items(TransactItems=[
            {'Update': {
                'TableName': table_name, 'Key': budget_key,
                'UpdateExpression': 'SET rho_used = rho_used + :cost',
                'ConditionExpression': 'max_rho = :limit AND rho_used <= :remaining',
                'ExpressionAttributeValues': {
                    ':cost': {'N': str(cost)}, ':limit': {'N': str(limit)},
                    ':remaining': {'N': str(limit - cost)},
                },
            }},
            {'Update': {
                'TableName': table_name, 'Key': global_key,
                'UpdateExpression': 'SET rho_used = rho_used + :cost',
                'ConditionExpression': 'max_rho = :limit AND rho_used <= :remaining',
                'ExpressionAttributeValues': {
                    ':cost': {'N': str(cost)}, ':limit': {'N': str(global_limit)},
                    ':remaining': {'N': str(global_limit - cost)},
                },
            }},
            {'Put': {
                'TableName': table_name,
                'Item': {'pk': {'S': f'RUN#{run_id}'}, 'dataset_id': {'S': dataset_id},
                         'rho': {'N': str(cost)}, 'delta': {'N': str(delta)}},
                'ConditionExpression': 'attribute_not_exists(pk)',
            }},
        ])
    except client.exceptions.TransactionCanceledException as exc:
        raise BudgetExceeded('budget changed or run has already consumed privacy budget') from exc
    total_rho = float(global_spent + cost)
    return {'rho_spent': total_rho, 'epsilon_spent': epsilon_for_rho(total_rho, float(delta)),
            'delta': float(delta), 'rho_remaining': float(global_limit - global_spent - cost)}
