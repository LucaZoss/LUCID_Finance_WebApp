"""
API routers for LUCID Finance WebApp.
Organizes endpoints into logical groups.
"""

from .auth import router as auth_router
from .transactions import router as transactions_router
from .budgets import router as budgets_router
from .categories import router as categories_router
from .rules import router as rules_router
from .dashboard import router as dashboard_router
from .export import router as export_router

__all__ = [
    "auth_router",
    "transactions_router",
    "budgets_router",
    "categories_router",
    "rules_router",
    "dashboard_router",
    "export_router",
]
