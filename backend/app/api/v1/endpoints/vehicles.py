
from datetime import datetime, timezone
from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.v1.dependencies import (
    get_vehicle_cache,
    get_wialon_gateway,
    get_wialon_session_manager,
    require_permission,
)
from app.api.v1.schemas.custom_field import (
    CustomFieldResponse,
    CustomFieldUpsert,
)
from app.api.v1.schemas.vehicle import (
    VehicleDetailResponse,
    VehiclePageResponse,
    VehicleResponse,
)
from app.core.exceptions import WialonAPIException
from app.infrastructure.wialon.gateway import WialonGateway
from app.infrastructure.wialon.session import WialonSessionManager
from app.services.vehicle_cache import AsyncTTLCache
from app.services.vehicle_detail import VehicleDetailService
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

    # Mapeo de conductores asignados por vehículo
    driver_map: dict[int, tuple[int, str]] = {}
    try:
        gateway = WialonGateway(session_manager)
        resource_id = await gateway.get_first_resource_id()
        drivers = await gateway.get_drivers(resource_id)
        for d in drivers:
            bu = d.get("bu")
            if bu:
                driver_map[int(bu)] = (int(d["id"]), str(d.get("n", "")))
    except Exception:
        pass

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

        driver_info = driver_map.get(vehicle["id"])

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
                assigned_driver_id=driver_info[0] if driver_info else None,
                assigned_driver_name=driver_info[1] if driver_info else None,
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
    dependencies=[Depends(require_permission("read", "vehicles"))],
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


@router.get(
    "/vehicles/{vehicle_id}",
    response_model=VehicleDetailResponse,
    tags=["Vehicles"],
    dependencies=[Depends(require_permission("read", "vehicles"))],
)
async def get_vehicle_detail(
    vehicle_id: int,
    session_manager: WialonSessionManager = Depends(
        get_wialon_session_manager
    ),
):
    service = VehicleDetailService(session_manager)

    try:
        detail = await service.get_vehicle_detail(vehicle_id)

    except WialonAPIException as exc:
        if exc.api_error_code == 7:
            raise HTTPException(
                status_code=404,
                detail="Vehicle not found",
            ) from exc

        raise

    if not detail:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    return detail


@router.patch(
    "/vehicles/{vehicle_id}/custom-fields",
    response_model=list[CustomFieldResponse],
    tags=["Vehicles"],
    dependencies=[Depends(require_permission("write", "vehicles"))],
)
async def upsert_vehicle_custom_fields(
    vehicle_id: int,
    fields: list[CustomFieldUpsert],
    gateway: WialonGateway = Depends(get_wialon_gateway),
):
    results = []
    for f in fields:
        field_id = f.field_id or 0
        res = await gateway.update_vehicle_custom_field(
            unit_id=vehicle_id,
            field_id=field_id,
            name=f.name,
            value=f.value,
        )
        # res has structure [id, {n: ..., v: ...}] or dict
        res_id = res[0] if isinstance(res, (list, tuple)) else res.get("id", field_id)
        results.append(
            CustomFieldResponse(
                field_id=int(res_id) if res_id else field_id,
                name=f.name,
                value=f.value,
            )
        )
    return results


@router.delete(
    "/vehicles/{vehicle_id}/custom-fields/{field_id}",
    status_code=204,
    tags=["Vehicles"],
    dependencies=[Depends(require_permission("write", "vehicles"))],
)
async def delete_vehicle_custom_field(
    vehicle_id: int,
    field_id: int,
    gateway: WialonGateway = Depends(get_wialon_gateway),
):
    await gateway.delete_vehicle_custom_field(
        unit_id=vehicle_id,
        field_id=field_id,
    )


@router.get(
    "/geofences",
    tags=["Vehicles"],
    dependencies=[Depends(require_permission("read", "vehicles"))],
)
async def list_geofences(
    gateway: WialonGateway = Depends(get_wialon_gateway),
):
    """
    Lista las geocercas configuradas en Wialon para visualizacion en mapa (Bonus 12).
    """
    resource_id = await gateway.get_first_resource_id()
    return await gateway.get_geofences(resource_id)


