from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Bus, User
from ..schemas import BusOut

router = APIRouter(prefix="/api", tags=["buses"])


@router.get("/buses", response_model=list[BusOut])
def list_buses(db: Session = Depends(get_db), _: User = Depends(current_user)) -> list[Bus]:
    return db.query(Bus).order_by(Bus.id).all()
