import base64
import time
from fastapi.testclient import TestClient
from compile_service.app.main import app

client = TestClient(app)


def payload() -> dict:
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


def test_job_lifecycle() -> None:
    r = client.post('/compile', json=payload())
    assert r.status_code == 202
    job_id = r.json()['jobId']

    r2 = client.get(f'/jobs/{job_id}')
    assert r2.status_code == 200
    assert r2.json()['status'] in {'queued', 'running', 'done', 'error'}

    time.sleep(0.3)
    r3 = client.get(f'/jobs/{job_id}')
    assert r3.status_code == 200
    assert r3.json()['status'] == 'done'
