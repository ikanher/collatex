import base64
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


def test_write18_rejected() -> None:
    payload = minimal_payload()
    payload['files'][0]['contentBase64'] = base64.b64encode(b'\\write18{ls}').decode()
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
        assert resp.status_code == 422
        assert resp.json()['detail'] == 'shell escape disallowed'
