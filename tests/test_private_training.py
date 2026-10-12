import csv
import io
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ml_service'))
from private_training import epsilon_for_rho, rho_for_epsilon, feature_names, prepare_patients, private_train_round, private_accuracy, private_metric_counts


SCHEMA = {
    'patient_id': 'patient', 'target': 'label', 'labels': ['no', 'yes'],
    'features': [{'name': 'age', 'type': 'numeric', 'min': 0, 'max': 100},
                 {'name': 'site', 'type': 'categorical', 'values': ['A', 'B']}],
}


class ZeroNoise:
    def gauss(self, _mean, _stddev):
        return 0.0


class PrivateTrainingTest(unittest.TestCase):
    def test_patient_grouping_and_public_features(self):
        csv_text = 'patient,age,site,label\np1,25,A,yes\np1,26,B,no\np2,200,A,yes\n'
        splits = prepare_patients(csv_text, SCHEMA, 3)
        self.assertEqual(sum(map(len, splits.values())), 2)
        self.assertEqual(sum(len(patient) for split in splits.values() for patient in split), 3)
        self.assertEqual(feature_names(SCHEMA), ['__bias__', 'age', 'site=A', 'site=B'])
        self.assertTrue(any(vector[1] == 1 for split in splits.values() for group in split for vector, _ in group))

    def test_accountant_composes_and_inverts(self):
        delta = 1e-6
        one = epsilon_for_rho(.2, delta)
        two = epsilon_for_rho(.4, delta)
        self.assertGreater(two, one)
        self.assertAlmostEqual(rho_for_epsilon(one, delta), .2)

    def test_training_uses_public_denominator_and_reports_cost(self):
        groups = [[([1, .5], 1)], [([1, .2], 0), ([1, .3], 0)]]
        output = private_train_round(groups, [0, 0], epochs=2, learning_rate=.1,
                                     clipping_norm=1, noise_multiplier=2,
                                     normalization_count=10, rng=ZeroNoise())
        self.assertEqual(len(output['delta']), 2)
        self.assertAlmostEqual(output['rho'], .25)
        self.assertTrue(all(math.isfinite(value) for value in output['delta']))
        metric = private_accuracy(groups, [0, 0], noise_multiplier=2,
                                  normalization_count=10, rng=ZeroNoise())
        self.assertAlmostEqual(metric['rho'], .125)
        counts = private_metric_counts(groups, [0, 0], noise_multiplier=2,
                                       normalization_count=10, rng=ZeroNoise())
        self.assertEqual(counts['coordinates'], [.1, .2])
        self.assertAlmostEqual(counts['rho'], .25)
        with self.assertRaises(ValueError):
            private_train_round(groups, [0, 0], epochs=1, learning_rate=.1,
                                clipping_norm=1, noise_multiplier=1,
                                normalization_count=1)


if __name__ == '__main__':
    unittest.main()
