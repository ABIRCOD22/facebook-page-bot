"""Phase 2D: Products CRUD API + Facebook product scanning."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from api.dependencies import get_current_user
from core.rag_engine import RAGEngine
from database.connection import get_db
from models.database_models import FacebookPage, Product, User
from services.facebook_service import FacebookService

logger = logging.getLogger(__name__)

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


# ============================================
# Scan products from connected Facebook Page
# ============================================

class ScanResult(BaseModel):
    imported: int
    skipped: int
    total_found: int


@router.post("/scan-products", response_model=ScanResult)
async def scan_products_from_facebook(
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Scan the user's connected Facebook Page for products.

    Tries three sources in order:
    1. Facebook Shop / Commerce catalog (best quality — name, price, image)
    2. Page feed posts with images (heuristic — looks for product-like posts)
    3. Page photo uploads (fallback — name + image only)

    Deduplicates by image_url. Skips products that already exist (same name+image).
    Returns counts: imported (new), skipped (already exist), total_found.
    """
    # Find user's active connected page
    result = await db.execute(
        select(FacebookPage).where(
            FacebookPage.user_id == user.id,
            FacebookPage.is_active == True,  # noqa: E712
        )
    )
    pages = result.scalars().all()
    if not pages:
        raise HTTPException(status_code=400, detail="No connected Facebook Page found. Connect a page first.")

    # Scan from all connected pages
    all_products = []
    for page in pages:
        token = page.page_access_token
        fb_id = page.page_id

        # 1. Try Facebook Shop (best quality)
        shop = await FacebookService.scan_page_shop(fb_id, token)
        all_products.extend(shop)

        # 2. Try Page feed (posts with images)
        feed = await FacebookService.scan_page_feed(fb_id, token)
        all_products.extend(feed)

        # 3. Try Page photos (fallback)
        photos = await FacebookService.scan_page_photos(fb_id, token)
        all_products.extend(photos)

    # Deduplicate by image_url
    seen_images = set()
    unique_products = []
    for p in all_products:
        img = p.get("image_url", "")
        if img and img not in seen_images:
            seen_images.add(img)
            unique_products.append(p)
        elif not img:
            unique_products.append(p)

    # Get existing product names+images to skip duplicates
    existing = await db.execute(
        select(Product.name, Product.image_url).where(
            Product.user_id == user.id,
            Product.is_active == True,  # noqa: E712
        )
    )
    existing_set = {(row[0], row[1]) for row in existing.fetchall()}

    imported = 0
    skipped = 0
    rag = RAGEngine(user.id)

    for p in unique_products:
        key = (p["name"], p.get("image_url", ""))
        if key in existing_set:
            skipped += 1
            continue

        product = Product(
            user_id=user.id,
            name=p["name"][:500],
            description=p.get("description", "")[:2000],
            price=p.get("price", ""),
            currency=p.get("currency", "BDT"),
            availability=p.get("availability", "in_stock"),
            category=p.get("category", "scanned"),
            image_url=p.get("image_url", ""),
        )
        db.add(product)
        await db.flush()

        rag.add_product(
            product_id=product.id,
            name=product.name,
            description=product.description or "",
            price=product.price or "",
            currency=product.currency or "BDT",
            availability=product.availability or "in_stock",
            category=product.category or "",
            variants="",
        )
        imported += 1

    await db.commit()
    logger.info("Product scan for user %s: imported=%d skipped=%d total=%d", user.id, imported, skipped, len(unique_products))

    return ScanResult(imported=imported, skipped=skipped, total_found=len(unique_products))
