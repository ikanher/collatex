from fastapi.testclient import TestClient
from .test_validation import minimal_payload


def test_missing_token(app, monkeypatch):
    monkeypatch.setenv('COLLATEX_API_TOKEN', 'test-token')
    with TestClient(app) as client:
        resp = client.post('/compile', json=minimal_payload())
        assert resp.status_code == 401
        assert resp.json()['detail'] == 'unauthorized'


def test_invalid_token(app, monkeypatch):
    monkeypatch.setenv('COLLATEX_API_TOKEN', 'test-token')
    with TestClient(app) as client:
        headers = {'Authorization': 'Bearer wrong'}
        resp = client.post('/compile', json=minimal_payload(), headers=headers)
        assert resp.status_code == 401


def test_valid_token(app, monkeypatch):
    monkeypatch.setenv('COLLATEX_API_TOKEN', 'test-token')
    with TestClient(app) as client:
        headers = {'Authorization': 'Bearer test-token'}
        resp = client.post('/compile', json=minimal_payload(), headers=headers)
        assert resp.status_code == 202
