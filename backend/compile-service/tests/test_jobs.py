import base64
import shutil
import time
import pytest
from fastapi.testclient import TestClient


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


def test_job_lifecycle(app) -> None:
    if shutil.which('tectonic') is None:
        pytest.skip('tectonic not installed')
    with TestClient(app) as client:
        r = client.post('/compile', json=payload())
        assert r.status_code == 202
        job_id = r.json()['jobId']

        for _ in range(50):
            r2 = client.get(f'/jobs/{job_id}')
            assert r2.status_code == 200
            if r2.json()['status'] in {'done', 'error'}:
                break
            time.sleep(0.2)
        r3 = client.get(f'/jobs/{job_id}')
        assert r3.status_code == 200
        assert r3.json()['status'] in {'done', 'error'}
