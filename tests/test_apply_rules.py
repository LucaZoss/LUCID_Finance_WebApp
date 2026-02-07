"""Test script for applying rules to existing transactions."""

from datetime import datetime
from decimal import Decimal
from backend.data_pipeline.models import DatabaseManager, Transaction, CategorizationRule
from backend.data_pipeline.transformers import TransactionTransformer
from backend.data_pipeline.config import PipelineConfig


def main():
    """Test applying rules to existing transactions."""
    print("=" * 60)
    print("Testing Apply Rules to Existing Transactions")
    print("=" * 60)
    print()

    db_manager = DatabaseManager()
    config = PipelineConfig()

    # Step 1: Create some test transactions without rules
    print("Step 1: Creating test transactions...")
    session = db_manager.get_session()
    try:
        # Delete existing test transactions
        session.query(Transaction).filter(
            Transaction.description.like("%TEST:%")
        ).delete(synchronize_session=False)
        session.commit()

        # Create test transactions with default categorization
        test_transactions = [
            Transaction(
                date=datetime(2025, 1, 15).date(),
                type="No-Label",
                category="Uncategorized",
                amount=Decimal("15.99"),
                description="TEST: Netflix Monthly Subscription",
                source="CC",
                month=1,
                year=2025,
                transaction_hash="test_netflix_1",
            ),
            Transaction(
                date=datetime(2025, 1, 20).date(),
                type="No-Label",
                category="Uncategorized",
                amount=Decimal("149.99"),
                description="TEST: Netflix Annual Payment",
                source="CC",
                month=1,
                year=2025,
                transaction_hash="test_netflix_2",
            ),
            Transaction(
                date=datetime(2025, 1, 25).date(),
                type="No-Label",
                category="Uncategorized",
                amount=Decimal("25.50"),
                description="TEST: Uber Short Ride",
                source="CC",
                month=1,
                year=2025,
                transaction_hash="test_uber_1",
            ),
            Transaction(
                date=datetime(2025, 1, 28).date(),
                type="No-Label",
                category="Uncategorized",
                amount=Decimal("75.00"),
                description="TEST: Uber Airport Trip",
                source="CC",
                month=1,
                year=2025,
                transaction_hash="test_uber_2",
            ),
        ]

        for trans in test_transactions:
            session.add(trans)

        session.commit()
        print(f"✅ Created {len(test_transactions)} uncategorized test transactions")
        print()

    except Exception as e:
        session.rollback()
        print(f"❌ Failed to create transactions: {e}")
        return
    finally:
        session.close()

    # Step 2: Create categorization rules
    print("Step 2: Creating categorization rules...")
    session = db_manager.get_session()
    try:
        # Delete existing test rules
        session.query(CategorizationRule).delete()
        session.commit()

        # Create rules with amount conditions
        rules = [
            CategorizationRule(
                pattern="netflix",
                case_sensitive=False,
                amount_operator="lt",
                amount_value=Decimal("20.00"),
                type="Expenses",
                category="Leisure",
                priority=10,
                is_active=True,
            ),
            CategorizationRule(
                pattern="netflix",
                case_sensitive=False,
                amount_operator="gte",
                amount_value=Decimal("100.00"),
                type="Expenses",
                category="Entertainment - Annual",
                priority=10,
                is_active=True,
            ),
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
        ]

        for rule in rules:
            session.add(rule)

        session.commit()
        print(f"✅ Created {len(rules)} categorization rules")
        print()

    except Exception as e:
        session.rollback()
        print(f"❌ Failed to create rules: {e}")
        return
    finally:
        session.close()

    # Step 3: Show transactions BEFORE applying rules
    print("Step 3: Transactions BEFORE applying rules:")
    session = db_manager.get_session()
    try:
        transactions = session.query(Transaction).filter(
            Transaction.description.like("%TEST:%")
        ).all()

        for trans in transactions:
            print(f"   {trans.description:45s} → {trans.type:12s} / {trans.category}")

        print()

    finally:
        session.close()

    # Step 4: Apply rules to existing transactions
    print("Step 4: Applying rules to existing transactions...")
    session = db_manager.get_session()
    try:
        # Get all active rules
        rules = session.query(CategorizationRule).filter(
            CategorizationRule.is_active.is_(True)
        ).order_by(
            CategorizationRule.priority.desc(),
            CategorizationRule.created_at.desc()
        ).all()

        # Get test transactions
        transactions = session.query(Transaction).filter(
            Transaction.description.like("%TEST:%")
        ).all()

        # Create transformer
        transformer = TransactionTransformer(config, db_manager)

        updated_count = 0

        for transaction in transactions:
            description = transaction.description or ""
            amount = float(transaction.amount)

            # Check if transaction matches any rule
            match = transformer._check_custom_rules(description, amount)

            if match:
                new_type, new_category = match
                if transaction.type != new_type or transaction.category != new_category:
                    old_type, old_category = transaction.type, transaction.category
                    transaction.type = new_type
                    transaction.category = new_category
                    updated_count += 1
                    print(f"   ✅ Updated: {transaction.description[:40]:40s}")
                    print(f"      {old_type:12s} / {old_category:25s} → {new_type:12s} / {new_category}")

        session.commit()

        print()
        print(f"✅ Updated {updated_count} out of {len(transactions)} transactions")
        print()

    except Exception as e:
        session.rollback()
        print(f"❌ Failed to apply rules: {e}")
        return
    finally:
        session.close()

    # Step 5: Show transactions AFTER applying rules
    print("Step 5: Transactions AFTER applying rules:")
    session = db_manager.get_session()
    try:
        transactions = session.query(Transaction).filter(
            Transaction.description.like("%TEST:%")
        ).order_by(Transaction.description).all()

        for trans in transactions:
            print(f"   {trans.description:45s} → {trans.type:12s} / {trans.category}")

        print()

    finally:
        session.close()

    # Step 6: Verify correct categorization
    print("Step 6: Verifying categorization...")
    session = db_manager.get_session()
    try:
        transactions = session.query(Transaction).filter(
            Transaction.description.like("%TEST:%")
        ).order_by(Transaction.description).all()

        expected = {
            "Netflix Annual": "Entertainment - Annual",
            "Netflix Monthly": "Leisure",
            "Uber Airport": "Travel",
            "Uber Short": "Transportation",
        }

        all_correct = True
        for trans in transactions:
            for keyword, expected_category in expected.items():
                if keyword in trans.description:
                    if trans.category == expected_category:
                        print(f"   ✅ {keyword}: Correct ({expected_category})")
                    else:
                        print(f"   ❌ {keyword}: Expected {expected_category}, got {trans.category}")
                        all_correct = False
                    break

        print()
        if all_correct:
            print("=" * 60)
            print("✅ ALL TESTS PASSED!")
            print("=" * 60)
            print()
            print("Rules are now applied to existing transactions!")
            print("You can use the 'Apply to Existing' button in the UI to")
            print("re-categorize transactions after creating or updating rules.")
            print()
        else:
            print("=" * 60)
            print("❌ SOME TESTS FAILED")
            print("=" * 60)

    finally:
        session.close()


if __name__ == "__main__":
    main()
