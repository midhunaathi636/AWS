"""Deterministic held-out evaluation for the local FL simulator."""
import hashlib
import math
import random


def split_rows(rows, target, seed, client_id):
    groups = {}
    for row in rows:
        groups.setdefault(row[target].strip(), []).append(row)
    if len(groups) != 2 or any(len(group) < 3 for group in groups.values()):
        raise ValueError(f'client {client_id} needs two labels with at least three rows each')
    result = {'train': [], 'validation': [], 'test': []}
    for label, group in sorted(groups.items()):
        salt = hashlib.sha256(f'{seed}:{client_id}:{label}'.encode()).digest()
        random.Random(int.from_bytes(salt[:8], 'big')).shuffle(group)
        holdout = max(1, round(len(group) * 0.15))
        holdout = min(holdout, (len(group) - 1) // 2)
        result['validation'].extend(group[:holdout])
        result['test'].extend(group[holdout:holdout * 2])
        result['train'].extend(group[holdout * 2:])
    return result


def auc_roc(actual, probabilities):
    positives = sum(actual)
    negatives = len(actual) - positives
    if not positives or not negatives:
        return None
    pairs = sorted(zip(probabilities, actual), key=lambda pair: pair[0])
    rank_sum = 0.0
    index = 0
    while index < len(pairs):
        end = index + 1
        while end < len(pairs) and pairs[end][0] == pairs[index][0]:
            end += 1
        rank_sum += sum(label for _, label in pairs[index:end]) * (index + 1 + end) / 2
        index = end
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def calculate_metrics(weights, clients, split, sigmoid):
    actual, predicted, probabilities, losses = [], [], [], []
    for client in clients:
        for row, label in client[split]:
            probability = min(max(sigmoid(sum(a * b for a, b in zip(weights, row))), 1e-7), 1 - 1e-7)
            actual.append(label)
            predicted.append(float(probability >= 0.5))
            probabilities.append(probability)
            losses.append(-(label * math.log(probability) + (1 - label) * math.log(1 - probability)))
    tp = sum(a == 1 and p == 1 for a, p in zip(actual, predicted))
    tn = sum(a == 0 and p == 0 for a, p in zip(actual, predicted))
    fp = sum(a == 0 and p == 1 for a, p in zip(actual, predicted))
    fn = sum(a == 1 and p == 0 for a, p in zip(actual, predicted))
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    return {'accuracy': (tp + tn) / max(1, len(actual)), 'precision': precision,
            'recall': recall, 'f1': 2 * precision * recall / max(1e-12, precision + recall),
            'loss': sum(losses) / max(1, len(losses)), 'auc_roc': auc_roc(actual, probabilities),
            'confusion_matrix': [[tp, fn], [fp, tn]], 'records': len(actual), 'data_split': split}
