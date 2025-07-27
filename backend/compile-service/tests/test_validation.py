import base64
import pytest
from fastapi.testclient import TestClient
from compile_service.app.main import app


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
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
    assert resp.status_code == 400
    assert isinstance(resp.json()['detail'], list)


def test_entryfile_missing() -> None:
    payload = minimal_payload()
    payload['entryFile'] = 'missing.tex'
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
    assert resp.status_code == 400
    assert isinstance(resp.json()['detail'], list)


def test_invalid_path() -> None:
    payload = minimal_payload()
    payload['files'][0]['path'] = '../main.tex'
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
    assert resp.status_code == 400
    assert isinstance(resp.json()['detail'], list)


def test_leading_slash_path() -> None:
    payload = minimal_payload()
    payload['files'][0]['path'] = '/main.tex'
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
    assert resp.status_code == 400


def test_forbidden_tex() -> None:
    payload = minimal_payload()
    payload['files'][0]['contentBase64'] = base64.b64encode(b'\\write18{rm -rf /}').decode()
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
    assert resp.status_code == 422


@pytest.mark.parametrize('snippet', [b'\\write0{}', b'\\input{f}', b'\\openout1', b'\\read1'])
def test_non_write18_allowed(snippet: bytes) -> None:
    payload = minimal_payload()
    payload['files'][0]['contentBase64'] = base64.b64encode(snippet).decode()
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
    assert resp.status_code == 202


def test_payload_too_large() -> None:
    payload = minimal_payload()
    big = base64.b64encode(b'a' * (2 * 1024 * 1024 + 1)).decode()
    payload['files'][0]['contentBase64'] = big
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
    assert resp.status_code == 413


def test_json_too_large() -> None:
    payload = minimal_payload()
    payload['pad'] = 'a' * (2 * 1024 * 1024 + 1)
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
    assert resp.status_code == 413
