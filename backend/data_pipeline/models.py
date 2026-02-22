"""SQLAlchemy models for the budget tracking database."""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    Numeric,
    Text,
    Boolean,
    Index,
    UniqueConstraint,
    ForeignKey,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.engine import Engine

from .config import DatabaseConfig

Base = declarative_base()


class Transaction(Base):
    """
    Main transaction table storing all categorized transactions.

    This mirrors the SOURCE sheet structure from the Excel budget file.
    """

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Core transaction data
    date = Column(Date, nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # Income, Expenses, Savings, CC_Refund, No-Label
    category = Column(String(100), nullable=False, index=True)
    sub_type = Column(String(50), nullable=True)  # Essentials, Needs, Wants
    amount = Column(Numeric(12, 2), nullable=False)  # Always positive (absolute value)

    # Additional metadata
    description = Column(Text, nullable=True)  # Original description from bank
    source = Column(String(20), nullable=False)  # 'UBS' or 'CC'

    # Derived fields for easier querying
    month = Column(Integer, nullable=False, index=True)  # 1-12
    year = Column(Integer, nullable=False, index=True)

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    source_file = Column(String(255), nullable=True)  # Which file this came from

    # Hash for deduplication (per-user unique)
    transaction_hash = Column(String(64), nullable=False)

    __table_args__ = (
        Index("idx_year_month", "year", "month"),
        Index("idx_type_category", "type", "category"),
        Index("idx_user_date", "user_id", "date"),
        UniqueConstraint("user_id", "transaction_hash", name="uq_user_transaction_hash"),
    )

    def __repr__(self) -> str:
        return (
            f"<Transaction(id={self.id}, date={self.date}, "
            f"type={self.type}, category={self.category}, amount={self.amount})>"
        )

    @classmethod
    def from_dict(cls, data: dict) -> "Transaction":
        """Create a Transaction instance from a dictionary."""
        return cls(
            date=data["date"],
            type=data["type"],
            category=data["category"],
            amount=data["amount"],
            description=data.get("description"),
            source=data["source"],
            month=data["date"].month,
            year=data["date"].year,
            source_file=data.get("source_file"),
            transaction_hash=data["transaction_hash"],
        )


class ProcessedFile(Base):
    """
    Track which files have been processed to avoid duplicate processing.

    This replaces the processed_files.txt approach from the original script.
    """

    __tablename__ = "processed_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)  # 'UBS' or 'CC'
    processed_at = Column(DateTime, default=datetime.utcnow)
    record_count = Column(Integer, nullable=True)  # Number of transactions extracted

    __table_args__ = (UniqueConstraint("user_id", "filename", name="uq_user_filename"),)

    def __repr__(self) -> str:
        return f"<ProcessedFile(filename={self.filename}, processed_at={self.processed_at})>"


class BudgetPlan(Base):
    """
    Budget planning table - stores planned budget amounts per category per month.

    This mirrors the Budget Planning sheet structure.
    """

    __tablename__ = "budget_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=True)  # 1-12, NULL for yearly budgets
    type = Column(String(50), nullable=False)  # Income, Expenses, Savings
    category = Column(String(100), nullable=False)
    sub_type = Column(String(50), nullable=True)  # Essentials, Needs, Wants
    amount = Column(Numeric(12, 2), nullable=False, default=0)  # Renamed from planned_amount for consistency

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", "type", "category", name="uq_user_budget_plan"),
        Index("idx_budget_year_month", "year", "month"),
        Index("idx_budget_user", "user_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<BudgetPlan(year={self.year}, month={self.month}, "
            f"category={self.category}, amount={self.amount})>"
        )


class Category(Base):
    """
    Category reference table for maintaining valid categories.

    This helps enforce data integrity and provides category metadata.
    """

    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # Income, Expenses, Savings
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_category_name"),
        Index("idx_category_user", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Category(name={self.name}, type={self.type})>"


class User(Base):
    """
    User authentication table for login and access control.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_username", "username"),
    )

    def __repr__(self) -> str:
        return f"<User(username={self.username}, is_admin={self.is_admin})>"


class CategorizationRule(Base):
    """
    Custom categorization rules for automatic transaction classification.

    Rules are checked in priority order (higher first) before default categorization logic.
    Supports both global rules (user_id=NULL) and user-specific rules.
    """

    __tablename__ = "categorization_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Pattern matching
    pattern = Column(String(255), nullable=False)  # Text to match in description
    case_sensitive = Column(Boolean, default=False)  # Case-sensitive matching

    # Amount condition (optional)
    amount_operator = Column(String(10), nullable=True)  # eq, gte, lte, gt, lt
    amount_value = Column(Numeric(12, 2), nullable=True)  # Amount threshold

    # Classification
    type = Column(String(50), nullable=False)  # Income, Expenses, Savings, etc.
    category = Column(String(100), nullable=False)  # Category to assign

    # Rule management
    priority = Column(Integer, default=0)  # Higher = checked first
    is_active = Column(Boolean, default=True)

    # Optional user-specific rules
    user_id = Column(Integer, nullable=True)  # NULL for global rules

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_priority", "priority"),
        Index("idx_active", "is_active"),
        Index("idx_user_priority", "user_id", "priority"),
    )

    def __repr__(self) -> str:
        amount_str = f", amount {self.amount_operator} {self.amount_value}" if self.amount_operator else ""
        return f"<CategorizationRule(pattern={self.pattern}{amount_str}, type={self.type}, category={self.category})>"


class DatabaseManager:
    """Database connection and session management."""

    def __init__(self, config: Optional[DatabaseConfig] = None):
        self.config = config or DatabaseConfig()
        self._engine: Optional[Engine] = None
        self._session_factory = None

    @property
    def engine(self) -> Engine:
        """Get or create the database engine."""
        if self._engine is None:
            self._engine = create_engine(
                self.config.connection_string,
                echo=False,
                pool_pre_ping=True,
            )
        return self._engine

    def create_tables(self) -> None:
        """Create all tables in the database."""
        Base.metadata.create_all(self.engine)

    def drop_tables(self) -> None:
        """Drop all tables (use with caution)."""
        Base.metadata.drop_all(self.engine)

    def get_session(self) -> Session:
        """Get a new database session."""
        if self._session_factory is None:
            self._session_factory = sessionmaker(bind=self.engine)
        return self._session_factory()

    def init_default_categories(self, session: Session) -> None:
        """Initialize default categories from config."""
        from .config import CategoryMapping

        mapping = CategoryMapping()

        # Check if categories already exist
        existing = session.query(Category).count()
        if existing > 0:
            return

        categories = []

        # Income categories
        for i, cat in enumerate(mapping.income_categories):
            categories.append(Category(name=cat, type="Income", display_order=i))

        # Expense categories
        for i, cat in enumerate(mapping.expense_categories):
            categories.append(Category(name=cat, type="Expenses", display_order=i))

        # Savings categories
        for i, cat in enumerate(mapping.savings_categories):
            categories.append(Category(name=cat, type="Savings", display_order=i))

        session.add_all(categories)
        session.commit()
