from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_jwt_secret
from app.models.entities import Usuario

bearer_scheme = HTTPBearer()
settings = get_settings()
DatabaseSession = Annotated[Session, Depends(get_db)]


def get_current_admin(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    database: DatabaseSession,
) -> Usuario:
    try:
        payload = jwt.decode(credentials.credentials, get_jwt_secret(), algorithms=[settings.jwt_algorithm])
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalido") from error
    user = database.get(Usuario, user_id)
    if not user or not user.activo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no autorizado")
    return user


AdminUser = Annotated[Usuario, Depends(get_current_admin)]
