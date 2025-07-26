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


def test_pdf_not_found() -> None:
    r = client.post('/compile', json=payload())
    job_id = r.json()['jobId']
    time.sleep(0.3)
    r2 = client.get(f'/pdf/{job_id}')
    assert r2.status_code == 404
