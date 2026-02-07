"""
Extractors for reading and parsing bank transaction CSV files.

Handles:
- UBS bank account transactions
- Credit Card (CC) invoice transactions
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

from .config import PipelineConfig

logger = logging.getLogger(__name__)


@dataclass
class RawTransaction:
    """Raw transaction data extracted from CSV before transformation."""

    date: datetime
    amount: float
    is_credit: bool  # True for income/credit, False for debit/expense
    description: str
    source: str  # 'UBS' or 'CC'
    raw_data: Dict  # Original row data for debugging


@dataclass
class UBSMetadata:
    """Metadata extracted from UBS CSV file header."""

    account_number: Optional[str] = None
    iban: Optional[str] = None
    period_from: Optional[str] = None
    period_until: Optional[str] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    transaction_count: Optional[int] = None


class UBSExtractor:
    """Extract transactions from UBS bank account CSV files."""

    def __init__(self, config: PipelineConfig):
        self.config = config

    def extract(self, filepath: Path) -> Tuple[UBSMetadata, List[RawTransaction]]:
        """
        Extract transactions from a UBS CSV file.

        Args:
            filepath: Path to the UBS CSV file

        Returns:
            Tuple of (metadata, list of raw transactions)
        """
        logger.info(f"Extracting UBS transactions from: {filepath}")

        # Extract metadata from header rows
        metadata = self._extract_metadata(filepath)

        # Read transaction data (skip metadata rows)
        df = pd.read_csv(
            filepath,
            sep=self.config.ubs_separator,
            encoding=self.config.ubs_encoding,
            skiprows=self.config.ubs_skiprows,
        )

        # Sanitize column names
        df.columns = df.columns.str.lower().str.strip()

        # Convert string values to lowercase for consistent matching
        for col in df.select_dtypes(include=["object"]).columns:
            df[col] = df[col].apply(lambda x: x.lower() if isinstance(x, str) else x)

        transactions = []
        for _, row in df.iterrows():
            transaction = self._parse_row(row)
            if transaction:
                transactions.append(transaction)

        logger.info(f"Extracted {len(transactions)} UBS transactions")
        return metadata, transactions

    def _extract_metadata(self, filepath: Path) -> UBSMetadata:
        """Extract metadata from the first rows of UBS CSV."""
        try:
            meta_df = pd.read_csv(
                filepath,
                sep=self.config.ubs_separator,
                encoding=self.config.ubs_encoding,
                nrows=self.config.ubs_metadata_rows,
                header=None,
                index_col=0,
                usecols=[0, 1],
            ).squeeze("columns")

            # Clean index
            meta_df.index = meta_df.index.str.replace(":", "").str.strip()
            meta_dict = meta_df.to_dict()

            return UBSMetadata(
                account_number=meta_dict.get("Account number"),
                iban=meta_dict.get("IBAN"),
                period_from=meta_dict.get("From"),
                period_until=meta_dict.get("Until"),
                opening_balance=self._parse_float(meta_dict.get("Opening balance")),
                closing_balance=self._parse_float(meta_dict.get("Closing balance")),
                transaction_count=self._parse_int(
                    meta_dict.get("Numbers of transactions in this period")
                ),
            )
        except Exception as e:
            logger.warning(f"Could not extract UBS metadata: {e}")
            return UBSMetadata()

    def _parse_row(self, row: pd.Series) -> Optional[RawTransaction]:
        """Parse a single UBS transaction row."""
        # Skip rows without a trade date
        trade_date = row.get("trade date")
        if pd.isna(trade_date):
            return None

        # Parse date
        try:
            date = pd.to_datetime(trade_date)
        except Exception:
            logger.warning(f"Could not parse date: {trade_date}")
            return None

        # Determine if credit or debit
        credit = row.get("credit")
        debit = row.get("debit")

        if pd.notna(credit) and credit > 0:
            amount = float(credit)
            is_credit = True
        elif pd.notna(debit) and debit < 0:
            amount = abs(float(debit))  # Convert to positive
            is_credit = False
        else:
            # No valid amount
            return None

        # Build description from description columns
        desc_parts = []
        for col in ["description1", "description2", "description3"]:
            val = row.get(col)
            if pd.notna(val) and val:
                desc_parts.append(str(val))
        description = " | ".join(desc_parts)

        return RawTransaction(
            date=date,
            amount=amount,
            is_credit=is_credit,
            description=description,
            source="UBS",
            raw_data=row.to_dict(),
        )

    @staticmethod
    def _parse_float(value) -> Optional[float]:
        """Safely parse a float value."""
        if value is None or pd.isna(value):
            return None
        try:
            return float(str(value).replace(",", "."))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_int(value) -> Optional[int]:
        """Safely parse an integer value."""
        if value is None or pd.isna(value):
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None


class CCExtractor:
    """Extract transactions from Credit Card invoice CSV files."""

    def __init__(self, config: PipelineConfig):
        self.config = config

    def extract(self, filepath: Path) -> List[RawTransaction]:
        """
        Extract transactions from a Credit Card CSV file.

        Args:
            filepath: Path to the CC CSV file

        Returns:
            List of raw transactions
        """
        logger.info(f"Extracting CC transactions from: {filepath}")

        # Read CSV (skip the sep=; header row)
        df = pd.read_csv(
            filepath,
            sep=self.config.cc_separator,
            encoding=self.config.cc_encoding,
            skiprows=self.config.cc_skiprows,
        )

        # Sanitize column names
        df.columns = df.columns.str.lower().str.strip()

        # Convert string values to lowercase
        for col in df.select_dtypes(include=["object"]).columns:
            df[col] = df[col].apply(lambda x: x.lower() if isinstance(x, str) else x)

        transactions = []
        for _, row in df.iterrows():
            transaction = self._parse_row(row)
            if transaction:
                transactions.append(transaction)

        logger.info(f"Extracted {len(transactions)} CC transactions")
        return transactions

    def _parse_row(self, row: pd.Series) -> Optional[RawTransaction]:
        """Parse a single CC transaction row."""
        # Skip rows without purchase date or sector
        purchase_date = row.get("purchase date")
        if pd.isna(purchase_date):
            return None

        # Parse date (format: DD.MM.YYYY)
        try:
            date = pd.to_datetime(purchase_date, format="%d.%m.%Y")
        except Exception:
            logger.warning(f"Could not parse CC date: {purchase_date}")
            return None

        # Get amount - CC transactions are expenses (debit)
        # But credits exist (e.g., "VOTRE PAIEMENT QR" refunds)
        amount = row.get("amount", 0)
        debit = row.get("debit")
        credit = row.get("credit")

        if pd.notna(credit) and credit > 0:
            # This is a payment/refund (credit to the card)
            is_credit = True
            amount = float(credit)
        else:
            # This is an expense (debit from the card)
            is_credit = False
            amount = abs(float(amount)) if pd.notna(amount) else 0

        if amount == 0:
            return None

        # Build description
        sector = str(row.get("sector", "")) if pd.notna(row.get("sector")) else ""
        booking_text = str(row.get("booking text", "")) if pd.notna(row.get("booking text")) else ""
        description = f"{sector} - {booking_text}".strip(" -")

        return RawTransaction(
            date=date,
            amount=amount,
            is_credit=is_credit,
            description=description,
            source="CC",
            raw_data=row.to_dict(),
        )


def identify_file_type(filepath: Path) -> Optional[str]:
    """
    Identify if a file is a UBS or CC CSV based on filename.

    Args:
        filepath: Path to the CSV file

    Returns:
        'UBS', 'CC', or None if unknown
    """
    filename = filepath.name.lower()

    if "ubs" in filename:
        return "UBS"
    elif "cc" in filename or "invoice" in filename:
        return "CC"
    else:
        return None
