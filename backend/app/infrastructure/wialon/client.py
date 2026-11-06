
import json

import httpx

from app.core.config import settings
from app.core.exceptions import (
    WialonAuthenticationException,
    WialonUnavailableException,
    WialonAPIException,
)


class WialonClient:
    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
    ):
        self.base_url = (
            base_url if base_url is not None else settings.WIALON_BASE_URL
        )
        self.token = token if token is not None else settings.WIALON_TOKEN

        if not self.base_url or not self.token:
            raise ValueError("Wialon configuration is missing")

        base_url = self.base_url.rstrip("/")

        if base_url.endswith("/wialon/ajax.html"):
            self.api_url = base_url
        else:
            self.api_url = f"{base_url}/wialon/ajax.html"

        self.timeout = httpx.Timeout(15.0)

    async def _post(self, payload: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.api_url, data=payload)
                response.raise_for_status()
                result = response.json()

        except (httpx.HTTPError, ValueError) as exc:
            raise WialonUnavailableException() from exc

        if not isinstance(result, (dict, list)):
            raise WialonUnavailableException(
                "Invalid response received from Wialon"
            )

        return result

    async def login(self) -> dict:
        payload = {
            "svc": "token/login",
            "params": json.dumps({"token": self.token}),
        }

        result = await self._post(payload)

        if result.get("error") or not result.get("eid"):
            raise WialonAuthenticationException()

        return result

    async def request(
        self,
        service: str,
        params: dict,
        session_id: str,
    ) -> dict:
        payload = {
            "svc": service,
            "params": json.dumps(params),
            "sid": session_id,
        }

        result = await self._post(payload)

        if isinstance(result, dict) and "error" in result:
            error_code = result["error"]

            raise WialonAPIException(
                message="Wialon API request failed",
                api_error_code=error_code,
            )

        return result
