
import asyncio

from app.infrastructure.wialon.client import WialonClient
from app.core.exceptions import WialonAPIException


class WialonSessionManager:
    INVALID_SESSION_ERROR = 1

    def __init__(self, client: WialonClient | None = None):
        self.client = client or WialonClient()
        self._session_id: str | None = None
        self._lock = asyncio.Lock()

    async def get_session(self) -> str:
        if self._session_id:
            return self._session_id

        async with self._lock:
            if not self._session_id:
                result = await self.client.login()
                self._session_id = result["eid"]

        return self._session_id

    async def _refresh_session(self, old_session_id: str) -> str:
        async with self._lock:
            if self._session_id == old_session_id:
                self._session_id = None

            if not self._session_id:
                result = await self.client.login()
                self._session_id = result["eid"]

            return self._session_id

    async def call(self, service: str, params: dict) -> dict:
        session_id = await self.get_session()

        try:
            return await self.client.request(
                service=service,
                params=params,
                session_id=session_id,
            )

        except WialonAPIException as exc:
            if exc.api_error_code != self.INVALID_SESSION_ERROR:
                raise

            new_session_id = await self._refresh_session(session_id)

            return await self.client.request(
                service=service,
                params=params,
                session_id=new_session_id,
            )
