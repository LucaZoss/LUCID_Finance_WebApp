"""
FastAPI backend for LUCID Finance WebApp.

Provides REST API endpoints for:
- Transaction management (CRUD + upload)
- Budget planning
- Dashboard summaries
"""

from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import (
    auth_router,
    transactions_router,
    budgets_router,
    categories_router,
    rules_router,
    dashboard_router,
    export_router,
)

load_dotenv()

# Initialize app
app = FastAPI(
    title="LUCID Finance API",
    description="Personal budgeting application API",
    version="0.1.0",
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://lucid-finance.cc",
        "http://lucid-pi.local",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(transactions_router)
app.include_router(budgets_router)
app.include_router(categories_router)
app.include_router(rules_router)
app.include_router(dashboard_router)
app.include_router(export_router)


# Health check
@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
