"""
Application constants.
Extracted from main.py for better organization.
"""

# Fixed cost calculation now uses sub_type='Essentials' instead of category names
# This constant is kept for backward compatibility but is no longer actively used
FIXED_COST_CATEGORIES = ["Housing", "Health Insurance"]  # Legacy - use sub_type='Essentials' instead

# Pagination defaults
DEFAULT_PAGE_SIZE = 500
MAX_PAGE_SIZE = 1000

# CORS allowed origins (can be overridden by environment variables)
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
]
