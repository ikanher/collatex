# ruff: noqa
import pytest; pytest.skip('legacy', allow_module_level=True)  # noqa: E402
import base64
import time
import shutil
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
                'contentBase64': base64.b64encode(
                    b'\\documentclass{article}\\begin{document}ok\\end{document}'
                ).decode(),
            }
        ],
        'options': {'synctex': False, 'maxSeconds': 5, 'maxMemoryMb': 512},
    }


def test_pdf_generated(app) -> None:
    if shutil.which('tectonic') is None:
        pytest.skip('tectonic not installed')
    with TestClient(app) as client:
        r = client.post('/compile', json=payload())
        job_id = r.json()['jobId']
        for _ in range(50):
            status = client.get(f'/jobs/{job_id}').json()['status']
            if status in {'done', 'error'}:
                break
            time.sleep(0.2)
        r2 = client.get(f'/pdf/{job_id}')
        assert r2.status_code == 200
        assert r2.headers.get('Cache-Control') == 'no-store'
        assert r2.content.startswith(b'%PDF')
