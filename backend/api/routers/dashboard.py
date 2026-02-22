"""
Dashboard summary endpoints for budget vs actual analysis.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..dependencies import get_db, get_current_user
from ..schemas import DashboardSummary, SummaryItem
from ...data_pipeline.models import Transaction, BudgetPlan
from ...data_pipeline.config import PipelineConfig

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

# Pipeline config
pipeline_config = PipelineConfig()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    year: int,
    month: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get budget vs actual summary for dashboard."""
    # Get actual spending from transactions for current user
    actual_query = session.query(
        Transaction.type,
        Transaction.category,
        func.sum(Transaction.amount).label("total"),
    ).filter(
        Transaction.user_id == current_user["id"],
        Transaction.year == year
    )

    if month:
        actual_query = actual_query.filter(Transaction.month == month)

    actual_query = actual_query.group_by(Transaction.type, Transaction.category)
    actuals = {(r.type, r.category): float(r.total) for r in actual_query.all()}

    # Get budgets - aggregate monthly budgets if viewing full year
    if month:
        # For a specific month: get that month's budget OR yearly budget (divided by 12)
        budget_query = session.query(BudgetPlan).filter(
            BudgetPlan.user_id == current_user["id"],
            BudgetPlan.year == year
        )
        budget_query = budget_query.filter(
            (BudgetPlan.month == month) | (BudgetPlan.month.is_(None))
        )

        budgets = {}
        for b in budget_query.all():
            key = (b.type, b.category)
            if b.month is None:
                # Yearly budget - divide by 12 for monthly view
                budgets[key] = float(b.amount) / 12
            else:
                # Monthly budget takes precedence
                budgets[key] = float(b.amount)
    else:
        # For full year: sum all monthly budgets OR use yearly budget
        all_budgets = session.query(BudgetPlan).filter(
            BudgetPlan.user_id == current_user["id"],
            BudgetPlan.year == year
        ).all()

        budgets = {}
        yearly_budgets = {}  # Track yearly budgets
        monthly_sums = {}  # Track sum of monthly budgets

        for b in all_budgets:
            key = (b.type, b.category)
            if b.month is None:
                yearly_budgets[key] = float(b.amount)
            else:
                if key not in monthly_sums:
                    monthly_sums[key] = 0.0
                monthly_sums[key] += float(b.amount)

        # Prefer yearly budget if it exists, otherwise use monthly sum
        for key in set(list(yearly_budgets.keys()) + list(monthly_sums.keys())):
            if key in yearly_budgets:
                # Yearly budget takes precedence
                budgets[key] = yearly_budgets[key]
            elif key in monthly_sums:
                # No yearly budget, sum up monthly budgets
                budgets[key] = monthly_sums[key]

    # Build summary for each type
    def build_summary(trans_type: str, categories: List[str]) -> List[SummaryItem]:
        items = []
        # Include all categories that have either budget OR actual
        all_cats = set(categories)
        # Also include categories that have actuals even if not in the predefined list
        for type_, cat in actuals.keys():
            if type_ == trans_type:
                all_cats.add(cat)

        for cat in all_cats:
            actual = actuals.get((trans_type, cat), 0.0)
            budget = budgets.get((trans_type, cat), 0.0)
            remaining = max(0, budget - actual)

            # Calculate percentage
            if budget > 0:
                percent = (actual / budget * 100)
            elif actual > 0:
                # Has actual but no budget - show as over 100%
                percent = 100.0
            else:
                percent = 0.0

            if actual > 0 or budget > 0:
                items.append(SummaryItem(
                    type=trans_type,
                    category=cat,
                    budget=budget,
                    actual=actual,
                    remaining=remaining,
                    percent_complete=round(percent, 1),
                ))
        return sorted(items, key=lambda x: x.actual, reverse=True)

    income_summary = build_summary("Income", pipeline_config.categories.income_categories)
    expense_summary = build_summary("Expenses", pipeline_config.categories.expense_categories)
    savings_summary = build_summary("Savings", pipeline_config.categories.savings_categories)

    # Calculate totals
    total_income_actual = sum(i.actual for i in income_summary)
    total_income_budget = sum(i.budget for i in income_summary)
    total_expense_actual = sum(i.actual for i in expense_summary)
    total_expense_budget = sum(i.budget for i in expense_summary)
    total_savings_actual = sum(i.actual for i in savings_summary)
    total_savings_budget = sum(i.budget for i in savings_summary)

    # Calculate Fixed Cost Ratio = (Housing + Health + Tax) / Total Income
    fixed_cost_categories = ["Housing", "Health Insurance", "Health Other", "Tax"]
    total_fixed_costs = sum(
        item.actual for item in expense_summary
        if item.category in fixed_cost_categories
    )
    fixed_cost_ratio = (total_fixed_costs / total_income_actual * 100) if total_income_actual > 0 else 0.0

    # Get previous period data for year-over-year comparison
    previous_year = year - 1
    previous_month = month  # Same month last year, or None for full year

    # Query previous period net balance
    prev_actual_query = session.query(
        Transaction.type,
        func.sum(Transaction.amount).label("total"),
    ).filter(
        Transaction.user_id == current_user["id"],
        Transaction.year == previous_year
    )

    if previous_month:
        prev_actual_query = prev_actual_query.filter(Transaction.month == previous_month)

    prev_actual_query = prev_actual_query.group_by(Transaction.type)
    prev_actuals = {r.type: float(r.total) for r in prev_actual_query.all()}

    prev_income = prev_actuals.get("Income", 0.0)
    prev_expenses = prev_actuals.get("Expenses", 0.0)
    prev_savings = prev_actuals.get("Savings", 0.0)
    prev_net = prev_income - prev_expenses - prev_savings

    # Get latest transaction date
    latest_date_query = session.query(func.max(Transaction.date)).filter(
        Transaction.user_id == current_user["id"]
    )
    latest_date_result = latest_date_query.scalar()
    latest_transaction_date = latest_date_result.strftime("%Y-%m-%d") if latest_date_result else None

    return DashboardSummary(
        year=year,
        month=month,
        income=income_summary,
        expenses=expense_summary,
        savings=savings_summary,
        totals={
            "income": {"actual": total_income_actual, "budget": total_income_budget},
            "expenses": {"actual": total_expense_actual, "budget": total_expense_budget},
            "savings": {"actual": total_savings_actual, "budget": total_savings_budget},
            "net": {
                "actual": total_income_actual - total_expense_actual - total_savings_actual,
                "budget": total_income_budget - total_expense_budget - total_savings_budget,
            },
        },
        fixed_cost_ratio=round(fixed_cost_ratio, 1),
        previous_period={
            "year": previous_year,
            "month": previous_month,
            "net": prev_net,
        },
        latest_transaction_date=latest_transaction_date,
    )


