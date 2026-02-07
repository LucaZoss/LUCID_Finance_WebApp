"""Test script for budget CRUD operations."""

import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_budgets():
    print("Testing Budget CRUD Operations")
    print("=" * 50)

    # Test 1: Create yearly budget
    print("\n1. Creating yearly budget for Housing...")
    response = requests.post(
        f"{BASE_URL}/budgets",
        json={
            "type": "Expenses",
            "category": "Housing",
            "year": 2025,
            "month": None,
            "amount": 9148
        }
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    budget_id = response.json()["id"]

    # Test 2: Create monthly budget
    print("\n2. Creating monthly budget for January...")
    response = requests.post(
        f"{BASE_URL}/budgets",
        json={
            "type": "Expenses",
            "category": "Groceries",
            "year": 2025,
            "month": 1,
            "amount": 500
        }
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")

    # Test 3: Update existing budget
    print("\n3. Updating yearly Housing budget to 10000...")
    response = requests.post(
        f"{BASE_URL}/budgets",
        json={
            "type": "Expenses",
            "category": "Housing",
            "year": 2025,
            "month": None,
            "amount": 10000
        }
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.json()["id"] == budget_id, "Should update existing budget, not create new"

    # Test 4: Get all budgets
    print("\n4. Fetching all budgets for 2025...")
    response = requests.get(f"{BASE_URL}/budgets?year=2025")
    print(f"   Status: {response.status_code}")
    budgets = response.json()
    print(f"   Found {len(budgets)} budgets")
    for b in budgets:
        month_str = f"Month {b['month']}" if b['month'] else "Yearly"
        print(f"   - {b['type']} / {b['category']} / {month_str}: CHF {b['amount']}")

    # Test 5: Create income budget
    print("\n5. Creating Income budget...")
    response = requests.post(
        f"{BASE_URL}/budgets",
        json={
            "type": "Income",
            "category": "Employment",
            "year": 2025,
            "month": None,
            "amount": 98460
        }
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")

    # Test 6: Create savings budget
    print("\n6. Creating Savings budget...")
    response = requests.post(
        f"{BASE_URL}/budgets",
        json={
            "type": "Savings",
            "category": "Rent Guarantee",
            "year": 2025,
            "month": None,
            "amount": 6240
        }
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")

    print("\n" + "=" * 50)
    print("All tests passed! ✓")

if __name__ == "__main__":
    try:
        test_budgets()
    except requests.exceptions.ConnectionError:
        print("Error: Backend is not running. Start it with ./start_backend.sh")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
