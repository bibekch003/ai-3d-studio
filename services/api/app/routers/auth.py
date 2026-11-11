from __future__ import annotations

from fastapi import APIRouter

from ..security import CurrentPrincipal

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/me", summary="Current principal")
async def me(principal: CurrentPrincipal) -> dict[str, object]:
    return {
        "id": principal.user_id,
        "email": principal.email,
        "role": principal.role,
        "is_dev": principal.is_dev,
        "display_name": (principal.email or "Studio user").split("@")[0],
        "workspace_mode": "professional",
    }
