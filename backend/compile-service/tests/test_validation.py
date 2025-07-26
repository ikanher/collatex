import base64
from fastapi.testclient import TestClient
from compile_service.app.main import app

client = TestClient(app)


def minimal_payload() -> dict:
    return {
        'projectId': 'doc',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [
            {
                'path': 'main.tex',
                'contentBase64': base64.b64encode(b'\\documentclass{article}').decode(),
            }
        ],
        'options': {'synctex': False, 'maxSeconds': 5, 'maxMemoryMb': 512},
    }


def test_invalid_engine() -> None:
    payload = minimal_payload()
    payload['engine'] = 'latex'
    resp = client.post('/compile', json=payload)
    assert resp.status_code == 400


def test_entryfile_missing() -> None:
    payload = minimal_payload()
    payload['entryFile'] = 'missing.tex'
    resp = client.post('/compile', json=payload)
    assert resp.status_code == 400


def test_invalid_path() -> None:
    payload = minimal_payload()
    payload['files'][0]['path'] = '../main.tex'
    resp = client.post('/compile', json=payload)
    assert resp.status_code == 400


def test_forbidden_tex() -> None:
    payload = minimal_payload()
    payload['files'][0]['contentBase64'] = base64.b64encode(b'\\write18{rm -rf /}').decode()
    resp = client.post('/compile', json=payload)
    assert resp.status_code == 422


def test_payload_too_large() -> None:
    payload = minimal_payload()
    big = base64.b64encode(b'a' * (2 * 1024 * 1024 + 1)).decode()
    payload['files'][0]['contentBase64'] = big
    resp = client.post('/compile', json=payload)
    assert resp.status_code == 413
