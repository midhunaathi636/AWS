#!/usr/bin/env python3
"""Dependency-free binary federated trainer used by the local/API worker.

Input is JSON on stdin: {clients: [{id, csv}], rounds, target_column, learning_rate,
local_epochs, clipping_norm, noise_multiplier}. Raw rows stay in the worker process;
the output contains only model weights and aggregate metrics.
"""
import csv, json, math, random, sys
from evaluation import split_rows, calculate_metrics

def sigmoid(x):
    if x < -40: return 0.0
    if x > 40: return 1.0
    return 1.0 / (1.0 + math.exp(-x))

def parse_client(payload, target, seed, client_id):
    rows = list(csv.DictReader(payload.splitlines()))
    if not rows or target not in rows[0]:
        raise ValueError(f"target column '{target}' is missing or dataset is empty")
    splits = split_rows(rows, target, seed, client_id)
    feature_names = [k for k in rows[0] if k != target]
    numeric = {}
    categories = {}
    for name in feature_names:
        vals = [r.get(name, '').strip() for r in splits['train']]
        try:
            numeric[name] = [float(v) if v else 0.0 for v in vals]
        except ValueError:
            categories[name] = sorted(set(vals))
    names = ['__bias__']
    for name in feature_names:
        names.append(name) if name in numeric else names.extend(f'{name}={v}' for v in categories[name])
    labels = sorted(set(r[target].strip() for r in rows))
    if len(labels) != 2:
        raise ValueError('binary classification requires exactly two target labels')
    encoded = {}
    for split, split_rows_data in splits.items():
        encoded[split] = []
        for r in split_rows_data:
            vector = [1.0]
            for name in feature_names:
                if name in numeric:
                    try: vector.append(float(r.get(name, '') or 0.0))
                    except ValueError: raise ValueError(f"non-numeric value in feature '{name}'")
                else: vector.extend(1.0 if r.get(name, '').strip() == v else 0.0 for v in categories[name])
            encoded[split].append((vector, 1.0 if r[target].strip() == labels[1] else 0.0))
    return {'id': client_id, **encoded, 'names': names, 'labels': labels, 'source_features': feature_names}

def clip_and_noise(delta, norm, noise):
    length = math.sqrt(sum(v * v for v in delta))
    scale = min(1.0, norm / max(length, 1e-12))
    return [v * scale + (random.gauss(0, noise * norm) if noise else 0.0) for v in delta]

def train_client(client, global_w, epochs, lr, clip, noise, algorithm='FedAvg', proximal_mu=0.01, malicious=False, seed=0):
    w = list(global_w)
    for _ in range(epochs):
        grad = [0.0] * len(w)
        for row, label in client['train']:
            if malicious: label = 1.0 - label
            error = sigmoid(sum(a * b for a, b in zip(w, row))) - label
            for i, value in enumerate(row): grad[i] += error * value / len(client['train'])
        if algorithm == 'FedProx':
            grad = [g + proximal_mu * (w_i - initial) for g, w_i, initial in zip(grad, w, global_w)]
        w = [a - lr * b for a, b in zip(w, grad)]
    # Deterministic noise makes experiments reproducible; this is a simulation knob,
    # not a formal DP accountant or a production differential privacy guarantee.
    random.seed(seed)
    return clip_and_noise([a - b for a, b in zip(w, global_w)], clip, noise), w

def metrics(w, clients, split='validation'):
    return calculate_metrics(w, clients, split, sigmoid)

