# ruff: noqa: F401
import importlib
from fastapi.testclient import TestClient
import compile_service.app.state as state
import pytest


@pytest.fixture
def cors_app(monkeypatch):
    monkeypatch.setenv('COLLATEX_STATE', 'memory')
    monkeypatch.setenv('COLLATEX_ALLOWED_ORIGINS', 'http://allowed')
    importlib.reload(state)
    import compile_service.app.main as main
    importlib.reload(main)
    return main.app


def test_preflight_allowed(cors_app):
    with TestClient(cors_app) as client:
        r = client.options(
            '/compile',
            headers={
                'Origin': 'http://allowed',
                'Access-Control-Request-Method': 'POST',
            },
        )
        assert r.status_code in {200, 204}


def test_preflight_with_project_token(cors_app):
    with TestClient(cors_app) as client:
        r = client.options(
            '/compile?project=missing',
            headers={
                'Origin': 'http://allowed',
                'Access-Control-Request-Method': 'POST',
            },
        )
        assert r.status_code in {200, 204}


def test_preflight_forbidden(cors_app):
    with TestClient(cors_app) as client:
        r = client.options(
            '/compile',
            headers={
                'Origin': 'http://evil',
                'Access-Control-Request-Method': 'POST',
            },
        )
        assert r.status_code in {400, 403}
