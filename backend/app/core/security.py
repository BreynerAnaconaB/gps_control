
"""
Security utilities: password hashing with Argon2 and JWT token management.

Argon2 is recommended by OWASP over bcrypt for new systems (SEG-02).
Tokens use short-lived access tokens (15 min) and long-lived refresh tokens
stored as HttpOnly cookies (SEG-07).
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import JWTError, jwt

from app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

_ph = PasswordHasher(
    time_cost=2,
    memory_cost=65536,  # 64 MiB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def hash_password(plain: str) -> str:
    """Returns an Argon2id hash of the plaintext password."""
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Returns True if `plain` matches the Argon2id `hashed`.
    Returns False instead of raising on mismatch (SEG-07: no info leakage).
    """
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(hashed: str) -> bool:
    """True when Argon2 parameters have been updated and the hash is stale."""
    return _ph.check_needs_rehash(hashed)


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """
    Decodes and validates the access token.
    Raises JWTError on any validation failure.
    """
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])

    if payload.get("type") != "access":
        raise JWTError("Not an access token")

    return payload


# ---------------------------------------------------------------------------
# Refresh tokens  (opaque random token stored hashed in DB)
# ---------------------------------------------------------------------------


def generate_refresh_token() -> str:
    """Returns a 64-byte URL-safe random string (the raw token for the cookie)."""
    return secrets.token_urlsafe(64)


def hash_refresh_token(raw: str) -> str:
    """SHA-256 of the raw token for secure storage in DB."""
    return hashlib.sha256(raw.encode()).hexdigest()