@router.get("/monthly-trend")
def get_monthly_trend(
    year: int,
    categories: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get monthly spending trend for the year, optionally filtered by categories (comma-separated)."""
    # Get actual transactions
    query = session.query(
        Transaction.month,
        Transaction.type,
        func.sum(Transaction.amount).label("total"),
    ).filter(
        Transaction.user_id == current_user["id"],
        Transaction.year == year
    )

    # Add category filter if provided (comma-separated list)
    if categories:
        category_list = [c.strip() for c in categories.split(',')]
        query = query.filter(Transaction.category.in_(category_list))

    query = query.group_by(
        Transaction.month, Transaction.type
    ).order_by(Transaction.month)

    results = query.all()

    # Get budget data
    budget_query = session.query(
        BudgetPlan.month,
        BudgetPlan.type,
        func.sum(BudgetPlan.amount).label("total"),
    ).filter(
        BudgetPlan.user_id == current_user["id"],
        BudgetPlan.year == year,
        BudgetPlan.month.isnot(None)
    )

    # Add category filter for budgets if provided
    if categories:
        category_list = [c.strip() for c in categories.split(',')]
        budget_query = budget_query.filter(BudgetPlan.category.in_(category_list))

    budget_query = budget_query.group_by(
        BudgetPlan.month, BudgetPlan.type
    ).order_by(BudgetPlan.month)

    budget_results = budget_query.all()

    # Organize by month
    months = {i: {
        "month": i,
        "Income": 0,
        "Expenses": 0,
        "Savings": 0,
        "IncomeBudget": 0,
        "ExpensesBudget": 0,
        "SavingsBudget": 0
    } for i in range(1, 13)}

    # Fill in actual data
    for r in results:
        if r.type in months[r.month]:
            months[r.month][r.type] = float(r.total)

    # Fill in budget data
    for r in budget_results:
        if r.type == "Income":
            months[r.month]["IncomeBudget"] = float(r.total)
        elif r.type == "Expenses":
            months[r.month]["ExpensesBudget"] = float(r.total)
        elif r.type == "Savings":
            months[r.month]["SavingsBudget"] = float(r.total)

    return list(months.values())


@router.get("/years")
def get_available_years(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get list of years with transaction data."""
    years = session.query(Transaction.year).filter(
        Transaction.user_id == current_user["id"]
    ).distinct().order_by(Transaction.year.desc()).all()
    return [y[0] for y in years]
