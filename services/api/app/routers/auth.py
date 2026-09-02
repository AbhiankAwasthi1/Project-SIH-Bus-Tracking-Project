from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import hash_password, make_token
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if user is None or user.password_hash != hash_password(body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return LoginResponse(token=make_token(user), email=user.email, role=user.role)
