"""Claim remote experiments from the live PostgreSQL queue and run them once."""

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone

from production_fl.orchestrator import _db_connection, run, stop_flower_run, stop_workers, WorkerCleanupError


def claim_one():
    with _db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""SELECT id, name, config_json FROM fl_experiments
                WHERE status = 'Queued' AND config_json::jsonb ->> 'deploymentMode' = 'remote-secure'
                ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED""")
            row = cur.fetchone()
            if not row:
                return None
            experiment_id, name, raw_config = row
            config = json.loads(raw_config)
            cur.execute("UPDATE fl_experiments SET status = 'Running', result_json = %s WHERE id = %s",
                (json.dumps({'startedAt': datetime.now(timezone.utc).isoformat(),
                             'deploymentMode': 'remote-secure'}), experiment_id))
            return {
                'experimentId': experiment_id, 'name': name,
                'datasets': config['remoteDatasets'], 'rounds': config['rounds'],
                'schemaS3Uri': config['schemaS3Uri'], 'schemaSha256': config['schemaSha256'],
                'localEpochs': config['localEpochs'], 'learningRate': config['learningRate'],
                'noiseMultiplier': config['noiseMultiplier'],
                'metricNoiseMultiplier': config['metricNoiseMultiplier'],
                'clippingNorm': config['clippingNorm'],
                'normalizationCount': config['normalizationCount'],
                'splitSeed': config['splitSeed'], 'privacyDelta': config['privacyPolicy']['delta'],
            }


def recover_abandoned():
    with _db_connection() as conn:
        rows = conn.execute("""SELECT id, status, config_json, result_json FROM fl_experiments
            WHERE config_json::jsonb ->> 'deploymentMode' = 'remote-secure'
              AND (status = 'Running' OR (status IN ('Completed', 'Failed') AND result_json::jsonb ->> 'cleanupPending' = 'true'))""").fetchall()
    for experiment_id, status, raw_config, raw_result in rows:
        config = json.loads(raw_config)
        result = json.loads(raw_result)
        run_id = result.get('flowerRunId')
        if status == 'Running' and run_id:
            stop_flower_run(run_id)
        stop_workers(config['remoteDatasets'], experiment_id)
        with _db_connection() as conn:
            if status == 'Running':
                conn.execute("UPDATE fl_experiments SET status = 'Failed', result_json = %s WHERE id = %s AND status = 'Running'",
                    (json.dumps({'error': 'Coordinator restarted during remote training; privacy budget was not refunded'}),
                     experiment_id))
            else:
                result['cleanupPending'] = False
                conn.execute('UPDATE fl_experiments SET result_json = %s WHERE id = %s AND status = %s',
                    (json.dumps(result), experiment_id, status))
        logging.warning('Recovered interrupted remote experiment %s', experiment_id)


def _watch_leader(connection):
    while True:
        time.sleep(30)
        try:
            connection.execute('SELECT 1')
            connection.commit()
        except Exception:
            logging.critical('Coordinator database leadership connection was lost')
            os._exit(1)


def main():
    leader = _db_connection()
    acquired = leader.execute('SELECT pg_try_advisory_lock(%s)', (19073101,)).fetchone()[0]
    leader.commit()
    if not acquired:
        raise RuntimeError('another remote federation coordinator is already active')
    threading.Thread(target=_watch_leader, args=(leader,), daemon=True).start()
    recover_abandoned()
    while True:
        spec = claim_one()
        if spec:
            try:
                run(spec)
            except Exception as exc:
                # run() records a generic failure without exposing patient data.
                logging.error('Remote experiment %s failed (%s)', spec['experimentId'], type(exc).__name__)
                if isinstance(exc, WorkerCleanupError):
                    raise
                with _db_connection() as conn:
                    status = conn.execute('SELECT status FROM fl_experiments WHERE id = %s',
                        (spec['experimentId'],)).fetchone()[0]
                if status == 'Running':
                    raise
        else:
            time.sleep(int(os.environ.get('FL_QUEUE_POLL_SECONDS', '10')))


if __name__ == '__main__':
    main()
