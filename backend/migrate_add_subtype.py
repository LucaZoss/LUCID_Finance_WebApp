#!/usr/bin/env python3
"""
Migration script to add sub_type column to budget_plans and transactions tables.
Run this on the Pi to update the database schema.
"""

from sqlalchemy import create_engine, text
from data_pipeline.config import DatabaseConfig

def run_migration():
    """Execute the migration to add sub_type columns."""
    config = DatabaseConfig()
    engine = create_engine(config.connection_string)

    print("Starting migration: Adding sub_type column...")

    with engine.connect() as conn:
        try:
            # Add sub_type to budget_plans
            print("Adding sub_type column to budget_plans table...")
            conn.execute(text(
                "ALTER TABLE budget_plans ADD COLUMN sub_type VARCHAR(50) NULL AFTER category"
            ))
            conn.commit()
            print("✓ Added sub_type to budget_plans")

            # Add sub_type to transactions
            print("Adding sub_type column to transactions table...")
            conn.execute(text(
                "ALTER TABLE transactions ADD COLUMN sub_type VARCHAR(50) NULL AFTER category"
            ))
            conn.commit()
            print("✓ Added sub_type to transactions")

            # Add indexes
            print("Creating indexes...")
            conn.execute(text(
                "CREATE INDEX idx_budget_sub_type ON budget_plans(sub_type)"
            ))
            conn.commit()
            print("✓ Created index on budget_plans.sub_type")

            conn.execute(text(
                "CREATE INDEX idx_transaction_sub_type ON transactions(sub_type)"
            ))
            conn.commit()
            print("✓ Created index on transactions.sub_type")

            print("\n✅ Migration completed successfully!")

        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            print("\nNote: If column already exists, this is expected. Check the error message above.")
            conn.rollback()
            raise

if __name__ == "__main__":
    run_migration()
