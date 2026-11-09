
import asyncio

import pytest

from app.services.vehicle_cache import AsyncTTLCache


@pytest.mark.asyncio
async def test_cache_reuses_data_before_expiration():
    cache = AsyncTTLCache(ttl_seconds=20)
    calls = 0

    async def loader():
        nonlocal calls
        calls += 1
        return ["vehicle-1", "vehicle-2"]

    first = await cache.get_or_load(loader)
    second = await cache.get_or_load(loader)

    assert first == second
    assert calls == 1


@pytest.mark.asyncio
async def test_cache_can_be_invalidated():
    cache = AsyncTTLCache(ttl_seconds=20)
    calls = 0

    async def loader():
        nonlocal calls
        calls += 1
        return calls

    await cache.get_or_load(loader)
    await cache.invalidate()
    result = await cache.get_or_load(loader)

    assert result == 2
    assert calls == 2


@pytest.mark.asyncio
async def test_concurrent_requests_share_one_load():
    cache = AsyncTTLCache(ttl_seconds=20)
    calls = 0

    async def loader():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return ["vehicle-1"]

    results = await asyncio.gather(
        cache.get_or_load(loader),
        cache.get_or_load(loader),
        cache.get_or_load(loader),
    )

    assert calls == 1
    assert results == [["vehicle-1"]] * 3


@pytest.mark.asyncio
async def test_stale_while_revalidate_serves_stale_and_refreshes():
    cache = AsyncTTLCache(ttl_seconds=0, stale_ttl_seconds=10)
    counter = 0

    async def loader():
        nonlocal counter
        counter += 1
        await asyncio.sleep(0.01)
        return f"version-{counter}"

    # Primera carga
    first = await cache.get_or_load(loader)
    assert first == "version-1"
    assert counter == 1

    # Segunda carga inmediata: TTL (0s) vencido, pero dentro de stale_ttl (10s).
    # Debe retornar "version-1" de inmediato y lanzar tarea en background.
    stale = await cache.get_or_load(loader)
    assert stale == "version-1"

    # Esperamos a que la tarea en background finalice
    await asyncio.sleep(0.05)
    assert counter == 2

    # Siguiente carga ya tiene la nueva versión revalidada
    refreshed = await cache.get_or_load(loader)
    assert refreshed == "version-2"