def main():
    spec = json.load(sys.stdin)
    clients = []
    for raw in spec['clients']:
        parsed = parse_client(raw['csv'], spec['target_column'], int(spec.get('split_seed', 42)), raw['id'])
        parsed['id'] = raw['id']; clients.append(parsed)
    if not clients: raise ValueError('at least one client is required')
    if any(c['source_features'] != clients[0]['source_features'] for c in clients[1:]):
        raise ValueError('all client datasets must use the same feature columns in the same order')
    for feature in clients[0]['source_features']:
        kinds = {feature in client['names'] for client in clients}
        if len(kinds) != 1:
            raise ValueError(f"feature '{feature}' has conflicting numeric and categorical types across clients")
    # Build a shared feature vocabulary so a category present at only one site does
    # not make otherwise compatible client datasets impossible to train together.
    names = ['__bias__']
    categorical_seen = set()
    for name in clients[0]['names'][1:]:
        feature = name.split('=', 1)[0]
        if '=' not in name:
            names.append(name)
        else:
            if feature in categorical_seen: continue
            categorical_seen.add(feature)
            categories = []
            for client in clients:
                categories.extend(item.split('=', 1)[1] for item in client['names'][1:] if item.startswith(feature + '='))
            names.extend(f'{feature}={category}' for category in dict.fromkeys(categories))
    for client in clients:
        old_names = client['names']
        for split in ('train', 'validation', 'test'):
            remapped = []
            for row, label in client[split]:
                old_values = dict(zip(old_names, row))
                remapped.append(([old_values.get(name, 0.0) for name in names], label))
            client[split] = remapped
        client['names'] = names
    if any(c['labels'] != clients[0]['labels'] for c in clients[1:]):
        raise ValueError('all client datasets must use the same two target labels')
    width = len(clients[0]['train'][0][0]); global_w = [0.0] * width
    rounds = []
    for number in range(1, int(spec.get('rounds', 1)) + 1):
        selected = spec.get('selected_client_ids')
        active_clients = [c for c in clients if not selected or c['id'] in selected]
        if not active_clients: raise ValueError('client selection excluded every client')
        updates, total = [], sum(len(c['train']) for c in active_clients)
        client_metrics = []
        for client in active_clients:
            malicious = client['id'] in spec.get('malicious_client_ids', [])
            delta, local_w = train_client(client, global_w, int(spec.get('local_epochs', 3)), float(spec.get('learning_rate', .1)), float(spec.get('clipping_norm', 1.0)), float(spec.get('noise_multiplier', 0.0)), spec.get('algorithm', 'FedAvg'), float(spec.get('proximal_mu', 0.01)), malicious, number * 1000 + len(client_metrics))
            weight = len(client['train']) / total
            updates.append((delta, weight))
            update_norm = math.sqrt(sum(v * v for v in delta))
            client_metrics.append({'client_id': client['id'], **metrics(local_w, [client]), 'train_records': len(client['train']), 'update_norm': update_norm, 'malicious_simulated': malicious, 'selected': True})
        if not updates: raise ValueError('client selection excluded every client')
        global_w = [global_w[i] + sum(delta[i] * weight for delta, weight in updates) for i in range(width)]
        norms = [c['update_norm'] for c in client_metrics]
        center = sum(norms) / len(norms)
        spread = math.sqrt(sum((value - center) ** 2 for value in norms) / len(norms))
        threshold = center + float(spec.get('poisoning_threshold_sigma', 2.0)) * spread
        for item in client_metrics:
            item['poisoning_flag'] = item['update_norm'] > threshold and len(norms) > 1
            item['trust_score'] = max(0.0, min(100.0, 100.0 - (100.0 if item['poisoning_flag'] else min(50.0, item['update_norm'] * 10))))
        rounds.append({'round': number, 'global_metrics': metrics(global_w, clients), 'training_metrics': metrics(global_w, clients, 'train'), 'clients': client_metrics, 'communication_bytes': sum(len(delta) * 8 for delta, _ in updates) * 2, 'selected_clients': [c['client_id'] for c in client_metrics], 'weights': list(global_w)})
    print(json.dumps({'weights': global_w, 'feature_names': clients[0]['names'], 'labels': clients[0]['labels'], 'rounds': rounds, 'test_metrics': metrics(global_w, clients, 'test'), 'split_counts': {c['id']: {split: len(c[split]) for split in ('train', 'validation', 'test')} for c in clients}, 'split_seed': int(spec.get('split_seed', 42))}))

if __name__ == '__main__':
    try: main()
    except Exception as exc:
        print(json.dumps({'error': str(exc)})); sys.exit(1)
