"""Migration script to add amount condition fields to categorization_rules table."""

from backend.data_pipeline.models import DatabaseManager


def main():
    """Add amount_operator and amount_value columns to categorization_rules table."""
    print("=" * 60)
    print("Migrating categorization_rules table")
    print("=" * 60)
    print()

    db_manager = DatabaseManager()

    # Get a raw connection to execute SQL
    connection = db_manager.engine.raw_connection()
    cursor = connection.cursor()

    try:
        print("Step 1: Checking if columns already exist...")

        # Check if columns exist
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = 'lucid_finance'
            AND TABLE_NAME = 'categorization_rules'
            AND COLUMN_NAME = 'amount_operator'
        """)

        operator_exists = cursor.fetchone()[0] > 0

        if operator_exists:
            print("   ℹ️  Columns already exist, skipping migration")
            return

        print("   ℹ️  Columns do not exist, proceeding with migration")
        print()

        print("Step 2: Adding amount_operator column...")
        cursor.execute("""
            ALTER TABLE categorization_rules
            ADD COLUMN amount_operator VARCHAR(10) NULL
            AFTER case_sensitive
        """)
        print("   ✅ Added amount_operator column")

        print("Step 3: Adding amount_value column...")
        cursor.execute("""
            ALTER TABLE categorization_rules
            ADD COLUMN amount_value DECIMAL(12, 2) NULL
            AFTER amount_operator
        """)
        print("   ✅ Added amount_value column")

        connection.commit()

        print()
        print("=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        print()
        print("The categorization_rules table now supports amount conditions:")
        print("  • amount_operator: eq, gte, lte, gt, lt")
        print("  • amount_value: decimal value to compare against")
        print()

    except Exception as e:
        connection.rollback()
        print(f"❌ Migration failed: {e}")
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    main()
