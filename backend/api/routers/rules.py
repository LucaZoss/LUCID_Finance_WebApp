"""
Categorization rules endpoints for automated transaction categorization.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user, db_manager
from ..schemas import RuleCreate, RuleUpdate, RuleResponse
from ...data_pipeline.models import CategorizationRule, Transaction
from ...data_pipeline.config import PipelineConfig

router = APIRouter(prefix="/api/rules", tags=["Rules"])

# Pipeline config
pipeline_config = PipelineConfig()


@router.get("", response_model=List[RuleResponse])
def get_rules(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get all categorization rules, ordered by priority (highest first)."""
    query = session.query(CategorizationRule).order_by(
        CategorizationRule.priority.desc(),
        CategorizationRule.created_at.desc()
    )

    if is_active is not None:
        query = query.filter(CategorizationRule.is_active == is_active)

    rules = query.all()
    return [RuleResponse.model_validate(rule) for rule in rules]


@router.post("", response_model=RuleResponse)
def create_rule(
    rule_data: RuleCreate,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Create a new categorization rule."""
    new_rule = CategorizationRule(
        pattern=rule_data.pattern,
        case_sensitive=rule_data.case_sensitive,
        amount_operator=rule_data.amount_operator,
        amount_value=rule_data.amount_value,
        type=rule_data.type,
        category=rule_data.category,
        priority=rule_data.priority,
        is_active=True,
        user_id=None  # For now, all rules are global
    )
    session.add(new_rule)
    session.commit()
    session.refresh(new_rule)

    return RuleResponse.model_validate(new_rule)


@router.patch("/{rule_id}", response_model=RuleResponse)
def update_rule(
    rule_id: int,
    rule_data: RuleUpdate,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Update a categorization rule."""
    rule = session.query(CategorizationRule).filter(CategorizationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Update fields if provided
    if rule_data.pattern is not None:
        rule.pattern = rule_data.pattern
    if rule_data.case_sensitive is not None:
        rule.case_sensitive = rule_data.case_sensitive
    if rule_data.amount_operator is not None:
        rule.amount_operator = rule_data.amount_operator
    if rule_data.amount_value is not None:
        rule.amount_value = rule_data.amount_value
    if rule_data.type is not None:
        rule.type = rule_data.type
    if rule_data.category is not None:
        rule.category = rule_data.category
    if rule_data.priority is not None:
        rule.priority = rule_data.priority
    if rule_data.is_active is not None:
        rule.is_active = rule_data.is_active

    session.commit()
    session.refresh(rule)

    return RuleResponse.model_validate(rule)


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: int,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Delete a categorization rule."""
    rule = session.query(CategorizationRule).filter(CategorizationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    session.delete(rule)
    session.commit()

    return {"message": "Rule deleted successfully", "id": rule_id}


@router.post("/apply")
def apply_rules_to_transactions(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Re-categorize existing transactions based on current active rules.
    This checks all transactions and updates their type/category if they match a rule.
    """
    from ...data_pipeline.transformers import TransactionTransformer

    # Get all active rules
    rules = session.query(CategorizationRule).filter(
        CategorizationRule.is_active.is_(True)
    ).order_by(
        CategorizationRule.priority.desc(),
        CategorizationRule.created_at.desc()
    ).all()

    if not rules:
        return {"message": "No active rules to apply", "updated_count": 0}

    # Get all transactions for current user
    transactions = session.query(Transaction).filter(
        Transaction.user_id == current_user["id"]
    ).all()

    if not transactions:
        return {"message": "No transactions to process", "updated_count": 0}

    # Create transformer to check rules
    transformer = TransactionTransformer(pipeline_config, db_manager)

    updated_count = 0

    for transaction in transactions:
        # Check if transaction matches any rule
        description = transaction.description or ""
        amount = float(transaction.amount)

        # Use transformer's rule checking logic
        match = transformer._check_custom_rules(description, amount)

        if match:
            new_type, new_category = match
            # Only update if different
            if transaction.type != new_type or transaction.category != new_category:
                transaction.type = new_type
                transaction.category = new_category
                updated_count += 1

    session.commit()

    return {
        "message": f"Successfully re-categorized {updated_count} transactions",
        "updated_count": updated_count,
        "total_transactions": len(transactions),
        "active_rules": len(rules)
    }
