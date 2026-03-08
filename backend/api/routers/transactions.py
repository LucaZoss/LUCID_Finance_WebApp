"""
Transaction CRUD endpoints for managing financial transactions.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Request
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import hashlib

from ..dependencies import get_db, get_current_user
from ..schemas import TransactionResponse, TransactionUpdate, TransactionCreate, BulkTransactionUpdate
from ...data_pipeline.models import Transaction
from ...data_pipeline.pipeline import TransactionPipeline
from decimal import Decimal
from datetime import datetime

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


def get_sub_type_from_budget(session: Session, user_id: int, category: str) -> Optional[str]:
    """
    Look up sub_type from user's budget for this category.
    Returns the sub_type from the most recent budget, None otherwise.
    """
    from ...data_pipeline.models import BudgetPlan

    # Get the most recent budget for this category (order by year DESC, then created_at DESC)
    budget = session.query(BudgetPlan).filter(
        BudgetPlan.user_id == user_id,
        BudgetPlan.category == category,
        BudgetPlan.sub_type.isnot(None)
    ).order_by(
        BudgetPlan.year.desc(),
        BudgetPlan.created_at.desc()
    ).first()

    return budget.sub_type if budget else None


def auto_set_sub_type(category: str, sub_type: Optional[str], session: Optional[Session] = None, user_id: Optional[int] = None, transaction_type: Optional[str] = None) -> Optional[str]:
    """
    Auto-set sub_type based on category and transaction type.

    Special cases (always None):
    - CC_Refund type: No sub_type (it's a refund, not a categorized expense)
    - CC_Fees category: No sub_type (bank fees are special)

    Priority for other cases:
    1. If sub_type is already set, keep it
    2. If user has a budget for this category, use its sub_type
    3. For Housing and Health Insurance, default to "Essentials" (fixed in Budget Wizard Step 2)
    4. Otherwise, leave as None (user should classify via Budget Wizard)
    """
    # Special case: CC_Refund type should never have a sub_type
    if transaction_type == "CC_Refund":
        return None

    # Special case: CC_Fees category should never have a sub_type
    if category and category.lower() in ["cc_fees", "cc fees", "fees"]:
        return None

    # If sub_type is already set, keep it
    if sub_type:
        return sub_type

    # Try to get sub_type from user's budget
    if session and user_id and category:
        budget_sub_type = get_sub_type_from_budget(session, user_id, category)
        if budget_sub_type:
            return budget_sub_type

    # Only auto-classify the fixed essentials from Budget Wizard Step 2
    if category in ["Housing", "Health Insurance"]:
        return "Essentials"

    # For all other categories, leave as None - user should classify via budget
    return None


def auto_set_category_for_type(transaction_type: str, category: Optional[str]) -> Optional[str]:
    """
    Auto-set category based on transaction type.

    Special cases:
    - CC_Refund type: Always set category to "Card Refund"
    """
    if transaction_type == "CC_Refund":
        return "Card Refund"

    # For all other types, keep the existing category
    return category


def generate_manual_transaction_hash(date, amount: float, description: str, transaction_type: str, category: str) -> str:
    """
    Generate a unique hash for manual transactions.

    Similar to the hash generation in data_pipeline/transformers.py but adapted for manual entry.
    Hash is based on: date, amount, source (Manual), type, category, and description.
    """
    hash_parts = [
        date.strftime("%Y-%m-%d"),
        f"{amount:.2f}",
        "Manual",  # source
        transaction_type,
        category or "",
        (description or "")[:50],  # First 50 chars of description
    ]

    hash_string = "|".join(hash_parts)
    return hashlib.sha256(hash_string.encode()).hexdigest()


@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    year: Optional[int] = None,
    month: Optional[int] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    limit: int = Query(default=500, le=5000),
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get transactions with optional filters."""
    # Filter by current user
    query = session.query(Transaction).filter(Transaction.user_id == current_user["id"])

    if year:
        query = query.filter(Transaction.year == year)
    if month:
        query = query.filter(Transaction.month == month)
    if type:
        query = query.filter(Transaction.type == type)
    if category:
        query = query.filter(Transaction.category == category)
    if amount_min is not None:
        query = query.filter(Transaction.amount >= amount_min)
    if amount_max is not None:
        query = query.filter(Transaction.amount <= amount_max)

    query = query.order_by(Transaction.date.desc())
    transactions = query.offset(offset).limit(limit).all()

    return [TransactionResponse.model_validate(t) for t in transactions]


@router.post("", response_model=TransactionResponse)
def create_transaction(
    transaction: TransactionCreate,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Create a new manual transaction."""
    # Auto-set category for CC_Refund type
    category = auto_set_category_for_type(transaction.type, transaction.category)

    # Auto-set sub_type based on budget and type
    sub_type = auto_set_sub_type(
        category,
        transaction.sub_type,
        session,
        current_user["id"],
        transaction.type
    )

    # Generate transaction hash for deduplication
    transaction_hash = generate_manual_transaction_hash(
        date=transaction.date,
        amount=abs(transaction.amount),
        description=transaction.description or "",
        transaction_type=transaction.type,
        category=category
    )

    # Create new transaction
    new_transaction = Transaction(
        user_id=current_user["id"],
        date=transaction.date,
        type=transaction.type,
        category=category,
        sub_type=sub_type,
        amount=Decimal(str(abs(transaction.amount))),  # Ensure positive
        description=transaction.description or "",
        source="Manual",
        month=transaction.date.month,
        year=transaction.date.year,
        source_file=None,
        transaction_hash=transaction_hash,
        created_at=datetime.utcnow()
    )

    session.add(new_transaction)
    session.commit()
    session.refresh(new_transaction)

    return TransactionResponse.model_validate(new_transaction)


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get a single transaction by ID."""
    transaction = session.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user["id"]
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return TransactionResponse.model_validate(transaction)


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    update: TransactionUpdate,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Update a transaction's type and/or category."""
    transaction = session.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user["id"]
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Update type first
    if update.type is not None:
        transaction.type = update.type
        # Auto-set category based on type (e.g., CC_Refund -> "Card Refund")
        current_type = update.type
        transaction.category = auto_set_category_for_type(current_type, transaction.category)

    # Update category
    if update.category is not None:
        transaction.category = update.category

    # Auto-set sub_type based on final type and category
    current_type = update.type if update.type is not None else transaction.type
    current_category = transaction.category

    if update.category is not None or update.sub_type is not None or update.type is not None:
        transaction.sub_type = auto_set_sub_type(current_category, update.sub_type, session, current_user["id"], current_type)

    session.commit()
    session.refresh(transaction)
    return TransactionResponse.model_validate(transaction)


@router.patch("/bulk-debug")
async def bulk_update_debug(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Debug endpoint to test PATCH method with auth."""
    body = await request.body()
    import json
    try:
        parsed = json.loads(body)
        print(f"DEBUG RAW BODY: {parsed}")
        print(f"DEBUG CURRENT USER: {current_user}")
        # Try parsing as BulkTransactionUpdate
        bulk_update = BulkTransactionUpdate(**parsed)
        return {"success": True, "received": parsed, "parsed": str(bulk_update)}
    except Exception as e:
        return {"error": str(e), "body_bytes": str(body)}


@router.post("/bulk")
def bulk_update_transactions(
    bulk_update: BulkTransactionUpdate,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Bulk update multiple transactions' type and/or category."""
    # Verify all transactions belong to the current user
    transactions = session.query(Transaction).filter(
        Transaction.id.in_(bulk_update.transaction_ids),
        Transaction.user_id == current_user["id"]
    ).all()

    if len(transactions) != len(bulk_update.transaction_ids):
        raise HTTPException(status_code=404, detail="One or more transactions not found or unauthorized")

    # Update all transactions
    updated_count = 0
    for transaction in transactions:
        # Update type first
        if bulk_update.type is not None:
            transaction.type = bulk_update.type
            # Auto-set category based on type (e.g., CC_Refund -> "Card Refund")
            transaction.category = auto_set_category_for_type(bulk_update.type, transaction.category)

        # Update category
        if bulk_update.category is not None:
            transaction.category = bulk_update.category

        # Auto-set sub_type based on final type and category
        current_type = bulk_update.type if bulk_update.type is not None else transaction.type
        current_category = transaction.category

        if bulk_update.category is not None or bulk_update.sub_type is not None or bulk_update.type is not None:
            transaction.sub_type = auto_set_sub_type(current_category, bulk_update.sub_type, session, current_user["id"], current_type)

        updated_count += 1

    session.commit()
    return {"updated_count": updated_count, "message": f"Successfully updated {updated_count} transactions"}


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Delete a transaction."""
    transaction = session.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user["id"]
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    session.delete(transaction)
    session.commit()
    return {"message": "Transaction deleted"}


@router.get("/stats/labeling")
def get_labeling_stats(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get statistics about transaction labeling status."""
    from sqlalchemy import func, or_

    # Total transactions
    total = session.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user["id"]
    ).scalar()

    # Unlabeled transactions (missing type or category)
    unlabeled = session.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user["id"],
        or_(
            Transaction.type.is_(None),
            Transaction.type == "",
            Transaction.category.is_(None),
            Transaction.category == ""
        )
    ).scalar()

    # Transactions without sub_type
    no_sub_type = session.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user["id"],
        Transaction.sub_type.is_(None),
        Transaction.type == "Expenses"  # Only count Expenses
    ).scalar()

    labeled = total - unlabeled
    percent_labeled = (labeled / total * 100) if total > 0 else 0

    return {
        "total": total,
        "labeled": labeled,
        "unlabeled": unlabeled,
        "no_sub_type": no_sub_type,
        "percent_labeled": round(percent_labeled, 1)
    }


