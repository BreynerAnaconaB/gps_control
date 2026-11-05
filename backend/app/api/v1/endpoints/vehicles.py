
from datetime import datetime, timezone
from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.v1.dependencies import (
    get_vehicle_cache,
    get_wialon_session_manager,
)
from app.api.v1.schemas.vehicle import (
    VehiclePageResponse,
    VehicleResponse,
)
from app.infrastructure.wialon.session import WialonSessionManager
from app.services.vehicle_cache import AsyncTTLCache
from app.services.vehicle_status import (
    calculate_vehicle_status,
    heading_to_direction,
)


router = APIRouter()


async def load_vehicles_from_wialon(
    session_manager: WialonSessionManager,
) -> list[VehicleResponse]:
    params = {
        "spec": {
            "itemsType": "avl_unit",
            "propName": "sys_name",
            "propValueMask": "*",
            "sortType": "sys_name",
        },
        "force": 1,
        "flags": 1025,
        "from": 0,
        "to": 0,
    }

    result = await session_manager.call("core/search_items", params)

    vehicles = []

    for vehicle in result.get("items", []):
        position = vehicle.get("pos") or {}
        timestamp = position.get("t")

        last_position = (
            datetime.fromtimestamp(timestamp, tz=timezone.utc)
            if timestamp
            else None
        )

        latitude = position.get("y")
        longitude = position.get("x")
        speed = position.get("s")
        heading = position.get("c")

        vehicles.append(
            VehicleResponse(
                id=vehicle["id"],
                name=vehicle["nm"],
                latitude=latitude,
                longitude=longitude,
                speed=speed,
                heading=heading,
                altitude=position.get("z"),
                satellites=position.get("sc"),
                last_position=last_position,
                status=calculate_vehicle_status(
                    latitude=latitude,
                    longitude=longitude,
                    speed=speed,
                    last_position=last_position,
                ),
                direction=heading_to_direction(heading),
            )
        )

    return vehicles


async def get_cached_vehicles(
    session_manager: WialonSessionManager,
    cache: AsyncTTLCache[list[VehicleResponse]],
) -> list[VehicleResponse]:
    async def loader():
        return await load_vehicles_from_wialon(session_manager)

    return await cache.get_or_load(loader)


@router.get(
    "/vehicles",
    response_model=VehiclePageResponse,
    tags=["Vehicles"],
)
async def get_vehicles(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, min_length=1, max_length=100),
    status: Literal["moving", "stopped", "no_signal"] | None = Query(None),
    session_manager: WialonSessionManager = Depends(
        get_wialon_session_manager
    ),
    cache: AsyncTTLCache[list[VehicleResponse]] = Depends(
        get_vehicle_cache
    ),
):
    vehicles = await get_cached_vehicles(session_manager, cache)

    if search:
        normalized_search = search.strip().casefold()
        vehicles = [
            vehicle
            for vehicle in vehicles
            if normalized_search in vehicle.name.casefold()
        ]

    if status:
        vehicles = [
            vehicle
            for vehicle in vehicles
            if vehicle.status == status
        ]

    total = len(vehicles)
    pages = ceil(total / page_size)

    start = (page - 1) * page_size
    end = start + page_size

    return VehiclePageResponse(
        items=vehicles[start:end],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
