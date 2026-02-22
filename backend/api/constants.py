"""
Application constants.
Extracted from main.py for better organization.
"""

# Fixed cost categories for budget analysis
FIXED_COST_CATEGORIES = ["Housing", "Health Insurance", "Needs"]

# Pagination defaults
DEFAULT_PAGE_SIZE = 500
MAX_PAGE_SIZE = 1000

# CORS allowed origins (can be overridden by environment variables)
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
]
