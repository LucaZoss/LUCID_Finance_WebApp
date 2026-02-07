"""Unit tests for API endpoints."""

import pytest
from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)


def test_health_check():
    """Test health endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_get_categories():
    """Test categories endpoint."""
    response = client.get("/api/categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    assert any(cat["type"] == "Income" for cat in data)
    assert any(cat["type"] == "Expenses" for cat in data)
    assert any(cat["type"] == "Savings" for cat in data)


def test_get_types():
    """Test transaction types endpoint."""
    response = client.get("/api/types")
    assert response.status_code == 200
    types = response.json()
    assert "Income" in types
    assert "Expenses" in types
    assert "Savings" in types


def test_create_and_delete_budget():
    """Test budget creation and deletion."""
    # Create budget
    budget_data = {
        "type": "Expenses",
        "category": "TestCategory",
        "year": 2025,
        "month": None,
        "amount": 1000
    }
    response = client.post("/api/budgets", json=budget_data)
    assert response.status_code == 200
    created = response.json()
    assert created["amount"] == 1000
    assert created["category"] == "TestCategory"
    budget_id = created["id"]

    # Delete budget
    response = client.delete(f"/api/budgets/{budget_id}")
    assert response.status_code == 200


def test_bulk_delete_budgets():
    """Test bulk delete endpoint."""
    # Create multiple budgets
    ids = []
    for i in range(3):
        response = client.post("/api/budgets", json={
            "type": "Expenses",
            "category": f"BulkTest{i}",
            "year": 2025,
            "month": None,
            "amount": 100
        })
        ids.append(response.json()["id"])

    # Bulk delete
    response = client.post("/api/budgets/bulk-delete", json=ids)
    assert response.status_code == 200
    assert response.json()["count"] == 3


def test_auto_populate_monthly_from_yearly():
    """Test that yearly budget creates 12 monthly budgets."""
    # Create yearly budget with auto-populate
    response = client.post("/api/budgets?auto_populate=true", json={
        "type": "Expenses",
        "category": "AutoPopTest",
        "year": 2025,
        "month": None,
        "amount": 1200
    })
    assert response.status_code == 200

    # Check monthly budgets were created
    response = client.get("/api/budgets?year=2025")
    budgets = [b for b in response.json() if b["category"] == "AutoPopTest"]

    monthly = [b for b in budgets if b["month"] is not None]
    assert len(monthly) == 12
    assert all(b["amount"] == 100 for b in monthly)

    # Cleanup
    ids = [b["id"] for b in budgets]
    client.post("/api/budgets/bulk-delete", json=ids)