@router.post("/apply-sub-types")
def apply_sub_types_to_existing(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """
    Apply auto sub-type classification to all existing transactions.
    - Sets category to "Card Refund" and clears sub_types for CC_Refund transactions
    - Clears sub_types for CC_Fees transactions
    - Applies budget-based sub_types to Expense transactions
    """
    updated_count = 0

    # Step 1: Fix all CC_Refund transactions (set category and clear sub_type)
    cc_refund_transactions = session.query(Transaction).filter(
        Transaction.user_id == current_user["id"],
        Transaction.type == "CC_Refund"
    ).all()

    for transaction in cc_refund_transactions:
        # Set category to "Card Refund"
        if transaction.category != "Card Refund":
            transaction.category = "Card Refund"
            updated_count += 1
        # Clear sub_type
        if transaction.sub_type is not None:
            transaction.sub_type = None
            updated_count += 1

    # Step 2: Clear sub_types for all CC_Fees transactions
    cc_fees_transactions = session.query(Transaction).filter(
        Transaction.user_id == current_user["id"],
        Transaction.category.in_(["CC_Fees", "CC Fees", "Fees"]),
        Transaction.sub_type.isnot(None)
    ).all()

    for transaction in cc_fees_transactions:
        transaction.sub_type = None
        updated_count += 1

    # Step 3: Apply budget-based sub_types to Expense transactions without sub_type
    expense_transactions = session.query(Transaction).filter(
        Transaction.user_id == current_user["id"],
        Transaction.type == "Expenses",
        Transaction.category.isnot(None),
        Transaction.category != "",
        Transaction.sub_type.is_(None)
    ).all()

    for transaction in expense_transactions:
        new_sub_type = auto_set_sub_type(transaction.category, None, session, current_user["id"], transaction.type)
        if new_sub_type:
            transaction.sub_type = new_sub_type
            updated_count += 1

    session.commit()
    return {
        "message": f"Applied sub-types to {updated_count} transactions",
        "updated_count": updated_count
    }


@router.post("/bulk-update")
def bulk_update_by_criteria(
    updates: dict,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Bulk update transactions by criteria (e.g., reclassify all matching transactions)."""
    # Example: {"description_contains": "epargne", "updates": {"type": "Savings", "category": "Rent Guarantee"}}
    description_filter = updates.get("description_contains", "").lower()
    category_filter = updates.get("category_filter")
    new_type = updates.get("updates", {}).get("type")
    new_category = updates.get("updates", {}).get("category")

    if not description_filter and not category_filter:
        raise HTTPException(status_code=400, detail="Must provide filter criteria")
    if not new_type and not new_category:
        raise HTTPException(status_code=400, detail="Must provide updates")

    # Filter by current user
    query = session.query(Transaction).filter(Transaction.user_id == current_user["id"])
    if description_filter:
        query = query.filter(Transaction.description.ilike(f"%{description_filter}%"))
    if category_filter:
        query = query.filter(Transaction.category == category_filter)

    transactions = query.all()
    count = 0
    for trans in transactions:
        if new_type:
            trans.type = new_type
        if new_category:
            trans.category = new_category
        count += 1

    session.commit()
    return {"message": f"Updated {count} transactions"}


def validate_filename(filename: str) -> tuple[bool, str]:
    """
    Validate CSV filename format.

    Bank account files should be named: bank_name.csv (e.g., ubs.csv, bcv.csv)
    Credit card files should be named: cc.csv

    Returns: (is_valid, error_message)
    """
    filename_lower = filename.lower()

    # Check if it's a CSV file
    if not filename_lower.endswith('.csv'):
        return False, "File must be a CSV file (.csv extension)"

    # Check for valid naming patterns
    valid_patterns = ['ubs', 'bcv', 'cc', 'raiffeisen', 'postfinance', 'credit-suisse', 'zkb']

    # Extract base name without extension
    base_name = filename_lower[:-4]  # Remove .csv

    # Check if filename contains any valid bank identifier
    has_valid_pattern = any(pattern in base_name for pattern in valid_patterns)

    if not has_valid_pattern:
        return False, (
            "Invalid filename format. Please name your files:\n"
            "• Bank account: bank_name.csv (e.g., ubs.csv, bcv.csv, raiffeisen.csv)\n"
            "• Credit card: cc.csv"
        )

    return True, ""


@router.post("/upload")
async def upload_csv(
    request: Request,
    ubs_file: Optional[UploadFile] = File(None),
    cc_file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    """Upload bank CSV files for processing (UBS, CC, BCV, or any bank format)."""
    if not ubs_file and not cc_file:
        raise HTTPException(status_code=400, detail="At least one file must be provided")

    # Validate filenames
    if ubs_file:
        is_valid, error_msg = validate_filename(ubs_file.filename)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Bank account file: {error_msg}")

    if cc_file:
        is_valid, error_msg = validate_filename(cc_file.filename)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Credit card file: {error_msg}")

    # Create temp directory for uploads
    upload_dir = Path("temp_uploads")
    upload_dir.mkdir(exist_ok=True)

    uploaded_files = []

    try:
        # Save uploaded files
        if ubs_file:
            file_path = upload_dir / ubs_file.filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(ubs_file.file, f)
            uploaded_files.append(file_path)

        if cc_file:
            file_path = upload_dir / cc_file.filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(cc_file.file, f)
            uploaded_files.append(file_path)

        # Process files with auto-detection
        from ...data_pipeline.extractors import identify_file_type

        pipeline = TransactionPipeline()
        pipeline.setup_database()

        total_stats = {"inserted": 0, "skipped": 0, "errors": 0, "total": 0}

        for file_path in uploaded_files:
            # Auto-detect file type
            file_type = identify_file_type(file_path)

            # Process based on file type
            if file_type == "UBS":
                stats = pipeline._process_ubs_file(str(file_path), user_id=current_user["id"])
            elif file_type == "CC":
                stats = pipeline._process_cc_file(str(file_path), user_id=current_user["id"])
            else:  # BCV or Generic
                stats = pipeline._process_generic_file(str(file_path), file_type, user_id=current_user["id"])

            # Aggregate stats
            total_stats["inserted"] += stats.get("inserted", 0)
            total_stats["skipped"] += stats.get("skipped", 0)
            total_stats["errors"] += stats.get("errors", 0)
            total_stats["total"] += stats.get("total", 0)

        return {
            "message": "Files processed successfully",
            "stats": total_stats,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed. Please check the file format. Error: {str(e)}")

    finally:
        # Cleanup temp files
        for file_path in uploaded_files:
            if file_path.exists():
                file_path.unlink()
