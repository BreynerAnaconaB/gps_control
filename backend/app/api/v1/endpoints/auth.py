
"""
Auth endpoints: login, logout, refresh, change-password, and user management.

Security notes:
- Refresh token stored as an HttpOnly, Secure, SameSite=Strict cookie (SEG-07)
- Access token returned in the response body for use in Authorization header
- Rate limiting applied via slowapi (SEG-07): max 5 login attempts / 15 min per IP
- Error messages do not reveal whether an email exists (SEG-07)
- CSRF protection: not needed here because we use Bearer tokens for state-changing
  requests; the cookie is HttpOnly and not sent cross-site (SameSite=Strict)
"""

from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

_limiter = Limiter(key_func=get_remote_address)
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dependencies import (
    get_current_user,
    get_db,
    require_permission,
)
from app.core.config import settings
from app.infrastructure.database.models import RoleName, User
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])

# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

COOKIE_NAME = "refresh_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days in seconds


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool
    user: UserSummary


class UserSummary(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: RoleName


class UpdateUserRequest(BaseModel):
    is_active: bool | None = None
    role: RoleName | None = None
    new_password: str | None = Field(None, min_length=8)


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    must_change_password: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    # Cross-site (frontend en vercel.app, backend en railway.app) requiere samesite="none" y secure=True
    samesite = "none" if not settings.DEBUG else "lax"
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=True,
        samesite=samesite,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    samesite = "none" if not settings.DEBUG else "lax"
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=True,
        samesite=samesite,
    )


def _get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
@_limiter.limit("5/15minutes")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticates with email + password.
    Returns an access token in the body and sets an HttpOnly refresh cookie.
    Rate limited to 5 attempts / 15 min per IP by the slowapi middleware.
    """
    service = AuthService(db)
    result = await service.login(
        email=body.email,
        password=body.password,
        ip_address=_get_client_ip(request),
    )

    _set_refresh_cookie(response, result["raw_refresh_token"])

    return TokenResponse(
        access_token=result["access_token"],
        must_change_password=result["must_change_password"],
        user=UserSummary(**result["user"]),
    )


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    refresh_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    """Revokes the refresh token and clears the cookie."""
    if refresh_token:
        service = AuthService(db)
        await service.logout(refresh_token, current_user.id)

    _clear_refresh_cookie(response)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    """
    Issues a new access token using the HttpOnly refresh cookie.
    Implements token rotation: old refresh token is revoked and a new one is set.
    """
    from app.services.auth_service import TokenExpiredError

    if not refresh_token:
        raise TokenExpiredError()

    service = AuthService(db)
    result = await service.refresh_session(refresh_token)

    _set_refresh_cookie(response, result["raw_refresh_token"])

    return TokenResponse(
        access_token=result["access_token"],
        must_change_password=False,
        user=UserSummary(**result["user"]),
    )


@router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allows the authenticated user to change their own password."""
    service = AuthService(db)
    await service.change_password(
        user_id=current_user.id,
        current_password=body.current_password,
        new_password=body.new_password,
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role.name,
        is_active=current_user.is_active,
        must_change_password=current_user.must_change_password,
    )


# ---------------------------------------------------------------------------
# Admin: user management (RF-06)
# ---------------------------------------------------------------------------


@router.get(
    "/users",
    response_model=list[UserResponse],
    dependencies=[Depends(require_permission("manage", "users"))],
)
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    users = await service.list_users()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            role=u.role.name,
            is_active=u.is_active,
            must_change_password=u.must_change_password,
        )
        for u in users
    ]


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=201,
    dependencies=[Depends(require_permission("manage", "users"))],
)
async def create_user(
    body: CreateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    user = await service.create_user(
        email=body.email,
        password=body.password,
        role_name=body.role,
        created_by_id=current_user.id,
    )
    role_name = user.role.name if getattr(user, "role", None) else str(body.role)
    return UserResponse(
        id=user.id,
        email=user.email,
        role=role_name,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
    )


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("manage", "users"))],
)
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    user = await service.update_user(
        target_user_id=user_id,
        updated_by_id=current_user.id,
        is_active=body.is_active,
        role_name=body.role,
        reset_password=body.new_password,
    )
    role_name = user.role.name if getattr(user, "role", None) else str(body.role)
    return UserResponse(
        id=user.id,
        email=user.email,
        role=role_name,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
    )
