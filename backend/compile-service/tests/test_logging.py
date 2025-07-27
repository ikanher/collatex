import json
import logging

from fastapi.testclient import TestClient


def test_request_id_logging(app, caplog) -> None:
    caplog.set_level(logging.INFO)
    with TestClient(app) as client:
        client.get('/healthz', headers={'X-Request-Id': 'test-123'})
    for message in caplog.messages:
        try:
            record = json.loads(message)
        except Exception:
            continue
        assert record['request_id'] == 'test-123'
