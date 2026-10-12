import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_service.privacy_budget import BudgetExceeded, consume_budget


class FakeDynamo:
    class exceptions:
        class TransactionCanceledException(Exception):
            pass

    def __init__(self, dataset_spent='0.1', global_spent='0.2'):
        self.dataset_spent = dataset_spent
        self.global_spent = global_spent
        self.transaction = None

    def get_item(self, **kwargs):
        global_budget = kwargs['Key']['pk']['S'] == 'BUDGET#GLOBAL'
        return {'Item': {'max_rho': {'N': '1'},
                         'rho_used': {'N': self.global_spent if global_budget else self.dataset_spent},
                         'delta': {'N': '0.000001'}}}

    def transact_write_items(self, **kwargs):
        self.transaction = kwargs['TransactItems']


class BudgetTest(unittest.TestCase):
    def test_atomic_dataset_global_and_run_reservation(self):
        fake = FakeDynamo()
        result = consume_budget('privacy', 'ds1', 'run1', .25, client=fake)
        self.assertEqual(len(fake.transaction), 3)
        self.assertEqual(fake.transaction[0]['Update']['Key']['pk']['S'], 'BUDGET#ds1')
        self.assertEqual(fake.transaction[1]['Update']['Key']['pk']['S'], 'BUDGET#GLOBAL')
        self.assertEqual(fake.transaction[2]['Put']['Item']['pk']['S'], 'RUN#run1')
        self.assertAlmostEqual(result['rho_spent'], .45)

    def test_global_cap_blocks_release_even_when_dataset_has_room(self):
        fake = FakeDynamo(dataset_spent='0', global_spent='0.9')
        with self.assertRaises(BudgetExceeded):
            consume_budget('privacy', 'ds1', 'run1', .25, client=fake)
        self.assertIsNone(fake.transaction)


if __name__ == '__main__':
    unittest.main()
