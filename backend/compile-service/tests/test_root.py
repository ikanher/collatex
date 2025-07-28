import pytest
from httpx import AsyncClient, ASGITransport

from compile_service.app.main import app

@pytest.mark.asyncio
async def test_root() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        resp = await client.get('/')
        assert resp.status_code == 200
        assert resp.json()['message'] == 'Collatex backend'
