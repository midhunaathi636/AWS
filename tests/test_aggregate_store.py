import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from production_fl.aggregate_store import aggregate_artifact, public_schema_metadata, save_aggregate


class AggregateStoreTest(unittest.TestCase):
    def test_only_aggregate_model_and_private_accuracy_are_saved(self):
        metadata = public_schema_metadata('{"public":true}', ['__bias__', 'age'], ['no', 'yes'])
        artifact = aggregate_artifact([.2, -.1, .7, 1, .4, 1], metadata, 123, 2)
        self.assertEqual(artifact['weights'], [.2, -.1])
        self.assertAlmostEqual(artifact['validation']['accuracy'], .7)
        self.assertAlmostEqual(artifact['test']['accuracy'], .4)
        self.assertNotIn('clientMetrics', artifact)
        with tempfile.TemporaryDirectory() as directory, patch.dict('os.environ', {'FL_AGGREGATE_OUTPUT_DIR': directory, 'FL_MODEL_BUCKET': ''}):
            target = Path(save_aggregate(artifact))
            self.assertTrue(target.is_file())
            self.assertEqual(json.loads(target.read_text()), artifact)

    def test_invalid_or_empty_private_denominator_is_withheld(self):
        metadata = public_schema_metadata('{}', ['__bias__'], ['no', 'yes'])
        artifact = aggregate_artifact([0, 2, 1, 1, -1], metadata, 1, 1)
        self.assertIsNone(artifact['test']['accuracy'])
        self.assertEqual(artifact['validation']['accuracy'], 1)
        with self.assertRaises(ValueError):
            aggregate_artifact([float('nan'), 0, 1, 0, 1], metadata, 1, 1)


if __name__ == '__main__':
    unittest.main()
