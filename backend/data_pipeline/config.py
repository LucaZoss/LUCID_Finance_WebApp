"""Configuration for the data pipeline."""

import os
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class DatabaseConfig:
    """MySQL database configuration."""
    host: str = os.getenv("DB_HOST", "localhost")
    port: int = int(os.getenv("DB_PORT", "3306"))
    user: str = os.getenv("DB_USER", "root")
    password: str = os.getenv("DB_PASSWORD", "")
    database: str = os.getenv("DB_NAME", "lucid_finance")

    @property
    def connection_string(self) -> str:
        """Generate SQLAlchemy connection string."""
        return f"mysql+pymysql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"


@dataclass
class CategoryMapping:
    """Category mapping configuration for transaction categorization."""

    # UBS Income patterns (description1 contains)
    ubs_income_patterns: Dict[str, str] = field(default_factory=lambda: {
        "webloyalty sarl": "Employment",  # Also check desc3 for "salaire"
    })

    # UBS Income patterns for desc2
    ubs_income_desc2_patterns: Dict[str, str] = field(default_factory=lambda: {
        "credit ubs twint": "Extras / Twint Chargeback",
    })

    # UBS Expense patterns (description1 contains)
    ubs_expense_patterns: Dict[str, str] = field(default_factory=lambda: {
        "sbb mobile": "Train",
        "ubs card center ag": "CC_Refund",  # Special type
        "pilet + renaud sa": "Housing",  # Also check for bd georges-favon
        "assura-basis sa": "Health Insurance",
        "swisscom": "Internet + Mobile",
        "coop pronto": "Groceries",
        "migros": "Groceries",
        "services industriels": "Home Utils",
    })

    # Credit Card sector to category mapping
    cc_sector_patterns: Dict[str, str] = field(default_factory=lambda: {
        "grocery stores": "Groceries",
        "restaurants": "Restaurants",
        "bakeries": "Restaurants",
        "fast-food restaurants": "Restaurants",
        "fast food restaurant": "Restaurants",
        "gasoline service stations": "Car",
        "pharmacies": "Health Other",
        "digital goods": "Digital Goods",
        "computer software stores": "Digital Goods",
        "department stores": "Extras",
        "electronics stores": "Digital Goods",
        "book stores": "Extras",
        "barber or beauty shops": "Wellbeing",
        "recreation services": "Sport",
        "taxicabs": "Restaurants",  # Food delivery like Uber Eats
        "package stores": "Extras",
        "retail business": "Extras",
    })

    # Valid transaction types
    valid_types: List[str] = field(default_factory=lambda: [
        "Income",
        "Expenses",
        "Savings",
        "CC_Refund",
        "No-Label",
    ])

    # Valid expense categories
    expense_categories: List[str] = field(default_factory=lambda: [
        "Housing",
        "Home Utils",
        "Home Furnitures",
        "Groceries",
        "Restaurants",
        "Train",
        "Internet + Mobile",
        "Car",
        "Health Insurance",
        "Health Other",
        "Clothing",
        "Media",
        "Extras",
        "Digital Goods",
        "Wellbeing",
        "Sport",
        "Travel",
        "Withdraw",
        "CC fees",
        "Tax",
        "Debt",
    ])

    # Valid income categories
    income_categories: List[str] = field(default_factory=lambda: [
        "Employment",
        "Side Hustle",
        "Grant Payment",
        "Extras / Twint Chargeback",
    ])

    # Valid savings categories
    savings_categories: List[str] = field(default_factory=lambda: [
        "Rent Guarantee",
        "Emergency Fund",
        "Retirement Account",
        "Stock Portofolio",
        "Sinking Fund Dow Payment",
        "Sinking Fund Rest",
    ])


@dataclass
class PipelineConfig:
    """Main pipeline configuration."""
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    categories: CategoryMapping = field(default_factory=CategoryMapping)

    # File processing settings
    raw_folder: str = "raw_ds"
    output_folder: str = "output"

    # CSV parsing settings
    cc_separator: str = ";"
    cc_encoding: str = "latin1"
    cc_skiprows: int = 1

    ubs_separator: str = ";"
    ubs_encoding: str = "utf-8-sig"
    ubs_skiprows: int = 9
    ubs_metadata_rows: int = 8

    # Date format for output
    output_date_format: str = "%d.%m.%Y"
