import base64
import shutil
import time

import pytest
from fastapi.testclient import TestClient

from compile_service.app.main import app


def _payload() -> dict:
    tex = b'\\documentclass{article}\\begin{document}ok\\end{document}'
    return {
        'projectId': 'doc',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': base64.b64encode(tex).decode()}],
        'options': {'synctex': False, 'maxSeconds': 5, 'maxMemoryMb': 512},
    }


@pytest.mark.skipif(shutil.which('tectonic') is None, reason='Tectonic not installed')
def test_compile_metrics() -> None:
    with TestClient(app) as client:
        resp = client.post('/compile', json=_payload())
        assert resp.status_code == 202
        job_id = resp.json()['jobId']
        for _ in range(50):
            status = client.get(f'/jobs/{job_id}').json()['status']
            if status in {'done', 'error'}:
                break
            time.sleep(0.2)
        assert status == 'done'
        metrics = client.get('/metrics').text
        assert 'collatex_compile_total{status="done"} 1' in metrics
