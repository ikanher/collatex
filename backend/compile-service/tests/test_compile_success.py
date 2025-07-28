# ruff: noqa
import pytest; pytest.skip('legacy', allow_module_level=True)  # noqa: E402
import shutil
import time
import pytest
from fastapi.testclient import TestClient
import base64


def _minimal_payload(tex: bytes) -> dict:
    return {
        'projectId': 'doc',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': base64.b64encode(tex).decode()}],
        'options': {'synctex': False, 'maxSeconds': 5, 'maxMemoryMb': 512},
    }


@pytest.mark.skipif(shutil.which('tectonic') is None, reason='Tectonic not installed')
def test_compile_minimal_success(app) -> None:
    tex = b'\\documentclass{article}\\begin{document}ok\\end{document}'
    payload = _minimal_payload(tex)
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
        assert resp.status_code == 202
        job_id = resp.json()['jobId']
        for _ in range(50):
            status = client.get(f'/jobs/{job_id}').json()['status']
            if status in {'done', 'error'}:
                break
            time.sleep(0.2)
        assert status == 'done'
        pdf = client.get(f'/pdf/{job_id}')
        assert pdf.status_code == 200
        assert pdf.content.startswith(b'%PDF')


@pytest.mark.skipif(shutil.which('tectonic') is None, reason='Tectonic not installed')
def test_compile_timeout(app) -> None:
    tex = b'\\documentclass{article}\\begin{document}\\loop\\iftrue\\repeat\\end{document}'
    payload = _minimal_payload(tex)
    payload['options']['maxSeconds'] = 1
    with TestClient(app) as client:
        resp = client.post('/compile', json=payload)
        assert resp.status_code == 202
        job_id = resp.json()['jobId']
        for _ in range(50):
            status_resp = client.get(f'/jobs/{job_id}').json()
            if status_resp['status'] in {'done', 'error'}:
                break
            time.sleep(0.2)
        assert status_resp['status'] == 'error'
