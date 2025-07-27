import base64
import time

from fastapi.testclient import TestClient




def _payload() -> dict:
    return {
        'projectId': 'p',
        'entryFile': 'main.tex',
        'engine': 'tectonic',
        'files': [{'path': 'main.tex', 'contentBase64': base64.b64encode(b'a').decode()}],
        'options': {},
    }


def test_post_compile_latency(app, monkeypatch) -> None:
    def sleeper(job) -> None:
        time.sleep(0.2)
    monkeypatch.setattr('compile_service.executor.run_compile', sleeper)
    with TestClient(app) as client:
        start = time.perf_counter()
        resp = client.post('/compile', json=_payload())
        elapsed = (time.perf_counter() - start) * 1000
        assert resp.status_code == 202
        assert elapsed < 50
