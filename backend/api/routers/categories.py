"""
Category management endpoints for transaction categorization.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..dependencies import get_db, get_current_user, db_manager
from ..schemas import CategoryInfo, CategoryResponse, CategoryCreate, CategoryUpdate
from ...data_pipeline.models import Category, Transaction, BudgetPlan
from ...data_pipeline.config import PipelineConfig

router = APIRouter(prefix="/api/categories", tags=["Categories"])

# Pipeline config for defaults
pipeline_config = PipelineConfig()


@router.get("", response_model=List[CategoryInfo])
def get_categories(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get all available categories grouped by type."""
    # Get categories from database for current user
    categories_db = session.query(Category).filter(
        Category.user_id == current_user["id"],
        Category.is_active.is_(True)
    ).order_by(Category.display_order, Category.name).all()

    # If no categories in DB, use config defaults
    if not categories_db:
        return [
            CategoryInfo(type="Income", categories=pipeline_config.categories.income_categories),
            CategoryInfo(type="Expenses", categories=pipeline_config.categories.expense_categories),
            CategoryInfo(type="Savings", categories=pipeline_config.categories.savings_categories),
        ]

    # Group by type
    grouped = {}
    for cat in categories_db:
        if cat.type not in grouped:
            grouped[cat.type] = []
        grouped[cat.type].append(cat.name)

    return [CategoryInfo(type=t, categories=cats) for t, cats in grouped.items()]


@router.get("/all", response_model=List[CategoryResponse])
def get_all_categories(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get all categories (including inactive) for management."""
    categories = session.query(Category).filter(
        Category.user_id == current_user["id"]
    ).order_by(Category.type, Category.display_order, Category.name).all()
    return [CategoryResponse.model_validate(cat) for cat in categories]


@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(
    category: CategoryCreate,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Create a new category."""
    # Check if category already exists for this user
    existing = session.query(Category).filter(
        Category.user_id == current_user["id"],
        Category.name == category.name,
        Category.type == category.type
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Category '{category.name}' already exists for type '{category.type}'"
        )

    # Create new category
    new_category = Category(
        user_id=current_user["id"],
        name=category.name,
        type=category.type,
        display_order=category.display_order,
        is_active=True
    )

    session.add(new_category)
    session.commit()
    session.refresh(new_category)

    return CategoryResponse.model_validate(new_category)


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    update: CategoryUpdate,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Update an existing category."""
    category = session.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user["id"]
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Update fields
    if update.name is not None:
        # Check for duplicate name within user's categories
        existing = session.query(Category).filter(
            Category.user_id == current_user["id"],
            Category.name == update.name,
            Category.type == (update.type if update.type else category.type),
            Category.id != category_id
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Category '{update.name}' already exists"
            )

        category.name = update.name

    if update.type is not None:
        category.type = update.type

    if update.is_active is not None:
        category.is_active = update.is_active

    if update.display_order is not None:
        category.display_order = update.display_order

    session.commit()
    session.refresh(category)

    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Delete a category (soft delete by setting is_active=False)."""
    category = session.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user["id"]
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check if category is used in user's transactions or budgets
    transaction_count = session.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user["id"],
        Transaction.category == category.name
    ).scalar()

    budget_count = session.query(func.count(BudgetPlan.id)).filter(
        BudgetPlan.user_id == current_user["id"],
        BudgetPlan.category == category.name
    ).scalar()

    if transaction_count > 0 or budget_count > 0:
        # Soft delete
        category.is_active = False
        session.commit()
        return {
            "message": f"Category deactivated (used in {transaction_count} transactions and {budget_count} budgets)"
        }
    else:
        # Hard delete if unused
        session.delete(category)
        session.commit()
        return {"message": "Category deleted successfully"}


@router.get("/types")
def get_types():
    """Get all valid transaction types."""
    return pipeline_config.categories.valid_types
