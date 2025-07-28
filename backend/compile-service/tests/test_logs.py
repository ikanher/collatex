# ruff: noqa
import pytest; pytest.skip('legacy', allow_module_level=True)  # noqa: E402
import base64
import shutil
import time
import pytest
from fastapi.testclient import TestClient


@pytest.mark.skipif(shutil.which('tectonic') is None, reason='tectonic not installed')
def test_error_log_exposed(app) -> None:
    bad_tex = base64.b64encode(b'\\documentclass{article}\n\\begin{document}\n\\textbf{broken}\n').decode()
    payload = {
        'projectId': 'demo',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': bad_tex}],
        'options': {'maxSeconds': 5},
    }
    with TestClient(app) as client:
        r = client.post('/compile', json=payload)
        job_id = r.json()['jobId']
        for _ in range(30):
            resp = client.get(f'/jobs/{job_id}')
            if resp.json()['status'] in {'done', 'error'}:
                break
            time.sleep(0.2)
        data = resp.json()
        assert data['status'] == 'error'
        assert 'error:' in data.get('log', '')
