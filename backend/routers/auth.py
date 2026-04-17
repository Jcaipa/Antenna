"""
Auth router — validates Google ID tokens and enforces @antpack.co whitelist.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from pydantic import BaseModel
from datetime import datetime
import os

from database import get_db, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ALLOWED_DOMAIN   = "antpack.co"


class TokenRequest(BaseModel):
    credential: str   # Google ID token from frontend


@router.post("/google")
def google_login(body: TokenRequest, db: Session = Depends(get_db)):
    try:
        info = id_token.verify_oauth2_token(
            body.credential,
            grequests.Request(),
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {e}")

    email = info.get("email", "")
    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(
            status_code=403,
            detail=f"Acceso restringido a cuentas @{ALLOWED_DOMAIN}"
        )

    # Upsert user
    user = db.query(User).filter_by(email=email).first()
    if not user:
        user = User(
            email=email,
            name=info.get("name"),
            picture=info.get("picture"),
            is_admin=False,
            is_active=True,
        )
        db.add(user)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    user.last_login = datetime.utcnow()
    if not user.name:
        user.name = info.get("name")
    if not user.picture:
        user.picture = info.get("picture")
    db.commit()
    db.refresh(user)

    return {
        "email":    user.email,
        "name":     user.name,
        "picture":  user.picture,
        "is_admin": user.is_admin,
        "is_active":user.is_active,
    }


@router.get("/me")
def me(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "email":    user.email,
        "name":     user.name,
        "picture":  user.picture,
        "is_admin": user.is_admin,
    }
