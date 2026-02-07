"""
Transformers for categorizing and enriching raw transactions.

Applies business logic to categorize transactions based on:
- Source (UBS vs CC)
- Description patterns
- Sector information (for CC)
"""

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .config import CategoryMapping, PipelineConfig
from .extractors import RawTransaction
from .models import DatabaseManager, CategorizationRule

logger = logging.getLogger(__name__)


@dataclass
class TransformedTransaction:
    """Fully categorized and transformed transaction ready for loading."""

    date: datetime
    type: str  # Income, Expenses, Savings, CC_Refund, No-Label
    category: str
    amount: float  # Always positive (absolute value)
    description: Optional[str]
    source: str  # UBS or CC
    source_file: Optional[str]
    transaction_hash: str  # For deduplication


class TransactionTransformer:
    """Transform and categorize raw transactions."""

    def __init__(self, config: PipelineConfig, db_manager: Optional[DatabaseManager] = None):
        self.config = config
        self.categories = config.categories
        self.db_manager = db_manager or DatabaseManager()
        self._rules_cache = None
        self._rules_cache_time = None

    def transform(
        self,
        transactions: List[RawTransaction],
        source_file: Optional[str] = None,
    ) -> List[TransformedTransaction]:
        """
        Transform a list of raw transactions into categorized transactions.

        Args:
            transactions: List of raw transactions
            source_file: Optional filename for tracking

        Returns:
            List of transformed transactions
        """
        transformed = []

        for raw in transactions:
            try:
                if raw.source == "UBS":
                    result = self._transform_ubs(raw)
                else:
                    result = self._transform_cc(raw)

                if result:
                    result.source_file = source_file
                    result.transaction_hash = self._generate_hash(raw)
                    transformed.append(result)

            except Exception as e:
                logger.warning(f"Failed to transform transaction: {e}")
                continue

        logger.info(f"Transformed {len(transformed)} transactions")
        return transformed

    def _get_active_rules(self) -> List[CategorizationRule]:
        """Get active categorization rules from database, ordered by priority."""
        import time

        # Cache rules for 60 seconds to avoid repeated DB queries
        if self._rules_cache is not None and self._rules_cache_time:
            if time.time() - self._rules_cache_time < 60:
                return self._rules_cache

        session = self.db_manager.get_session()
        try:
            rules = session.query(CategorizationRule).filter(
                CategorizationRule.is_active.is_(True)
            ).order_by(
                CategorizationRule.priority.desc(),
                CategorizationRule.created_at.desc()
            ).all()

            self._rules_cache = rules
            self._rules_cache_time = time.time()
            return rules
        except Exception as e:
            logger.warning(f"Failed to load categorization rules: {e}")
            return []
        finally:
            session.close()

    def _check_custom_rules(self, description: str, amount: float = 0) -> Optional[Tuple[str, str]]:
        """
        Check if description and amount match any custom categorization rules.

        Args:
            description: Transaction description
            amount: Transaction amount

        Returns:
            Tuple of (type, category) if match found, None otherwise
        """
        if not description:
            return None

        rules = self._get_active_rules()

        for rule in rules:
            # Check pattern match
            pattern = rule.pattern
            desc_to_check = description if rule.case_sensitive else description.lower()
            pattern_to_check = pattern if rule.case_sensitive else pattern.lower()

            if pattern_to_check not in desc_to_check:
                continue

            # Pattern matches, now check amount condition if present
            if rule.amount_operator and rule.amount_value is not None:
                amount_value = float(rule.amount_value)

                if rule.amount_operator == "eq" and amount != amount_value:
                    continue
                elif rule.amount_operator == "gte" and amount < amount_value:
                    continue
                elif rule.amount_operator == "lte" and amount > amount_value:
                    continue
                elif rule.amount_operator == "gt" and amount <= amount_value:
                    continue
                elif rule.amount_operator == "lt" and amount >= amount_value:
                    continue

            # Both pattern and amount conditions match (or no amount condition)
            amount_info = f", amount {rule.amount_operator} {rule.amount_value}" if rule.amount_operator else ""
            logger.info(f"Custom rule matched: '{pattern}'{amount_info} -> {rule.type}/{rule.category}")
            return (rule.type, rule.category)

        return None

    def _transform_ubs(self, raw: RawTransaction) -> Optional[TransformedTransaction]:
        """Transform a UBS bank transaction."""
        raw_data = raw.raw_data
        desc1 = str(raw_data.get("description1", "")).lower()
        desc2 = str(raw_data.get("description2", "")).lower()
        desc3 = str(raw_data.get("description3", "")).lower()

        # Check custom rules first
        full_description = raw.description or ""
        custom_match = self._check_custom_rules(full_description, raw.amount)

        if custom_match:
            trans_type, category = custom_match
        elif raw.is_credit:
            # Income transaction
            trans_type = "Income"
            category = self._categorize_ubs_income(desc1, desc2, desc3)
        else:
            # Expense or special transaction
            trans_type, category = self._categorize_ubs_expense(desc1, desc2, desc3)

        return TransformedTransaction(
            date=raw.date,
            type=trans_type,
            category=category,
            amount=raw.amount,  # Already positive from extractor
            description=raw.description,
            source="UBS",
            source_file=None,
            transaction_hash="",
        )

    def _transform_cc(self, raw: RawTransaction) -> Optional[TransformedTransaction]:
        """Transform a Credit Card transaction."""
        raw_data = raw.raw_data
        sector = str(raw_data.get("sector", "")).lower()
        booking_text = str(raw_data.get("booking text", "")).lower()

        # Check custom rules first
        full_description = raw.description or ""
        custom_match = self._check_custom_rules(full_description, raw.amount)

        if custom_match:
            trans_type, category = custom_match
        elif raw.is_credit:
            # CC Credit = payment/refund
            trans_type = "CC_Refund"
            category = "Card Refund Luca"
        else:
            # CC Expense
            trans_type, category = self._categorize_cc_expense(sector, booking_text)

        return TransformedTransaction(
            date=raw.date,
            type=trans_type,
            category=category,
            amount=raw.amount,  # Already positive from extractor
            description=raw.description,
            source="CC",
            source_file=None,
            transaction_hash="",
        )

    def _categorize_ubs_income(
        self, desc1: str, desc2: str, desc3: str
    ) -> str:
        """Categorize a UBS income transaction."""
        # Check for employment (salary)
        if "webloyalty sarl" in desc1 and "salaire" in desc3:
            return "Employment"

        # Check for TWINT chargebacks
        if "credit ubs twint" in desc2:
            return "Extras / Twint Chargeback"

        # Check for specific income sources based on patterns
        if any(x in desc1 for x in ["etat de vaud", "civil et mil"]):
            return "Side Hustle"

        # Check for rent from roommate
        if "loyer" in desc3.lower():
            return "Side Hustle"

        # Default to Side Hustle for unrecognized income
        return "Side Hustle"

    def _categorize_ubs_expense(
        self, desc1: str, desc2: str, desc3: str
    ) -> tuple[str, str]:
        """
        Categorize a UBS expense transaction.

        Returns:
            Tuple of (transaction_type, category)
        """
        # Check for Card Center (CC refund from bank perspective)
        if "ubs card center ag" in desc1 or "card center" in desc1:
            return ("CC_Refund", "Card Refund Luca")

        # Check for Train (SBB Mobile)
        if "sbb mobile" in desc1 or "sbb" in desc1:
            return ("Expenses", "Train")

        # Check for Housing (Rent)
        if "pilet + renaud" in desc1:
            return ("Expenses", "Housing")

        # Check for Health Insurance
        if "assura" in desc1:
            return ("Expenses", "Health Insurance")

        # Check for Internet + Mobile
        if "swisscom" in desc1:
            return ("Expenses", "Internet + Mobile")

        # Check for Groceries (Coop, Migros stores)
        if any(x in desc1 for x in ["coop", "migros"]):
            # Distinguish gas stations from grocery stores
            if "pronto" in desc1 and any(x in desc1 for x in ["tankstelle", "gasoline"]):
                return ("Expenses", "Car")
            return ("Expenses", "Groceries")

        # Check for utilities (SIG - Services Industriels de Genève)
        if "services industriels" in desc1:
            return ("Expenses", "Home Utils")

        # Check for ATM withdrawal
        if "bancomat" in desc2 or "withdrawal" in desc2:
            return ("Expenses", "Withdraw")

        # Check for CC fees (balance closing)
        if "balance closing" in desc1 or "service prices" in desc1:
            return ("Expenses", "CC fees")

        # Check for debt payments (personal transfers)
        if "debit ubs twint" in desc2:
            # Personal TWINT transfers - could be debt or extras
            return ("Expenses", "Extras")

        # Unrecognized - return as Uncategorized for manual review
        return ("No-Label", "Uncategorized")

    def _categorize_cc_expense(self, sector: str, booking_text: str) -> tuple[str, str]:
        """
        Categorize a Credit Card expense transaction.

        Returns:
            Tuple of (transaction_type, category)
        """
        # Check sector patterns from config
        for pattern, category in self.categories.cc_sector_patterns.items():
            if pattern in sector:
                return ("Expenses", category)

        # If no sector match, return as No-Label / Uncategorized
        if not sector:
            # No sector info (e.g., interest charges)
            if "interets" in booking_text or "interest" in booking_text:
                return ("Expenses", "CC fees")

        # Unrecognized - return as Uncategorized for manual review
        return ("No-Label", "Uncategorized")

    def _generate_hash(self, raw: RawTransaction) -> str:
        """
        Generate a unique hash for deduplication.

        Hash is based on: date, amount, source, and key description elements.
        """
        # Build a consistent string for hashing
        hash_parts = [
            raw.date.strftime("%Y-%m-%d"),
            f"{raw.amount:.2f}",
            raw.source,
            "credit" if raw.is_credit else "debit",
        ]

        # Add description elements
        if raw.source == "UBS":
            # Use description1 and transaction no if available
            desc1 = str(raw.raw_data.get("description1", ""))
            trans_no = str(raw.raw_data.get("transaction no.", ""))
            hash_parts.extend([desc1[:50], trans_no])
        else:
            # Use sector and booking text
            sector = str(raw.raw_data.get("sector", ""))
            booking = str(raw.raw_data.get("booking text", ""))
            hash_parts.extend([sector[:30], booking[:30]])

        hash_string = "|".join(hash_parts)
        return hashlib.sha256(hash_string.encode()).hexdigest()


class TransactionValidator:
    """Validate transformed transactions."""

    def __init__(self, config: PipelineConfig):
        self.config = config
        self.categories = config.categories

    def validate(
        self, transactions: List[TransformedTransaction]
    ) -> tuple[List[TransformedTransaction], List[dict]]:
        """
        Validate transactions and return valid ones plus error list.

        Returns:
            Tuple of (valid_transactions, errors)
        """
        valid = []
        errors = []

        for trans in transactions:
            error = self._validate_single(trans)
            if error:
                errors.append({"transaction": trans, "error": error})
            else:
                valid.append(trans)

        if errors:
            logger.warning(f"Validation: {len(valid)} valid, {len(errors)} invalid")

        return valid, errors

    def _validate_single(self, trans: TransformedTransaction) -> Optional[str]:
        """Validate a single transaction. Returns error message or None."""
        # Check type is valid
        if trans.type not in self.categories.valid_types:
            return f"Invalid transaction type: {trans.type}"

        # Check amount is positive
        if trans.amount <= 0:
            return f"Amount must be positive: {trans.amount}"

        # Check date is reasonable (not in future, not too old)
        if trans.date > datetime.now():
            return f"Date is in the future: {trans.date}"

        return None
