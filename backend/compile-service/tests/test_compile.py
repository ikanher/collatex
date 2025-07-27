import base64
import shutil
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.mark.skipif(shutil.which('tectonic') is None, reason='tectonic not installed')
def test_compile_minimal(app) -> None:
    root = Path(__file__).resolve().parents[3]
    main = (root / 'examples/minimal/main.tex').read_bytes()
    payload = {
        'projectId': 'demo',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': base64.b64encode(main).decode()}],
        'options': {'synctex': False, 'maxSeconds': 20, 'maxMemoryMb': 512},
    }
    with TestClient(app) as client:
        r = client.post('/compile', json=payload)
        assert r.status_code == 202
        job_id = r.json()['jobId']
        for _ in range(50):
            resp = client.get(f'/jobs/{job_id}')
            if resp.json()['status'] in {'done', 'error'}:
                break
            time.sleep(0.2)
        assert resp.json()['status'] == 'done'
        pdf = client.get(f'/pdf/{job_id}')
        assert pdf.status_code == 200
        assert pdf.content.startswith(b'%PDF')


def test_invalid_base64(app) -> None:
    payload = {
        'projectId': 'demo',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': '!invalid!'}],
        'options': {},
    }
    with TestClient(app) as client:
        r = client.post('/compile', json=payload)
        assert r.status_code == 400


def test_oversized_input(app) -> None:
    big = base64.b64encode(b'a' * (2 * 1024 * 1024 + 1)).decode()
    payload = {
        'projectId': 'demo',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': big}],
        'options': {},
    }
    with TestClient(app) as client:
        r = client.post('/compile', json=payload)
        assert r.status_code == 413


def test_dangerous_tex(app) -> None:
    bad = base64.b64encode(b'\\write18{rm -rf /}').decode()
    payload = {
        'projectId': 'demo',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': bad}],
        'options': {},
    }
    with TestClient(app) as client:
        r = client.post('/compile', json=payload)
        assert r.status_code in {400, 422}


@pytest.mark.skipif(shutil.which('tectonic') is None, reason='tectonic not installed')
def test_compile_error(app) -> None:
    bad_tex = base64.b64encode(b'\\documentclass{article}').decode()
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
        assert resp.json()['status'] == 'error'
        assert resp.json()['logs']
