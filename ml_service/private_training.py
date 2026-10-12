"""Patient-level private logistic training for an organization-owned worker.

This module deliberately has no transport. A production caller must pass its output
through a reviewed secure aggregation protocol and enforce a durable privacy budget.
The accountant uses conservative Gaussian/zCDP composition without subsampling
amplification. Every feature and output dimension comes from a public schema.
"""

import csv
import hashlib
import math
import secrets
from collections import defaultdict


def epsilon_for_rho(rho, delta):
    if not 0 < delta < 1 or rho < 0:
        raise ValueError('delta must be in (0, 1) and rho must be non-negative')
    return rho + 2 * math.sqrt(rho * math.log(1 / delta))


def rho_for_epsilon(epsilon, delta):
    if epsilon <= 0 or not 0 < delta < 1:
        raise ValueError('epsilon must be positive and delta must be in (0, 1)')
    root = math.sqrt(math.log(1 / delta) + epsilon) - math.sqrt(math.log(1 / delta))
    return root * root


def _normal(stddev, rng):
    return rng.gauss(0, stddev)


def _clip(vector, maximum):
    magnitude = math.sqrt(sum(value * value for value in vector))
    scale = min(1.0, maximum / max(magnitude, 1e-12))
    return [value * scale for value in vector]


def _sigmoid(value):
    return 1 / (1 + math.exp(-max(-40, min(40, value))))


def feature_names(schema):
    names = ['__bias__']
    for feature in schema['features']:
        if feature['type'] == 'numeric':
            if not math.isfinite(float(feature['min'])) or not math.isfinite(float(feature['max'])) or float(feature['min']) >= float(feature['max']):
                raise ValueError('numeric features need finite, ordered public bounds')
            names.append(feature['name'])
        elif feature['type'] == 'categorical':
            values = feature['values']
            if not values or len(set(values)) != len(values):
                raise ValueError('categories must be unique and nonempty')
            names.extend(f"{feature['name']}={value}" for value in values)
        else:
            raise ValueError('unsupported feature type')
    if len(schema['labels']) != 2 or schema['labels'][0] == schema['labels'][1]:
        raise ValueError('exactly two public labels are required')
    if len(set(names)) != len(names):
        raise ValueError('feature names must be unique')
    return names


def _encode(row, schema):
    vector = [1.0]
    for feature in schema['features']:
        raw = row[feature['name']]
        if feature['type'] == 'numeric':
            value = float(raw)
            if not math.isfinite(value):
                raise ValueError('non-finite numeric feature')
            low, high = float(feature['min']), float(feature['max'])
            vector.append((max(low, min(high, value)) - low) / (high - low))
        else:
            vector.extend(float(raw == option) for option in feature['values'])
    label = row[schema['target']]
    if label not in schema['labels']:
        raise ValueError('target label is outside the public schema')
    return vector, float(label == schema['labels'][1])


def prepare_patients(csv_text, schema, split_seed):
    """Keep every row for a patient in one split; never return patient IDs."""
    feature_names(schema)
    rows = list(csv.DictReader(csv_text.splitlines()))
    required = {schema['patient_id'], schema['target'], *(f['name'] for f in schema['features'])}
    if not rows or not required.issubset(rows[0]):
        raise ValueError('CSV is empty or missing required public-schema columns')
    grouped = defaultdict(list)
    for row in rows:
        patient = row[schema['patient_id']].strip()
        if not patient:
            raise ValueError('patient identifier is required')
        grouped[patient].append(_encode(row, schema))
    result = {'train': [], 'validation': [], 'test': []}
    for patient, samples in grouped.items():
        digest = hashlib.sha256(f'{split_seed}:{patient}'.encode()).digest()
        bucket = int.from_bytes(digest[:8], 'big') % 100
        split = 'train' if bucket < 70 else 'validation' if bucket < 85 else 'test'
        result[split].append(samples)
    return result


def private_train_round(patient_groups, initial_weights, *, epochs, learning_rate,
                        clipping_norm, noise_multiplier, normalization_count, rng=None):
    """Return a DP model delta and its zCDP cost for a single local round.

    Adjacent datasets replace one patient's entire set of rows. Each patient's mean
    gradient is clipped before summing; Gaussian noise uses sensitivity 2*C. The
    denominator is a public constant, never the private patient count.
    """
    if (not patient_groups or epochs < 1 or learning_rate <= 0 or clipping_norm <= 0
            or noise_multiplier <= 0 or normalization_count < len(patient_groups)):
        raise ValueError('invalid private training configuration')
    rng = rng or secrets.SystemRandom()
    weights = list(initial_weights)
    if not weights or any(not math.isfinite(value) for value in weights):
        raise ValueError('finite initial weights are required')
    for _ in range(epochs):
        aggregate = [0.0] * len(weights)
        for samples in patient_groups:
            gradient = [0.0] * len(weights)
            for vector, label in samples:
                if len(vector) != len(weights):
                    raise ValueError('feature width does not match model')
                error = _sigmoid(sum(a * b for a, b in zip(weights, vector))) - label
                for index, value in enumerate(vector):
                    gradient[index] += error * value / len(samples)
            for index, value in enumerate(_clip(gradient, clipping_norm)):
                aggregate[index] += value
        stddev = 2 * clipping_norm * noise_multiplier
        weights = [weight - learning_rate * (value + _normal(stddev, rng)) / normalization_count
                   for weight, value in zip(weights, aggregate)]
    return {
        'delta': [new - old for new, old in zip(weights, initial_weights)],
        'rho': epochs / (2 * noise_multiplier ** 2),
        'mechanism': 'patient-level Gaussian, replace-one, full-batch zCDP',
    }


def private_accuracy(patient_groups, weights, *, noise_multiplier, normalization_count, rng=None):
    """DP patient-weighted accuracy for one held-out split, including empty splits."""
    if noise_multiplier <= 0 or normalization_count < len(patient_groups) or normalization_count < 1:
        raise ValueError('invalid private evaluation configuration')
    rng = rng or secrets.SystemRandom()
    correct = 0.0
    for samples in patient_groups:
        correct += sum((_sigmoid(sum(a * b for a, b in zip(weights, vector))) >= .5) == bool(label)
                       for vector, label in samples) / len(samples)
    # A patient contributes a value in [0, 1]; replace-one sensitivity is 1.
    noisy = (correct + _normal(noise_multiplier, rng)) / normalization_count
    return {'accuracy': max(0.0, min(1.0, noisy)), 'rho': 1 / (2 * noise_multiplier ** 2)}


def private_metric_counts(patient_groups, weights, *, noise_multiplier, normalization_count, rng=None):
    """Two DP coordinates for secure aggregation: correct patients and patients.

    The coordinator may divide aggregate noisy correct by aggregate noisy count
    only after SecAgg+ has unmasked the cohort sum. It must never receive either
    organization's coordinates separately.
    """
    if noise_multiplier <= 0 or normalization_count < len(patient_groups) or normalization_count < 1:
        raise ValueError('invalid private evaluation configuration')
    rng = rng or secrets.SystemRandom()
    correct = 0.0
    for samples in patient_groups:
        correct += sum((_sigmoid(sum(a * b for a, b in zip(weights, vector))) >= .5) == bool(label)
                       for vector, label in samples) / len(samples)
    return {
        'coordinates': [(correct + _normal(noise_multiplier, rng)) / normalization_count,
                        (len(patient_groups) + _normal(noise_multiplier, rng)) / normalization_count],
        'rho': 1 / noise_multiplier ** 2,
    }
