"""
FastAPI backend for LUCID Finance WebApp.

Provides REST API endpoints for:
- Transaction management (CRUD + upload)
- Budget planning
- Dashboard summaries
"""

from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .dependencies import get_db, get_current_user
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


@app.get("/api/types")
def get_types():
    """Get all valid transaction types."""
    from ..data_pipeline.config import PipelineConfig
    pipeline_config = PipelineConfig()
    return pipeline_config.categories.valid_types


@app.get("/api/years")
def get_available_years(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get list of years with transaction data."""
    from ..data_pipeline.models import Transaction
    years = session.query(Transaction.year).filter(
        Transaction.user_id == current_user["id"]
    ).distinct().order_by(Transaction.year.desc()).all()
    return [y[0] for y in years]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
