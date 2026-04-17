"""
Users router — CRUD for user management (admin only).
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db, User

router = APIRouter(prefix="/api/users", tags=["users"])


class UserUpdate(BaseModel):
    is_admin:  Optional[bool] = None
    is_active: Optional[bool] = None
    name:      Optional[str]  = None


@router.get("/")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "email":      u.email,
            "name":       u.name,
            "picture":    u.picture,
            "is_admin":   u.is_admin,
            "is_active":  u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]


@router.patch("/{email}")
def update_user(email: str, body: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if body.is_admin is not None:  user.is_admin  = body.is_admin
    if body.is_active is not None: user.is_active = body.is_active
    if body.name is not None:      user.name      = body.name
    db.commit()
    db.refresh(user)
    return {"email": user.email, "is_admin": user.is_admin, "is_active": user.is_active}


@router.delete("/{email}")
def delete_user(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()
    return {"deleted": email}


@router.post("/invite")
def invite_user(email: str, is_admin: bool = False, db: Session = Depends(get_db)):
    """Pre-create / whitelist a user before they first log in."""
    if not email.endswith("@antpack.co"):
        raise HTTPException(status_code=400, detail="Solo se permiten emails @antpack.co")
    existing = db.query(User).filter_by(email=email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Usuario ya existe")
    user = User(email=email, is_admin=is_admin, is_active=True, created_at=datetime.utcnow())
    db.add(user)
    db.commit()
    return {"email": email, "is_admin": is_admin}
