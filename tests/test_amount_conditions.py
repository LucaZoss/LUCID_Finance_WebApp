"""Test script for amount condition feature in categorization rules."""

from datetime import datetime
from decimal import Decimal
from backend.data_pipeline.models import DatabaseManager, CategorizationRule
from backend.data_pipeline.transformers import TransactionTransformer
from backend.data_pipeline.extractors import RawTransaction
from backend.data_pipeline.config import PipelineConfig


def main():
    """Test amount conditions in categorization rules."""
    print("=" * 60)
    print("Testing Amount Conditions in Categorization Rules")
    print("=" * 60)
    print()

    db_manager = DatabaseManager()

    # Step 1: Create tables
    print("Step 1: Creating database tables...")
    db_manager.create_tables()
    print("✅ Tables created successfully")
    print()

    # Step 2: Create test rules with amount conditions
    print("Step 2: Creating test rules with amount conditions...")
    session = db_manager.get_session()
    try:
        # Delete existing test rules
        session.query(CategorizationRule).delete()
        session.commit()

        # Create test rules with different amount operators
        rules = [
            # Netflix: Small subscription vs large annual payment
            CategorizationRule(
                pattern="netflix",
                case_sensitive=False,
                amount_operator="lt",
                amount_value=Decimal("20.00"),
                type="Expenses",
                category="Leisure",
                priority=15,
                is_active=True,
            ),
            CategorizationRule(
                pattern="netflix",
                case_sensitive=False,
                amount_operator="gte",
                amount_value=Decimal("100.00"),
                type="Expenses",
                category="Entertainment - Annual",
                priority=15,
                is_active=True,
            ),
            # Uber: Short ride vs long trip
            CategorizationRule(
                pattern="uber",
                case_sensitive=False,
                amount_operator="lte",
                amount_value=Decimal("30.00"),
                type="Expenses",
                category="Transportation",
                priority=10,
                is_active=True,
            ),
            CategorizationRule(
                pattern="uber",
                case_sensitive=False,
                amount_operator="gt",
                amount_value=Decimal("30.00"),
                type="Expenses",
                category="Travel",
                priority=10,
                is_active=True,
            ),
            # Amazon: Exact amount match
            CategorizationRule(
                pattern="amazon",
                case_sensitive=False,
                amount_operator="eq",
                amount_value=Decimal("9.99"),
                type="Expenses",
                category="Subscriptions",
                priority=12,
                is_active=True,
            ),
            # Default amazon without amount condition (lower priority)
            CategorizationRule(
                pattern="amazon",
                case_sensitive=False,
                amount_operator=None,
                amount_value=None,
                type="Expenses",
                category="Shopping",
                priority=5,
                is_active=True,
            ),
        ]

        for rule in rules:
            session.add(rule)

        session.commit()
        print(f"✅ Created {len(rules)} test rules:")
        for rule in rules:
            amount_str = ""
            if rule.amount_operator:
                op_symbol = {
                    "eq": "=",
                    "gte": "≥",
                    "lte": "≤",
                    "gt": ">",
                    "lt": "<",
                }.get(rule.amount_operator, rule.amount_operator)
                amount_str = f" AND amount {op_symbol} {rule.amount_value}"
            print(f"   - '{rule.pattern}'{amount_str} → {rule.type}/{rule.category} (priority: {rule.priority})")
        print()

    except Exception as e:
        session.rollback()
        print(f"❌ Failed to create rules: {e}")
        return
    finally:
        session.close()

    # Step 3: Test transformer with amount conditions
    print("Step 3: Testing transformer with amount conditions...")
    config = PipelineConfig()
    transformer = TransactionTransformer(config, db_manager)

    # Create test transactions
    test_transactions = [
        # Netflix tests
        RawTransaction(
            date=datetime(2025, 1, 15),
            amount=15.99,  # Should match "netflix < 20" -> Leisure
            description="Netflix Monthly Subscription",
            is_credit=False,
            source="CC",
            raw_data={"sector": "entertainment", "booking text": "netflix"},
        ),
        RawTransaction(
            date=datetime(2025, 1, 20),
            amount=149.99,  # Should match "netflix >= 100" -> Entertainment - Annual
            description="Netflix Annual Plan",
            is_credit=False,
            source="CC",
            raw_data={"sector": "entertainment", "booking text": "netflix annual"},
        ),
        # Uber tests
        RawTransaction(
            date=datetime(2025, 1, 25),
            amount=18.50,  # Should match "uber <= 30" -> Transportation
            description="Uber - Short ride downtown",
            is_credit=False,
            source="CC",
            raw_data={"sector": "transportation", "booking text": "uber"},
        ),
        RawTransaction(
            date=datetime(2025, 1, 28),
            amount=75.00,  # Should match "uber > 30" -> Travel
            description="Uber - Airport trip",
            is_credit=False,
            source="CC",
            raw_data={"sector": "transportation", "booking text": "uber"},
        ),
        # Amazon tests
        RawTransaction(
            date=datetime(2025, 1, 10),
            amount=9.99,  # Should match "amazon = 9.99" -> Subscriptions
            description="Amazon Prime Membership",
            is_credit=False,
            source="CC",
            raw_data={"sector": "shopping", "booking text": "amazon prime"},
        ),
        RawTransaction(
            date=datetime(2025, 1, 12),
            amount=49.99,  # Should match default "amazon" (no amount) -> Shopping
            description="Amazon Purchase - Electronics",
            is_credit=False,
            source="CC",
            raw_data={"sector": "shopping", "booking text": "amazon"},
        ),
    ]

    # Transform transactions
    transformed = transformer.transform(test_transactions)

    print(f"✅ Transformed {len(transformed)} transactions:")
    print()
    for trans in transformed:
        print(f"   Description: {trans.description[:45]:45s}")
        print(f"   Amount:      CHF {trans.amount:>8.2f}")
        print(f"   Categorized: {trans.type} / {trans.category}")
        print()

    # Step 4: Verify amount conditions were applied correctly
    print("Step 4: Verifying amount conditions...")
    print()

    expected_results = [
        ("Netflix Monthly", 15.99, "Leisure"),
        ("Netflix Annual", 149.99, "Entertainment - Annual"),
        ("Short ride", 18.50, "Transportation"),
        ("Airport", 75.00, "Travel"),
        ("Prime", 9.99, "Subscriptions"),
        ("Electronics", 49.99, "Shopping"),
    ]

    all_correct = True
    for i, (keyword, expected_amount, expected_category) in enumerate(expected_results):
        if i < len(transformed):
            trans = transformed[i]
            if abs(trans.amount - expected_amount) < 0.01 and trans.category == expected_category:
                print(f"   ✅ {keyword} (CHF {expected_amount}): Correctly categorized as {trans.category}")
            else:
                print(f"   ❌ {keyword} (CHF {expected_amount}): Expected {expected_category}, got {trans.category}")
                all_correct = False
        else:
            print(f"   ❌ {keyword}: Transaction not found")
            all_correct = False

    print()
    if all_correct:
        print("=" * 60)
        print("✅ ALL AMOUNT CONDITION TESTS PASSED!")
        print("=" * 60)
        print()
        print("Amount conditions are working correctly!")
        print()
        print("Examples of what you can now do:")
        print("  • netflix < 20 → Leisure")
        print("  • netflix ≥ 100 → Entertainment - Annual")
        print("  • uber ≤ 30 → Transportation")
        print("  • uber > 30 → Travel")
        print("  • amazon = 9.99 → Subscriptions")
        print("  • amazon (any amount) → Shopping")
        print()
    else:
        print("=" * 60)
        print("❌ SOME TESTS FAILED")
        print("=" * 60)

    # Step 5: Test edge cases
    print()
    print("Step 5: Testing edge cases...")
    print()

    # Test transaction that matches pattern but not amount
    edge_transaction = RawTransaction(
        date=datetime(2025, 1, 30),
        amount=50.00,  # Doesn't match any Netflix amount condition
        description="Netflix Gift Card",
        is_credit=False,
        source="CC",
        raw_data={"sector": "shopping", "booking text": "netflix gift"},
    )

    result = transformer.transform([edge_transaction])
    if result:
        trans = result[0]
        # Should fall through to default categorization
        print(f"   ℹ️  Netflix CHF 50.00 (no matching amount rule):")
        print(f"      → {trans.type} / {trans.category}")
        if trans.category in ["No-Label", "Uncategorized"]:
            print("      ✅ Correctly fell through to default categorization")
        else:
            print("      ⚠️  Unexpected category (might be caught by other rules)")

    print()
    print("=" * 60)
    print("Test complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
