from fastapi.testclient import TestClient


def test_health(app) -> None:
    with TestClient(app) as client:
        resp = client.get('/healthz')
        assert resp.status_code == 200
        assert resp.json() == {'status': 'ok'}
