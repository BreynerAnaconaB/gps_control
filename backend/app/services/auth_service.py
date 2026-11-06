
"""
AuthService — login, logout, token refresh and user management.

Responsibilities:
  - Authenticate users (email + password) against the local DB
  - Issue / revoke JWT access tokens and opaque refresh tokens
  - Enforce account policies (active, must_change_password)
  - Provide helpers for the Admin to manage users (RF-06)
  - Emit AuditLog entries for security-relevant events (SEG-09, RF-26)

This service does NOT know about HTTP: no Request, no Response objects here.
The auth endpoint (app/api/v1/endpoints/auth.py) is responsible for cookies.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.infrastructure.database.models import AuditLog, RefreshToken, Role, RoleName, User


# ---------------------------------------------------------------------------
# Domain-level exceptions
# ---------------------------------------------------------------------------


class InvalidCredentialsError(AppException):
    def __init__(self) -> None:
        super().__init__(
            # Intentionally vague: do not leak whether the email exists (SEG-07)
            message="Credenciales inválidas",
            code="INVALID_CREDENTIALS",
            status_code=401,
        )


class AccountInactiveError(AppException):
    def __init__(self) -> None:
        super().__init__(
            message="La cuenta está desactivada",
            code="ACCOUNT_INACTIVE",
            status_code=403,
        )


class TokenExpiredError(AppException):
    def __init__(self) -> None:
        super().__init__(
            message="La sesión ha expirado",
            code="TOKEN_EXPIRED",
            status_code=401,
        )


class MustChangePasswordError(AppException):
    def __init__(self) -> None:
        super().__init__(
            message="Debes cambiar tu contraseña antes de continuar",
            code="MUST_CHANGE_PASSWORD",
            status_code=403,
        )


# ---------------------------------------------------------------------------
# AuthService
# ---------------------------------------------------------------------------


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .where(User.email == email.lower().strip())
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        return result.scalar_one_or_none()

    async def _get_user_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        return result.scalar_one_or_none()

    async def _emit_audit(
        self,
        action: str,
        resource: str,
        user_id: int | None = None,
        resource_id: str | None = None,
        detail: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address,
        )
        self.db.add(log)
        # Flushed with the outer transaction commit

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------

    async def login(
        self,
        email: str,
        password: str,
        ip_address: str | None = None,
    ) -> dict:
        """
        Authenticates the user and returns access_token + raw refresh_token.
        Raises InvalidCredentialsError or AccountInactiveError on failure.
        """
        user = await self._get_user_by_email(email)

        # Always run verify_password even if user not found to avoid timing attacks
        fake_hash = "$argon2id$v=19$m=65536,t=2,p=2$fake$fake"
        actual_hash = user.password_hash if user else fake_hash

        if not verify_password(password, actual_hash) or user is None:
            await self._emit_audit(
                action="login_failed",
                resource="auth",
                detail=f"email={email}",
                ip_address=ip_address,
            )
            await self.db.commit()
            raise InvalidCredentialsError()

        if not user.is_active:
            raise AccountInactiveError()

        access_token = create_access_token(
            user_id=user.id,
            role=user.role.name,
        )

        raw_refresh = generate_refresh_token()
        refresh_hash = hash_refresh_token(raw_refresh)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )

        self.db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=refresh_hash,
                expires_at=expires_at,
            )
        )

        await self._emit_audit(
            action="login",
            resource="auth",
            user_id=user.id,
            ip_address=ip_address,
        )

        await self.db.commit()

        return {
            "access_token": access_token,
            "raw_refresh_token": raw_refresh,
            "must_change_password": user.must_change_password,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role.name,
                "is_active": user.is_active,
            },
        }

    # ------------------------------------------------------------------
    # Logout
    # ------------------------------------------------------------------

    async def logout(self, raw_refresh_token: str, user_id: int) -> None:
        """Revokes the refresh token so it cannot be reused."""
        token_hash = hash_refresh_token(raw_refresh_token)

        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.user_id == user_id,
            )
        )
        token = result.scalar_one_or_none()

        if token:
            token.revoked = True
            await self.db.commit()

    # ------------------------------------------------------------------
    # Refresh session
    # ------------------------------------------------------------------

    async def refresh_session(self, raw_refresh_token: str) -> dict:
        """
        Validates the refresh token and issues a new access token.
        Implements refresh token rotation (SEG-07).
        """
        token_hash = hash_refresh_token(raw_refresh_token)

        result = await self.db.execute(
            select(RefreshToken)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked.is_(False),
            )
            .options(
                selectinload(RefreshToken.user)
                .selectinload(User.role)
                .selectinload(Role.permissions)
            )
        )
        stored = result.scalar_one_or_none()

        if stored is None:
            raise TokenExpiredError()

        now = datetime.now(timezone.utc)
        if stored.expires_at.replace(tzinfo=timezone.utc) < now:
            stored.revoked = True
            await self.db.commit()
            raise TokenExpiredError()

        if not stored.user.is_active:
            raise AccountInactiveError()

        # Rotate: revoke old, issue new refresh token
        stored.revoked = True

        new_raw = generate_refresh_token()
        new_hash = hash_refresh_token(new_raw)
        new_expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        self.db.add(
            RefreshToken(
                user_id=stored.user_id,
                token_hash=new_hash,
                expires_at=new_expires,
            )
        )

        access_token = create_access_token(
            user_id=stored.user.id,
            role=stored.user.role.name,
        )

        await self.db.commit()

        return {
            "access_token": access_token,
            "raw_refresh_token": new_raw,
            "user": {
                "id": stored.user.id,
                "email": stored.user.email,
                "role": stored.user.role.name,
                "is_active": stored.user.is_active,
            },
        }

    # ------------------------------------------------------------------
    # Get user by ID (used by dependency injection)
    # ------------------------------------------------------------------

    async def get_user_by_id(self, user_id: int) -> User | None:
        return await self._get_user_by_id(user_id)

    # ------------------------------------------------------------------
    # Change password (RF-06: first login flow)
    # ------------------------------------------------------------------

    async def change_password(
        self,
        user_id: int,
        current_password: str,
        new_password: str,
    ) -> None:
        user = await self._get_user_by_id(user_id)

        if user is None or not verify_password(current_password, user.password_hash):
            raise InvalidCredentialsError()

        user.password_hash = hash_password(new_password)
        user.must_change_password = False

        await self._emit_audit(
            action="change_password",
            resource="users",
            user_id=user_id,
            resource_id=str(user_id),
        )
        await self.db.commit()

    # ------------------------------------------------------------------
    # Admin: create user (RF-06)
    # ------------------------------------------------------------------

    async def create_user(
        self,
        email: str,
        password: str,
        role_name: RoleName,
        created_by_id: int,
    ) -> User:
        # Verify role exists
        result = await self.db.execute(
            select(Role).where(Role.name == role_name)
        )
        role = result.scalar_one_or_none()

        if role is None:
            raise AppException(
                message=f"Role '{role_name}' not found",
                code="ROLE_NOT_FOUND",
                status_code=404,
            )

        normalized_email = email.lower().strip()

        # Check duplicate
        existing = await self._get_user_by_email(normalized_email)
        if existing:
            raise AppException(
                message="Ya existe un usuario con ese correo",
                code="EMAIL_ALREADY_EXISTS",
                status_code=409,
            )

        new_user = User(
            email=normalized_email,
            password_hash=hash_password(password),
            role_id=role.id,
            is_active=True,
            must_change_password=True,  # RF-06: must change on first login
        )
        self.db.add(new_user)
        await self.db.flush()  # populate new_user.id

        await self._emit_audit(
            action="create_user",
            resource="users",
            user_id=created_by_id,
            resource_id=str(new_user.id),
            detail=f"email={normalized_email}, role={role_name}",
        )
        await self.db.commit()
        await self.db.refresh(new_user)

        return new_user

    # ------------------------------------------------------------------
    # Admin: update user (RF-06)
    # ------------------------------------------------------------------

    async def update_user(
        self,
        target_user_id: int,
        updated_by_id: int,
        is_active: bool | None = None,
        role_name: RoleName | None = None,
        reset_password: str | None = None,
    ) -> User:
        user = await self._get_user_by_id(target_user_id)

        if user is None:
            raise AppException(
                message="Usuario no encontrado",
                code="USER_NOT_FOUND",
                status_code=404,
            )

        changes = []

        if is_active is not None and user.is_active != is_active:
            user.is_active = is_active
            changes.append(f"is_active={is_active}")

        if role_name is not None:
            result = await self.db.execute(
                select(Role).where(Role.name == role_name)
            )
            role = result.scalar_one_or_none()
            if role and user.role_id != role.id:
                user.role_id = role.id
                changes.append(f"role={role_name}")

        if reset_password is not None:
            user.password_hash = hash_password(reset_password)
            user.must_change_password = True
            changes.append("password_reset")

        if changes:
            await self._emit_audit(
                action="update_user",
                resource="users",
                user_id=updated_by_id,
                resource_id=str(target_user_id),
                detail=", ".join(changes),
            )
            await self.db.commit()
            await self.db.refresh(user)

        return user

    # ------------------------------------------------------------------
    # Admin: list users
    # ------------------------------------------------------------------

    async def list_users(self) -> list[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.role)).order_by(User.id)
        )
        return list(result.scalars().all())

