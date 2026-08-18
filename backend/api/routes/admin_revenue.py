"""Revenue + recorded payments (manual payouts) management."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select

from api.dependencies import require_admin
from database.connection import get_db
from models.database_models import Payment, Subscription, User

router = APIRouter(prefix="/api/admin/revenue", tags=["admin-revenue"])

TIER_PRICE = {"free_trial": 0, "starter": 500, "professional": 1500, "enterprise": 4000}


class PayoutUpdate(BaseModel):
    status: str  # pending | completed | failed | refunded


@router.get("")
async def revenue(admin=Depends(require_admin), db=Depends(get_db)):
    payments = (await db.execute(select(Payment))).scalars().all()

    total_revenue = 0.0
    by_method = {}
    for p in payments:
        if p.status == "completed":
            try:
                total_revenue += float(p.amount or 0)
            except (ValueError, TypeError):
                pass
            by_method[p.method] = (by_method.get(p.method, 0.0)) + _to_float(p.amount)

    subs = (await db.execute(select(Subscription))).scalars().all()
    mrr = sum(TIER_PRICE.get(s.tier, 0) for s in subs if s.status == "active")

    recent = sorted(payments, key=lambda p: p.created_at or 0, reverse=True)[:10]
    recent_list = [
        {
            "id": p.id,
            "user_id": p.user_id,
            "amount": p.amount,
            "currency": p.currency,
            "method": p.method,
            "status": p.status,
            "note": p.note,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in recent
    ]

    return {
        "total_revenue": round(total_revenue, 2),
        "mrr": mrr,
        "by_method": {k: round(v, 2) for k, v in by_method.items()},
        "payment_count": len(payments),
        "recent_payments": recent_list,
    }


@router.get("/payouts")
async def list_payouts(admin=Depends(require_admin), db=Depends(get_db)):
    payments = (await db.execute(select(Payment).order_by(Payment.created_at.desc()))).scalars().all()
    rows = []
    for p in payments:
        u = (await db.execute(select(User).where(User.id == p.user_id))).scalar_one_or_none()
        rows.append(
            {
                "id": p.id,
                "user_id": p.user_id,
                "user_email": u.email if u else "?",
                "amount": p.amount,
                "currency": p.currency,
                "method": p.method,
                "status": p.status,
                "note": p.note,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
        )
    return {"payouts": rows}


@router.put("/payouts/{payment_id}")
async def update_payout(payment_id: str, body: PayoutUpdate, admin=Depends(require_admin), db=Depends(get_db)):
    p = (await db.execute(select(Payment).where(Payment.id == payment_id))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    p.status = body.status
    await db.commit()
    return {"ok": True}


def _to_float(v):
    try:
        return float(v or 0)
    except (ValueError, TypeError):
        return 0.0
