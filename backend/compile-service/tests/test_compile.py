from __future__ import annotations
import base64
from fastapi.testclient import TestClient
from compile_service.app.main import app

client = TestClient(app)

def test_healthz():
    r = client.get('/healthz')
    assert r.status_code == 200
    assert r.json() == {'status': 'ok'}

def test_compile_and_job_status():
    payload = {
        'projectId': 'doc-123',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': base64.b64encode(b'\\documentclass{article}').decode()}],
        'options': {'synctex': False, 'maxSeconds': 5, 'maxMemoryMb': 512},
    }
    r = client.post('/compile', json=payload)
    assert r.status_code == 202
    job_id = r.json()['jobId']

    r2 = client.get(f'/jobs/{job_id}')
    assert r2.status_code == 200
    body = r2.json()
    assert body['jobId'] == job_id
    assert body['status'] in {'queued', 'running', 'done', 'error'}

