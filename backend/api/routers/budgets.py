"""
Budget planning endpoints for creating and managing budgets.
"""

from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from ..schemas import BudgetPlanResponse, BudgetPlanCreate
from ...data_pipeline.models import BudgetPlan

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])


@router.get("", response_model=List[BudgetPlanResponse])
def get_budgets(
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get all budget plans, optionally filtered by year."""
    query = session.query(BudgetPlan).filter(BudgetPlan.user_id == current_user["id"])
    if year:
        query = query.filter(BudgetPlan.year == year)
    budgets = query.all()
    return [BudgetPlanResponse.model_validate(b) for b in budgets]


@router.post("", response_model=BudgetPlanResponse)
def create_budget(
    budget: BudgetPlanCreate,
    auto_populate: bool = True,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Create or update a budget plan with optional auto-population."""
    # Check if budget already exists for current user
    existing = session.query(BudgetPlan).filter(
        BudgetPlan.user_id == current_user["id"],
        BudgetPlan.type == budget.type,
        BudgetPlan.category == budget.category,
        BudgetPlan.year == budget.year,
        BudgetPlan.month == budget.month,
    ).first()

    if existing:
        existing.amount = Decimal(str(budget.amount))
    else:
        existing = BudgetPlan(
            user_id=current_user["id"],
            type=budget.type,
            category=budget.category,
            year=budget.year,
            month=budget.month,
            amount=Decimal(str(budget.amount)),
        )
        session.add(existing)

    session.commit()
    session.refresh(existing)

    # Auto-populate monthly budgets from yearly (or vice versa)
    if auto_populate:
        if budget.month is None:
            # Yearly budget entered → create/update 12 monthly budgets
            monthly_amount = Decimal(str(budget.amount)) / 12
            for month_num in range(1, 13):
                monthly_budget = session.query(BudgetPlan).filter(
                    BudgetPlan.user_id == current_user["id"],
                    BudgetPlan.type == budget.type,
                    BudgetPlan.category == budget.category,
                    BudgetPlan.year == budget.year,
                    BudgetPlan.month == month_num,
                ).first()

                if monthly_budget:
                    monthly_budget.amount = monthly_amount
                else:
                    monthly_budget = BudgetPlan(
                        user_id=current_user["id"],
                        type=budget.type,
                        category=budget.category,
                        year=budget.year,
                        month=month_num,
                        amount=monthly_amount,
                    )
                    session.add(monthly_budget)
        else:
            # Monthly budget entered → update yearly budget (sum all months)
            all_monthly = session.query(BudgetPlan).filter(
                BudgetPlan.user_id == current_user["id"],
                BudgetPlan.type == budget.type,
                BudgetPlan.category == budget.category,
                BudgetPlan.year == budget.year,
                BudgetPlan.month.isnot(None),
            ).all()

            if len(all_monthly) == 12:
                # All 12 months exist, calculate yearly total
                yearly_total = sum(Decimal(str(b.amount)) for b in all_monthly)
                yearly_budget = session.query(BudgetPlan).filter(
                    BudgetPlan.user_id == current_user["id"],
                    BudgetPlan.type == budget.type,
                    BudgetPlan.category == budget.category,
                    BudgetPlan.year == budget.year,
                    BudgetPlan.month.is_(None),
                ).first()

                if yearly_budget:
                    yearly_budget.amount = yearly_total
                else:
                    yearly_budget = BudgetPlan(
                        user_id=current_user["id"],
                        type=budget.type,
                        category=budget.category,
                        year=budget.year,
                        month=None,
                        amount=yearly_total,
                    )
                    session.add(yearly_budget)

        session.commit()

    return BudgetPlanResponse.model_validate(existing)


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: int,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Delete a budget plan."""
    budget = session.query(BudgetPlan).filter(
        BudgetPlan.id == budget_id,
        BudgetPlan.user_id == current_user["id"]
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    session.delete(budget)
    session.commit()
    return {"message": "Budget deleted"}


@router.post("/bulk-delete")
def bulk_delete_budgets(
    budget_ids: List[int],
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Delete multiple budget plans at once."""
    deleted_count = session.query(BudgetPlan).filter(
        BudgetPlan.id.in_(budget_ids),
        BudgetPlan.user_id == current_user["id"]
    ).delete(synchronize_session=False)

    session.commit()
    return {"message": f"Deleted {deleted_count} budget(s)", "count": deleted_count}
