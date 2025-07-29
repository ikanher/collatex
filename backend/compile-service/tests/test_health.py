# ruff: noqa
#import pytest; pytest.skip('legacy', allow_module_level=True)  # noqa: E402


def test_health(client) -> None:
    resp = client.get('/healthz')
    assert resp.status_code == 200
    assert resp.json() == {'status': 'ok'}
