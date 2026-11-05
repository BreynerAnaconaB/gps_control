from unittest.mock import AsyncMock, patch

import pytest

from app.infrastructure.wialon.client import WialonClient


@pytest.mark.asyncio
async def test_wialon_login_returns_session():
    client = WialonClient()

    mock_response = AsyncMock()
    mock_response.json.return_value = {
        "eid": "fake-session-id",
        "user": {"nm": "demoApps"},
    }
    mock_response.raise_for_status = lambda: None

    with patch(
        "app.infrastructure.wialon.client.httpx.AsyncClient"
    ) as mock_http:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = mock_response

        mock_http.return_value.__aenter__.return_value = mock_instance

        result = await client.login()

    assert result["eid"] == "fake-session-id"