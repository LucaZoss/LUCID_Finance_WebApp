"""
Loaders for persisting transformed transactions to MySQL database.

Handles:
- Bulk inserts with deduplication
- Processed file tracking
- Transaction counting and validation
"""

import logging
from datetime import datetime
from typing import List, Optional, Set

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from .models import Transaction, ProcessedFile, DatabaseManager
from .transformers import TransformedTransaction
from .config import PipelineConfig

logger = logging.getLogger(__name__)


class TransactionLoader:
    """Load transformed transactions into MySQL database."""

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    def load(
        self,
        transactions: List[TransformedTransaction],
        session: Optional[Session] = None,
    ) -> dict:
        """
        Load transactions into the database.

        Args:
            transactions: List of transformed transactions
            session: Optional existing session (creates new if not provided)

        Returns:
            Dict with load statistics
        """
        own_session = session is None
        if own_session:
            session = self.db_manager.get_session()

        try:
            # Get existing hashes for deduplication
            existing_hashes = self._get_existing_hashes(session)

            inserted = 0
            skipped = 0
            errors = 0

            for trans in transactions:
                # Skip if already exists
                if trans.transaction_hash in existing_hashes:
                    skipped += 1
                    continue

                try:
                    transaction = Transaction(
                        date=trans.date.date() if isinstance(trans.date, datetime) else trans.date,
                        type=trans.type,
                        category=trans.category,
                        amount=trans.amount,
                        description=trans.description,
                        source=trans.source,
                        month=trans.date.month,
                        year=trans.date.year,
                        source_file=trans.source_file,
                        transaction_hash=trans.transaction_hash,
                    )
                    session.add(transaction)
                    existing_hashes.add(trans.transaction_hash)
                    inserted += 1

                except Exception as e:
                    logger.error(f"Error inserting transaction: {e}")
                    errors += 1

            if own_session:
                session.commit()

            stats = {
                "total": len(transactions),
                "inserted": inserted,
                "skipped": skipped,
                "errors": errors,
            }

            logger.info(
                f"Loaded transactions: {inserted} inserted, {skipped} skipped, {errors} errors"
            )
            return stats

        except Exception as e:
            if own_session:
                session.rollback()
            logger.error(f"Error loading transactions: {e}")
            raise

        finally:
            if own_session:
                session.close()

    def _get_existing_hashes(self, session: Session) -> Set[str]:
        """Get all existing transaction hashes for deduplication."""
        result = session.query(Transaction.transaction_hash).all()
        return {r[0] for r in result}


class ProcessedFileTracker:
    """Track which files have been processed."""

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    def is_processed(self, filename: str, session: Optional[Session] = None) -> bool:
        """Check if a file has already been processed."""
        own_session = session is None
        if own_session:
            session = self.db_manager.get_session()

        try:
            exists = (
                session.query(ProcessedFile)
                .filter(ProcessedFile.filename == filename)
                .first()
            )
            return exists is not None

        finally:
            if own_session:
                session.close()

    def mark_processed(
        self,
        filename: str,
        file_type: str,
        record_count: int,
        session: Optional[Session] = None,
    ) -> None:
        """Mark a file as processed."""
        own_session = session is None
        if own_session:
            session = self.db_manager.get_session()

        try:
            processed_file = ProcessedFile(
                filename=filename,
                file_type=file_type,
                record_count=record_count,
            )
            session.add(processed_file)

            if own_session:
                session.commit()

            logger.info(f"Marked as processed: {filename} ({record_count} records)")

        except IntegrityError:
            if own_session:
                session.rollback()
            logger.warning(f"File already marked as processed: {filename}")

        finally:
            if own_session:
                session.close()

    def get_processed_files(self, session: Optional[Session] = None) -> List[str]:
        """Get list of all processed filenames."""
        own_session = session is None
        if own_session:
            session = self.db_manager.get_session()

        try:
            result = session.query(ProcessedFile.filename).all()
            return [r[0] for r in result]

        finally:
            if own_session:
                session.close()


class TransactionExporter:
    """Export transactions to CSV format (for compatibility with Excel workflow)."""

    def __init__(self, db_manager: DatabaseManager, config: PipelineConfig):
        self.db_manager = db_manager
        self.config = config

    def export_to_csv(
        self,
        filepath: str,
        year: Optional[int] = None,
        month: Optional[int] = None,
        session: Optional[Session] = None,
    ) -> int:
        """
        Export transactions to CSV file.

        Args:
            filepath: Output file path
            year: Optional filter by year
            month: Optional filter by month
            session: Optional existing session

        Returns:
            Number of exported records
        """
        import csv

        own_session = session is None
        if own_session:
            session = self.db_manager.get_session()

        try:
            query = session.query(Transaction)

            if year:
                query = query.filter(Transaction.year == year)
            if month:
                query = query.filter(Transaction.month == month)

            query = query.order_by(Transaction.date)
            transactions = query.all()

            with open(filepath, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                # Header matching SOURCE_SAMPLE.csv format
                writer.writerow(["date", "Type", "Category", "Amount", "abs_Amount", ""])

                for trans in transactions:
                    # Format date as DD.MM.YYYY
                    date_str = trans.date.strftime(self.config.output_date_format)
                    # Amount column (could be signed for backward compat)
                    # abs_Amount is always positive
                    writer.writerow([
                        date_str,
                        trans.type,
                        trans.category,
                        float(trans.amount),  # Already absolute
                        float(trans.amount),  # Same as amount since we store absolute
                        "",
                    ])

            logger.info(f"Exported {len(transactions)} transactions to {filepath}")
            return len(transactions)

        finally:
            if own_session:
                session.close()

    def get_summary(
        self,
        year: int,
        month: Optional[int] = None,
        session: Optional[Session] = None,
    ) -> dict:
        """
        Get summary statistics for a period.

        Returns:
            Dict with income, expenses, savings totals
        """
        own_session = session is None
        if own_session:
            session = self.db_manager.get_session()

        try:
            query = session.query(
                Transaction.type,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("count"),
            ).filter(Transaction.year == year)

            if month:
                query = query.filter(Transaction.month == month)

            query = query.group_by(Transaction.type)
            results = query.all()

            summary = {
                "year": year,
                "month": month,
                "income": 0.0,
                "expenses": 0.0,
                "savings": 0.0,
                "transactions": 0,
            }

            for trans_type, total, count in results:
                if trans_type == "Income":
                    summary["income"] = float(total or 0)
                elif trans_type == "Expenses":
                    summary["expenses"] = float(total or 0)
                elif trans_type == "Savings":
                    summary["savings"] = float(total or 0)
                summary["transactions"] += count

            summary["net"] = summary["income"] - summary["expenses"] - summary["savings"]

            return summary

        finally:
            if own_session:
                session.close()
