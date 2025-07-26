from fastapi.testclient import TestClient
from compile_service.app.main import app

client = TestClient(app)


def test_health() -> None:
    resp = client.get('/healthz')
    assert resp.status_code == 200
    assert resp.json() == {'status': 'ok'}
