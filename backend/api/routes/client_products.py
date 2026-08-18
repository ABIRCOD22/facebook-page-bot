"""Phase 2D: Products CRUD API."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import get_current_user
from core.rag_engine import RAGEngine
from database.connection import get_db
from models.database_models import Product, User

router = APIRouter(prefix="/api/client", tags=["client-products"])


class ProductCreate(BaseModel):
    name: str
    description: str = ""
    price: str = ""
    currency: str = "BDT"
    availability: str = "in_stock"
    category: str = ""
    variants: str = ""


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: str | None = None
    currency: str | None = None
    availability: str | None = None
    category: str | None = None
    variants: str | None = None


@router.get("/products")
async def list_products(
    user: User = Depends(get_current_user),
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = "",
):
    query = select(Product).where(Product.user_id == user.id, Product.is_active == True)  # noqa: E712
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    query = query.order_by(Product.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    products = result.scalars().all()

    # count total
    count_q = select(Product).where(Product.user_id == user.id, Product.is_active == True)  # noqa: E712
    if search:
        count_q = count_q.where(Product.name.ilike(f"%{search}%"))
    total = (await db.execute(select(Product.id).where(count_q.whereclause))).fetchall()

    return {
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "price": p.price,
                "currency": p.currency,
                "availability": p.availability,
                "category": p.category,
                "variants": p.variants,
                "image_url": p.image_url,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in products
        ],
        "total": len(total),
        "page": page,
        "per_page": per_page,
    }


@router.get("/products/{product_id}")
async def get_product(
    product_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.user_id == user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": p.price,
        "currency": p.currency,
        "availability": p.availability,
        "category": p.category,
        "variants": p.variants,
        "image_url": p.image_url,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.post("/products", status_code=201)
async def create_product(
    body: ProductCreate,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    product = Product(
        user_id=user.id,
        name=body.name,
        description=body.description,
        price=body.price,
        currency=body.currency,
        availability=body.availability,
        category=body.category,
        variants=body.variants,
    )
    db.add(product)
    await db.flush()

    # Index in Chroma
    rag = RAGEngine(user.id)
    rag.add_product(
        product_id=product.id,
        name=product.name,
        description=product.description or "",
        price=product.price or "",
        currency=product.currency or "BDT",
        availability=product.availability or "in_stock",
        category=product.category or "",
        variants=product.variants or "",
    )

    await db.commit()
    return {"id": product.id, "status": "created"}


@router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    body: ProductUpdate,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.user_id == user.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    # Re-index in Chroma
    rag = RAGEngine(user.id)
    rag.add_product(
        product_id=product.id,
        name=product.name,
        description=product.description or "",
        price=product.price or "",
        currency=product.currency or "BDT",
        availability=product.availability or "in_stock",
        category=product.category or "",
        variants=product.variants or "",
    )

    await db.commit()
    return {"status": "updated"}


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.user_id == user.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = False

    # Remove from Chroma
    rag = RAGEngine(user.id)
    rag.delete_document(product.id)

    await db.commit()
    return {"status": "deleted"}
