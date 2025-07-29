import os
import pytest

os.environ["COLLATEX_TESTING"] = "1"
from compile_service.app.main import app

@pytest.fixture
def client():
    from starlette.testclient import TestClient
    with TestClient(app) as c:
        yield c
