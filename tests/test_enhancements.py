"""Test script for budget enhancements: bulk delete and auto-populate."""

import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_auto_populate_yearly_to_monthly():
    """Test that creating a yearly budget auto-creates 12 monthly budgets."""
    print("\n" + "=" * 70)
    print("TEST 1: Auto-populate Monthly from Yearly Budget")
    print("=" * 70)

    # Create a yearly budget for Testing category
    print("\n1. Creating yearly budget (CHF 12,000) for Testing category...")
    response = requests.post(
        f"{BASE_URL}/budgets",
        json={
            "type": "Expenses",
            "category": "Testing",
            "year": 2025,
            "month": None,
            "amount": 12000
        },
        params={"auto_populate": True}
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print(f"   Response: {response.json()}")

    # Check that 12 monthly budgets were created
    print("\n2. Fetching all budgets for 2025 to verify monthly budgets...")
    response = requests.get(f"{BASE_URL}/budgets?year=2025")
    budgets = response.json()

    testing_budgets = [b for b in budgets if b['category'] == 'Testing']
    yearly_budget = [b for b in testing_budgets if b['month'] is None]
    monthly_budgets = [b for b in testing_budgets if b['month'] is not None]

    print(f"   Total Testing budgets found: {len(testing_budgets)}")
    print(f"   - Yearly budgets: {len(yearly_budget)}")
    print(f"   - Monthly budgets: {len(monthly_budgets)}")

    if len(monthly_budgets) == 12:
        print("   ✅ SUCCESS: All 12 monthly budgets were auto-created!")
        print(f"   - Each month has CHF {monthly_budgets[0]['amount']} (should be 1000)")
    else:
        print(f"   ❌ FAILED: Expected 12 monthly budgets, found {len(monthly_budgets)}")

    return testing_budgets

def test_auto_populate_monthly_to_yearly():
    """Test that creating all 12 monthly budgets auto-creates/updates yearly budget."""
    print("\n" + "=" * 70)
    print("TEST 2: Auto-populate Yearly from Monthly Budgets")
    print("=" * 70)

    # Create monthly budgets for a new category
    print("\n1. Creating 12 monthly budgets (CHF 500 each) for TestMonthly category...")
    for month in range(1, 13):
        response = requests.post(
            f"{BASE_URL}/budgets",
            json={
                "type": "Expenses",
                "category": "TestMonthly",
                "year": 2025,
                "month": month,
                "amount": 500
            },
            params={"auto_populate": True}
        )
        if month == 1:
            print(f"   Created month 1: Status {response.status_code}")
        elif month == 12:
            print(f"   Created month 12: Status {response.status_code}")

    # Check that yearly budget was created
    print("\n2. Fetching all budgets for TestMonthly to verify yearly budget...")
    response = requests.get(f"{BASE_URL}/budgets?year=2025")
    budgets = response.json()

    testmonthly_budgets = [b for b in budgets if b['category'] == 'TestMonthly']
    yearly_budget = [b for b in testmonthly_budgets if b['month'] is None]

    if yearly_budget:
        print(f"   ✅ SUCCESS: Yearly budget auto-created!")
        print(f"   - Yearly amount: CHF {yearly_budget[0]['amount']} (should be 6000)")
    else:
        print(f"   ❌ FAILED: Yearly budget was not created")

    return testmonthly_budgets

def test_bulk_delete(budgets_to_delete):
    """Test bulk delete functionality."""
    print("\n" + "=" * 70)
    print("TEST 3: Bulk Delete Budgets")
    print("=" * 70)

    budget_ids = [b['id'] for b in budgets_to_delete]
    print(f"\n1. Deleting {len(budget_ids)} budget entries in bulk...")
    print(f"   Budget IDs: {budget_ids}")

    response = requests.post(
        f"{BASE_URL}/budgets/bulk-delete",
        json=budget_ids
    )
    print(f"   Status: {response.status_code}")
    result = response.json()
    print(f"   Response: {result}")

    if result.get('count') == len(budget_ids):
        print(f"   ✅ SUCCESS: Deleted {result['count']} budgets")
    else:
        print(f"   ❌ FAILED: Expected to delete {len(budget_ids)}, deleted {result.get('count')}")

    # Verify they're gone
    print("\n2. Verifying budgets were deleted...")
    response = requests.get(f"{BASE_URL}/budgets?year=2025")
    remaining_budgets = response.json()

    testing_remaining = [b for b in remaining_budgets if b['category'] in ['Testing', 'TestMonthly']]
    print(f"   Remaining test budgets: {len(testing_remaining)}")

    if len(testing_remaining) == 0:
        print("   ✅ SUCCESS: All test budgets were deleted!")
    else:
        print(f"   ⚠️  WARNING: {len(testing_remaining)} test budgets still remain")

def main():
    print("\n" + "=" * 70)
    print("TESTING BUDGET ENHANCEMENTS")
    print("=" * 70)

    try:
        # Test 1: Yearly to Monthly auto-populate
        testing_budgets = test_auto_populate_yearly_to_monthly()

        # Test 2: Monthly to Yearly auto-populate
        testmonthly_budgets = test_auto_populate_monthly_to_yearly()

        # Test 3: Bulk delete
        all_test_budgets = testing_budgets + testmonthly_budgets
        test_bulk_delete(all_test_budgets)

        print("\n" + "=" * 70)
        print("ALL TESTS COMPLETED!")
        print("=" * 70)

    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Backend is not running. Start it with ./start_backend.sh")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
