"""System: global settings, alert center, webhook maintenance."""

import json
import urllib.request
import urllib.error
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import Alert, SystemSettings, User

router = APIRouter(prefix="/api/admin", tags=["admin-system"])


# ---------------- Settings ----------------
class SettingsBody(BaseModel):
    maintenance_mode: bool | None = None
    maintenance_message: str | None = None
    broadcast_message: str | None = None
    default_tier: str | None = None


async def _get_settings(db) -> SystemSettings:
    s = (await db.execute(select(SystemSettings).where(SystemSettings.id == "global"))).scalar_one_or_none()
    if s is None:
        s = SystemSettings(id="global")
        db.add(s)
        await db.commit()
    return s


@router.get("/settings")
async def get_settings(admin=Depends(require_admin), db=Depends(get_db)):
    s = await _get_settings(db)
    return {
        "maintenance_mode": s.maintenance_mode,
        "maintenance_message": s.maintenance_message,
        "broadcast_message": s.broadcast_message,
        "default_tier": s.default_tier,
    }


@router.put("/settings")
async def update_settings(body: SettingsBody, admin=Depends(require_admin), db=Depends(get_db)):
    s = await _get_settings(db)
    if body.maintenance_mode is not None:
        s.maintenance_mode = body.maintenance_mode
    if body.maintenance_message is not None:
        s.maintenance_message = body.maintenance_message
    if body.broadcast_message is not None:
        s.broadcast_message = body.broadcast_message
    if body.default_tier is not None:
        s.default_tier = body.default_tier
    await db.commit()
    return {"ok": True}


# ---------------- Alerts ----------------
@router.get("/alerts")
async def list_alerts(admin=Depends(require_admin), db=Depends(get_db)):
    rows = (await db.execute(select(Alert).order_by(Alert.created_at.desc()))).scalars().all()
    return {
        "alerts": [
            {
                "id": a.id,
                "severity": a.severity,
                "type": a.type,
                "message": a.message,
                "is_resolved": a.is_resolved,
                "related_user_id": a.related_user_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in rows
        ]
    }


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    a = (await db.execute(select(Alert).where(Alert.id == alert_id))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    a.is_resolved = True
    await db.commit()
    return {"ok": True}


# ---------------- Webhooks ----------------
@router.post("/webhooks/test")
async def test_webhook(url: str, admin=Depends(require_admin)):
    payload = {
        "object": "page",
        "entry": [{"id": "test", "time": int(datetime.utcnow().timestamp()), "messaging": []}],
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, timeout=8)  # noqa: S310 - admin-initiated test only
        return {"ok": resp.status in (200, 201, 202), "status": resp.status}
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code}
    except Exception as e:
        return {"ok": False, "status": 0, "error": str(e)}


@router.post("/webhooks/retry")
async def retry_webhooks(admin=Depends(require_admin), db=Depends(get_db)):
    # ponytail: no webhook-delivery log table yet — retry is a no-op until delivery logging lands.
    return {"ok": True, "retried": 0}
