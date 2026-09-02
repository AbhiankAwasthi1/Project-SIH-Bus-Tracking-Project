from __future__ import annotations

import hashlib
import hmac
import time
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User


def hash_password(password: str) -> str:
    return hashlib.sha256(f"{settings.secret_key}:{password}".encode()).hexdigest()


def make_token(user: User) -> str:
    exp = int(time.time()) + 60 * 60 * 24
    payload = f"{user.id}:{user.email}:{user.role}:{exp}"
    sig = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def parse_token(token: str) -> dict:
    try:
        user_id, email, role, exp, sig = token.split(":", 4)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    payload = f"{user_id}:{email}:{role}:{exp}"
    expected = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=401, detail="Invalid token")
    if int(exp) < time.time():
        raise HTTPException(status_code=401, detail="Token expired")
    return {"id": user_id, "email": email, "role": role}


def current_user(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    data = parse_token(authorization.split(" ", 1)[1].strip())
    user = db.get(User, data["id"])
    if user is None:
        raise HTTPException(status_code=401, detail="Unknown user")
    return user
