import base64
import os
import shutil
import time
import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mem_app(monkeypatch):
    monkeypatch.setenv('COLLATEX_STATE', 'memory')
    import compile_service.app.state as state
    importlib.reload(state)
    import compile_service.app.main as main
    importlib.reload(main)
    yield main.app


@pytest.mark.skipif(os.name != 'posix', reason='posix only')
@pytest.mark.skipif(shutil.which('tectonic') is None, reason='tectonic not installed')
def test_cpu_limit(mem_app):
    tex = b'\\documentclass{article}\\begin{document}\\loop\\iftrue\\repeat\\end{document}'
    payload = {
        'projectId': 'cpu',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': base64.b64encode(tex).decode()}],
        'options': {'maxSeconds': 1, 'maxMemoryMb': 512},
    }
    with TestClient(mem_app) as client:
        r = client.post('/compile', json=payload)
        assert r.status_code == 202
        job_id = r.json()['jobId']
        for _ in range(50):
            resp = client.get(f'/jobs/{job_id}').json()
            if resp['status'] in {'done', 'error'}:
                break
            time.sleep(0.2)
        assert resp['status'] == 'error'
        assert 'resource' in (resp.get('error') or '')
        metrics = client.get('/metrics').text
        assert 'collatex_compile_total{status="limit"} 1' in metrics


@pytest.mark.skipif(os.name != 'posix', reason='posix only')
@pytest.mark.skipif(shutil.which('tectonic') is None, reason='tectonic not installed')
def test_memory_limit(mem_app):
    tex = b'\\documentclass{article}\\begin{document}ok\\end{document}'
    payload = {
        'projectId': 'mem',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': base64.b64encode(tex).decode()}],
        'options': {'maxSeconds': 5, 'maxMemoryMb': 64},
    }
    with TestClient(mem_app) as client:
        r = client.post('/compile', json=payload)
        assert r.status_code == 202
        job_id = r.json()['jobId']
        for _ in range(50):
            resp = client.get(f'/jobs/{job_id}').json()
            if resp['status'] in {'done', 'error'}:
                break
            time.sleep(0.2)
        assert resp['status'] == 'error'
        assert 'resource' in (resp.get('error') or '')
        metrics = client.get('/metrics').text
        assert 'collatex_compile_total{status="limit"} 1' in metrics
