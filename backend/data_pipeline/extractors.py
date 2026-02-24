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


class GenericExtractor:
    """
    Generic CSV extractor that auto-detects format and parses any bank CSV.

    Handles:
    - Auto-detection of separator (comma, semicolon, tab)
    - Auto-detection of header row
    - Intelligent column mapping
    - Multiple date formats
    - Both single-amount and debit/credit columns
    """

    def __init__(self, config: PipelineConfig):
        self.config = config

    def extract(self, filepath: Path, bank_hint: Optional[str] = None) -> List[RawTransaction]:
        """
        Extract transactions from any CSV file using auto-detection.

        Args:
            filepath: Path to the CSV file
            bank_hint: Optional hint about the bank (e.g., 'BCV', 'UBS', 'Generic')

        Returns:
            List of raw transactions
        """
        logger.info(f"Extracting transactions from: {filepath} (bank_hint: {bank_hint})")

        # Step 1: Detect CSV format (separator, encoding, header row)
        separator, encoding, header_row_idx = self._detect_format(filepath)
        logger.info(f"Detected format: sep='{separator}', encoding={encoding}, header_row={header_row_idx}")

        # Step 2: Read CSV with detected settings
        df = pd.read_csv(
            filepath,
            sep=separator,
            encoding=encoding,
            skiprows=header_row_idx,
        )

        # Sanitize column names
        df.columns = df.columns.str.lower().str.strip()

        # Step 3: Map columns to standard fields
        column_map = self._map_columns(df.columns.tolist())
        logger.info(f"Column mapping: {column_map}")

        # Step 4: Parse rows
        transactions = []
        for _, row in df.iterrows():
            transaction = self._parse_row(row, column_map, bank_hint or "Generic")
            if transaction:
                transactions.append(transaction)

        logger.info(f"Extracted {len(transactions)} transactions")
        return transactions

    def _detect_format(self, filepath: Path) -> Tuple[str, str, int]:
        """
        Auto-detect CSV format: separator, encoding, and header row index.

        Returns:
            Tuple of (separator, encoding, header_row_index)
        """
        # Try different separators
        separators = [';', ',', '\t', '|']
        encodings = ['utf-8', 'utf-8-sig', 'latin1', 'iso-8859-1']

        best_sep = ','
        best_encoding = 'utf-8'
        best_cols = 0
        header_row_idx = 0

        # Read first 20 lines to detect format
        with open(filepath, 'rb') as f:
            first_bytes = f.read(4)
            # Check for BOM (UTF-8 with BOM starts with EF BB BF)
            if first_bytes.startswith(b'\xef\xbb\xbf'):
                encodings = ['utf-8-sig'] + encodings

        for encoding in encodings:
            for sep in separators:
                try:
                    # Try reading first 15 rows
                    df_test = pd.read_csv(filepath, sep=sep, encoding=encoding, nrows=15)

                    # Check if we have more than 2 columns
                    if len(df_test.columns) > 2:
                        # Find first row that looks like a header (non-numeric, >2 columns)
                        for idx in range(min(10, len(df_test))):
                            row_data = df_test.iloc[idx] if idx < len(df_test) else df_test.columns

                            # Check if row has mostly text (likely header)
                            text_cols = sum(1 for val in row_data if isinstance(val, str) and not str(val).replace('.', '').replace('-', '').replace(',', '').isdigit())

                            if text_cols > 2 and len(df_test.columns) > best_cols:
                                best_sep = sep
                                best_encoding = encoding
                                best_cols = len(df_test.columns)
                                header_row_idx = idx
                                break
                except Exception:
                    continue

        return best_sep, best_encoding, header_row_idx

    def _map_columns(self, headers: List[str]) -> Dict[str, str]:
        """
        Intelligently map column headers to standard fields.

        Returns:
            Dict mapping standard fields to actual column names:
            {
                'date': 'trade date',  # Column name for date
                'amount': 'montant',   # Column name for amount (if single column)
                'debit': 'debit',     # Column name for debit (if separate)
                'credit': 'credit',   # Column name for credit (if separate)
                'description': ['description', 'booking text'],  # List of description columns
            }
        """
        column_map = {}

        # Find date column
        date_patterns = ['date', 'datum', 'data']
        for header in headers:
            if any(pattern in header for pattern in date_patterns):
                column_map['date'] = header
                break

        # Find amount columns (single or debit/credit)
        amount_patterns = ['montant', 'amount', 'betrag']
        debit_patterns = ['debit', 'débit', 'soll']
        credit_patterns = ['credit', 'crédit', 'haben']

        for header in headers:
            if any(pattern in header for pattern in debit_patterns):
                column_map['debit'] = header
            elif any(pattern in header for pattern in credit_patterns):
                column_map['credit'] = header
            elif any(pattern in header for pattern in amount_patterns):
                column_map['amount'] = header

        # Find description columns
        desc_patterns = ['description', 'booking', 'text', 'libellé', 'libelle']
        column_map['description'] = []
        for header in headers:
            if any(pattern in header for pattern in desc_patterns):
                column_map['description'].append(header)

        # If no description columns found, use sector or category
        if not column_map['description']:
            for header in headers:
                if 'sector' in header or 'categor' in header:
                    column_map['description'].append(header)

        return column_map

    def _parse_row(self, row: pd.Series, column_map: Dict, bank_name: str) -> Optional[RawTransaction]:
        """Parse a single transaction row using the column mapping."""
        # Parse date
        date_col = column_map.get('date')
        if not date_col or pd.isna(row.get(date_col)):
            return None

        date_str = str(row.get(date_col))
        date = self._parse_date(date_str)
        if not date:
            return None

        # Parse amount (handle single column or debit/credit)
        amount, is_credit = self._parse_amount(row, column_map)
        if amount is None or amount == 0:
            return None

        # Build description
        description = self._build_description(row, column_map)

        return RawTransaction(
            date=date,
            amount=amount,
            is_credit=is_credit,
            description=description,
            source=bank_name,
            raw_data=row.to_dict(),
        )

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """
        Try to parse date using multiple formats.

        Supports:
        - YYYY-MM-DD (UBS)
        - DD.MM.YYYY (CC)
        - DD.MM.YY (BCV)
        - DD/MM/YYYY
        - DD-MM-YYYY
        """
        date_formats = [
            '%Y-%m-%d',      # 2025-09-30
            '%d.%m.%Y',      # 30.09.2025
            '%d.%m.%y',      # 30.09.25
            '%d/%m/%Y',      # 30/09/2025
            '%d-%m-%Y',      # 30-09-2025
            '%Y/%m/%d',      # 2025/09/30
        ]

        for fmt in date_formats:
            try:
                return pd.to_datetime(date_str, format=fmt)
            except Exception:
                continue

        # If all formats fail, try pandas auto-detection
        try:
            return pd.to_datetime(date_str)
        except Exception:
            logger.warning(f"Could not parse date: {date_str}")
            return None

    def _parse_amount(self, row: pd.Series, column_map: Dict) -> Tuple[Optional[float], bool]:
        """
        Parse amount from row, handling both single-column and debit/credit formats.

        Returns:
            Tuple of (amount, is_credit)
        """
        # Check for separate debit/credit columns (UBS/CC style)
        if 'debit' in column_map and 'credit' in column_map:
            credit_val = row.get(column_map['credit'])
            debit_val = row.get(column_map['debit'])

            if pd.notna(credit_val) and float(credit_val) > 0:
                return float(credit_val), True
            elif pd.notna(debit_val) and float(debit_val) != 0:
                return abs(float(debit_val)), False
            else:
                return None, False

        # Check for single amount column (BCV style)
        elif 'amount' in column_map:
            amount_val = row.get(column_map['amount'])
            if pd.notna(amount_val):
                amount_float = float(amount_val)
                is_credit = amount_float > 0
                return abs(amount_float), is_credit
            else:
                return None, False

        return None, False

    def _build_description(self, row: pd.Series, column_map: Dict) -> str:
        """Build description from one or more description columns."""
        desc_parts = []

        for col_name in column_map.get('description', []):
            val = row.get(col_name)
            if pd.notna(val) and str(val).strip():
                desc_parts.append(str(val).strip())

        return " | ".join(desc_parts) if desc_parts else "No description"


def identify_file_type(filepath: Path) -> Optional[str]:
    """
    Identify if a file is a UBS, CC, BCV, or generic CSV based on filename or content.

    Args:
        filepath: Path to the CSV file

    Returns:
        'UBS', 'CC', 'BCV', or 'Generic'
    """
    filename = filepath.name.lower()

    # Filename-based detection
    if "ubs" in filename:
        return "UBS"
    elif "cc" in filename or "invoice" in filename:
        return "CC"
    elif "bcv" in filename or "transactions" in filename:
        return "BCV"
    else:
        # Use generic extractor for unknown formats
        return "Generic"
