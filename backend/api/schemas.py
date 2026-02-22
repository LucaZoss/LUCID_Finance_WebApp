"""
Pydantic schemas for API request/response models.
Extracted from main.py for better organization.
"""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel


# Transaction schemas
class TransactionResponse(BaseModel):
    id: int
    date: date
    type: str
    category: str
    sub_type: Optional[str] = None
    amount: float
    description: Optional[str]
    source: str
    month: int
    year: int
    source_file: Optional[str]

    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    category: Optional[str] = None
    sub_type: Optional[str] = None


class BulkTransactionUpdate(BaseModel):
    transaction_ids: List[int]
    type: Optional[str] = None
    category: Optional[str] = None


# Budget schemas
class BudgetPlanResponse(BaseModel):
    id: int
    type: str
    category: str
    sub_type: Optional[str] = None
    year: int
    month: Optional[int]
    amount: float

    class Config:
        from_attributes = True


class BudgetPlanCreate(BaseModel):
    type: str
    category: str
    sub_type: Optional[str] = None
    year: int
    month: Optional[int] = None
    amount: float


# Category schemas
class CategoryInfo(BaseModel):
    type: str
    categories: List[str]


class CategoryResponse(BaseModel):
    id: int
    name: str
    type: str
    is_active: bool
    display_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str
    type: str
    display_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


# Dashboard schemas
class SummaryItem(BaseModel):
    type: str
    category: str
    budget: float
    actual: float
    remaining: float
    percent_complete: float


class DashboardSummary(BaseModel):
    year: int
    month: Optional[int]
    income: List[SummaryItem]
    expenses: List[SummaryItem]
    savings: List[SummaryItem]
    totals: dict
    fixed_cost_ratio: float
    previous_period: dict
    latest_transaction_date: Optional[str]


# Authentication schemas
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    is_admin: bool


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    is_admin: bool = False


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Rule schemas
class RuleCreate(BaseModel):
    pattern: str
    case_sensitive: bool = False
    amount_operator: Optional[str] = None  # eq, gte, lte, gt, lt
    amount_value: Optional[float] = None
    type: str
    category: str
    priority: int = 0


class RuleUpdate(BaseModel):
    pattern: Optional[str] = None
    case_sensitive: Optional[bool] = None
    amount_operator: Optional[str] = None
    amount_value: Optional[float] = None
    type: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class RuleResponse(BaseModel):
    id: int
    pattern: str
    case_sensitive: bool
    amount_operator: Optional[str]
    amount_value: Optional[float]
    type: str
    category: str
    priority: int
    is_active: bool
    user_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
