"""Test script for categorization rules functionality."""

from datetime import datetime
from backend.data_pipeline.models import DatabaseManager, CategorizationRule, Transaction
from backend.data_pipeline.transformers import TransactionTransformer
from backend.data_pipeline.extractors import RawTransaction
from backend.data_pipeline.config import PipelineConfig


def main():
    """Test categorization rules."""
    print("=" * 60)
    print("Testing Categorization Rules Feature")
    print("=" * 60)
    print()

    db_manager = DatabaseManager()

    # Step 1: Create tables (includes new categorization_rules table)
    print("Step 1: Creating database tables...")
    db_manager.create_tables()
    print("✅ Tables created successfully")
    print()

    # Step 2: Create test rules
    print("Step 2: Creating test categorization rules...")
    session = db_manager.get_session()
    try:
        # Delete existing test rules
        session.query(CategorizationRule).delete()
        session.commit()

        # Create test rules
        rules = [
            CategorizationRule(
                pattern="netflix",
                case_sensitive=False,
                type="Expenses",
                category="Leisure",
                priority=10,
                is_active=True,
            ),
            CategorizationRule(
                pattern="spotify",
                case_sensitive=False,
                type="Expenses",
                category="Leisure",
                priority=10,
                is_active=True,
            ),
            CategorizationRule(
                pattern="amazon",
                case_sensitive=False,
                type="Expenses",
                category="Shopping",
                priority=5,
                is_active=True,
            ),
            CategorizationRule(
                pattern="uber",
                case_sensitive=False,
                type="Expenses",
                category="Transportation",
                priority=5,
                is_active=True,
            ),
            CategorizationRule(
                pattern="salary",
                case_sensitive=False,
                type="Income",
                category="Employment",
                priority=15,
                is_active=True,
            ),
        ]

        for rule in rules:
            session.add(rule)

        session.commit()
        print(f"✅ Created {len(rules)} test rules:")
        for rule in rules:
            print(f"   - '{rule.pattern}' → {rule.type}/{rule.category} (priority: {rule.priority})")
        print()

    except Exception as e:
        session.rollback()
        print(f"❌ Failed to create rules: {e}")
        return
    finally:
        session.close()

    # Step 3: Test transformer with custom rules
    print("Step 3: Testing transformer with custom rules...")
    config = PipelineConfig()
    transformer = TransactionTransformer(config, db_manager)

    # Create test raw transactions
    test_transactions = [
        RawTransaction(
            date=datetime(2025, 1, 15),
            amount=15.99,
            description="Netflix Subscription Monthly",
            is_credit=False,
            source="CC",
            raw_data={"sector": "entertainment", "booking text": "netflix subscription"},
        ),
        RawTransaction(
            date=datetime(2025, 1, 20),
            amount=9.99,
            description="Spotify Premium",
            is_credit=False,
            source="CC",
            raw_data={"sector": "entertainment", "booking text": "spotify premium"},
        ),
        RawTransaction(
            date=datetime(2025, 1, 25),
            amount=49.99,
            description="Amazon Purchase Electronics",
            is_credit=False,
            source="CC",
            raw_data={"sector": "shopping", "booking text": "amazon purchase"},
        ),
        RawTransaction(
            date=datetime(2025, 1, 10),
            amount=25.50,
            description="Uber Trip to Airport",
            is_credit=False,
            source="CC",
            raw_data={"sector": "transportation", "booking text": "uber trip"},
        ),
        RawTransaction(
            date=datetime(2025, 1, 1),
            amount=5000.00,
            description="Monthly Salary Payment",
            is_credit=True,
            source="UBS",
            raw_data={
                "description1": "webloyalty sarl",
                "description2": "",
                "description3": "salaire janvier 2025",
            },
        ),
    ]

    # Transform transactions
    transformed = transformer.transform(test_transactions)

    print(f"✅ Transformed {len(transformed)} transactions:")
    for trans in transformed:
        print(f"   - {trans.description[:40]:40s} → {trans.type:12s} / {trans.category}")

    # Verify custom rules were applied
    print()
    print("Step 4: Verifying custom rules were applied...")

    expected_results = {
        "Netflix": ("Expenses", "Leisure"),
        "Spotify": ("Expenses", "Leisure"),
        "Amazon": ("Expenses", "Shopping"),
        "Uber": ("Expenses", "Transportation"),
        "Salary": ("Income", "Employment"),
    }

    all_correct = True
    for trans in transformed:
        for keyword, (expected_type, expected_category) in expected_results.items():
            if keyword.lower() in trans.description.lower():
                if trans.type == expected_type and trans.category == expected_category:
                    print(f"   ✅ {keyword}: Correctly categorized as {trans.type}/{trans.category}")
                else:
                    print(f"   ❌ {keyword}: Expected {expected_type}/{expected_category}, got {trans.type}/{trans.category}")
                    all_correct = False
                break

    print()
    if all_correct:
        print("=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        print()
        print("Custom categorization rules are working correctly!")
        print("You can now:")
        print("  1. Start the backend: ./start_backend.sh")
        print("  2. Start the frontend: ./start_frontend.sh")
        print("  3. Navigate to the 'Rules' tab")
        print("  4. Create custom rules for your transactions")
        print()
    else:
        print("=" * 60)
        print("❌ SOME TESTS FAILED")
        print("=" * 60)

    # Step 5: Test inactive rules
    print()
    print("Step 5: Testing inactive rules...")
    session = db_manager.get_session()
    try:
        # Deactivate Netflix rule
        netflix_rule = session.query(CategorizationRule).filter(
            CategorizationRule.pattern == "netflix"
        ).first()
        if netflix_rule:
            netflix_rule.is_active = False
            session.commit()
            print("   ⚠️  Deactivated 'netflix' rule")

        # Clear transformer cache
        transformer._rules_cache = None

        # Test with deactivated rule
        netflix_transaction = RawTransaction(
            date=datetime(2025, 1, 15),
            amount=15.99,
            description="Netflix Subscription",
            is_credit=False,
            source="CC",
            raw_data={"sector": "entertainment", "booking text": "netflix"},
        )

        result = transformer.transform([netflix_transaction])
        if result:
            trans = result[0]
            if trans.category != "Leisure":
                print(f"   ✅ Inactive rule correctly ignored (categorized as: {trans.type}/{trans.category})")
            else:
                print(f"   ❌ Inactive rule was still applied!")

    finally:
        session.close()

    print()
    print("=" * 60)
    print("Test complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
