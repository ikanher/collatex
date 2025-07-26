from fastapi.testclient import TestClient
from compile_service.app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        resp = client.get('/healthz')
        assert resp.status_code == 200
        assert resp.json() == {'status': 'ok'}
