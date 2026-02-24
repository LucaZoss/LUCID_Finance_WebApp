"""
Transaction CRUD endpoints for managing financial transactions.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Request
from sqlalchemy.orm import Session
from pathlib import Path
import shutil

from ..dependencies import get_db, get_current_user
from ..schemas import TransactionResponse, TransactionUpdate, BulkTransactionUpdate
from ...data_pipeline.models import Transaction
from ...data_pipeline.pipeline import TransactionPipeline

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


def auto_set_sub_type(category: str, sub_type: Optional[str]) -> Optional[str]:
    """Auto-set sub_type to 'Essentials' for Housing and Health Insurance categories."""
    if category in ["Housing", "Health Insurance"]:
        return "Essentials"
    return sub_type


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

    if update.type is not None:
        transaction.type = update.type
    if update.category is not None:
        transaction.category = update.category
        # Auto-set sub_type for Housing and Health Insurance
        transaction.sub_type = auto_set_sub_type(update.category, update.sub_type)
    elif update.sub_type is not None:
        # If only sub_type is being updated, apply auto-set logic
        transaction.sub_type = auto_set_sub_type(transaction.category, update.sub_type)

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
        if bulk_update.type is not None:
            transaction.type = bulk_update.type
        if bulk_update.category is not None:
            transaction.category = bulk_update.category
            # Auto-set sub_type for Housing and Health Insurance
            transaction.sub_type = auto_set_sub_type(bulk_update.category, bulk_update.sub_type)
        elif bulk_update.sub_type is not None:
            # If only sub_type is being updated, apply auto-set logic
            transaction.sub_type = auto_set_sub_type(transaction.category, bulk_update.sub_type)
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
