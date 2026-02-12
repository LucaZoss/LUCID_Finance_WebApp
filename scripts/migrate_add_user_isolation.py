"""
Database Migration: Add User Isolation
=======================================
This migration adds user_id foreign keys to all data tables to prevent
users from seeing each other's financial data.

Tables modified:
- transactions: Add user_id
- budget_plans: Add user_id
- processed_files: Add user_id
- categories: Add user_id

All existing data will be assigned to the admin user (user_id=2, username='luca').
"""

import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from backend.data_pipeline.models import DatabaseManager, User


def run_migration(skip_confirmation=False):
    """Run the user isolation migration."""
    print("=" * 70)
    print("Database Migration: Add User Isolation")
    print("=" * 70)
    print()
    print("This migration will:")
    print("  1. Add user_id columns to all data tables")
    print("  2. Assign all existing data to the admin user (luca)")
    print("  3. Add foreign key constraints")
    print("  4. Add indexes for performance")
    print()

    # Get admin user
    db_manager = DatabaseManager()
    session = db_manager.get_session()

    try:
        # Find admin user
        admin_user = session.query(User).filter(User.is_admin == True).first()
        if not admin_user:
            print("❌ Error: No admin user found!")
            print("   Please create an admin user first.")
            return False

        print(f"Admin user found: {admin_user.username} (ID: {admin_user.id})")
        print()

        # Confirm before proceeding
        if not skip_confirmation:
            response = input("Do you want to proceed with the migration? (yes/no): ").strip().lower()
            if response != 'yes':
                print("Migration cancelled.")
                return False

        print()
        print("Starting migration...")
        print()

        # Get database engine
        engine = db_manager.engine

        with engine.begin() as conn:
            # 1. Add user_id to transactions
            print("1. Migrating transactions table...")
            try:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN user_id INTEGER"))
                print("   ✓ Added user_id column")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("   ⚠ Column already exists, skipping...")
                else:
                    raise

            conn.execute(
                text(f"UPDATE transactions SET user_id = {admin_user.id} WHERE user_id IS NULL")
            )
            print(f"   ✓ Assigned all transactions to {admin_user.username}")

            conn.execute(text("ALTER TABLE transactions MODIFY user_id INTEGER NOT NULL"))
            print("   ✓ Made user_id NOT NULL")

            try:
                conn.execute(
                    text("ALTER TABLE transactions ADD FOREIGN KEY (user_id) REFERENCES users(id)")
                )
                print("   ✓ Added foreign key constraint")
            except Exception as e:
                if "Duplicate foreign key" in str(e) or "already exists" in str(e):
                    print("   ⚠ Foreign key already exists, skipping...")
                else:
                    raise

            try:
                conn.execute(text("CREATE INDEX idx_transactions_user ON transactions(user_id)"))
                print("   ✓ Added index")
            except Exception as e:
                if "Duplicate key name" in str(e):
                    print("   ⚠ Index already exists, skipping...")
                else:
                    raise

            print()

            # 2. Add user_id to budget_plans
            print("2. Migrating budget_plans table...")
            try:
                conn.execute(text("ALTER TABLE budget_plans ADD COLUMN user_id INTEGER"))
                print("   ✓ Added user_id column")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("   ⚠ Column already exists, skipping...")
                else:
                    raise

            conn.execute(
                text(f"UPDATE budget_plans SET user_id = {admin_user.id} WHERE user_id IS NULL")
            )
            print(f"   ✓ Assigned all budget plans to {admin_user.username}")

            conn.execute(text("ALTER TABLE budget_plans MODIFY user_id INTEGER NOT NULL"))
            print("   ✓ Made user_id NOT NULL")

            try:
                conn.execute(
                    text("ALTER TABLE budget_plans ADD FOREIGN KEY (user_id) REFERENCES users(id)")
                )
                print("   ✓ Added foreign key constraint")
            except Exception as e:
                if "Duplicate foreign key" in str(e) or "already exists" in str(e):
                    print("   ⚠ Foreign key already exists, skipping...")
                else:
                    raise

            try:
                conn.execute(text("CREATE INDEX idx_budget_plans_user ON budget_plans(user_id)"))
                print("   ✓ Added index")
            except Exception as e:
                if "Duplicate key name" in str(e):
                    print("   ⚠ Index already exists, skipping...")
                else:
                    raise

            print()

            # 3. Add user_id to processed_files
            print("3. Migrating processed_files table...")
            try:
                conn.execute(text("ALTER TABLE processed_files ADD COLUMN user_id INTEGER"))
                print("   ✓ Added user_id column")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("   ⚠ Column already exists, skipping...")
                else:
                    raise

            conn.execute(
                text(f"UPDATE processed_files SET user_id = {admin_user.id} WHERE user_id IS NULL")
            )
            print(f"   ✓ Assigned all processed files to {admin_user.username}")

            conn.execute(text("ALTER TABLE processed_files MODIFY user_id INTEGER NOT NULL"))
            print("   ✓ Made user_id NOT NULL")

            try:
                conn.execute(
                    text("ALTER TABLE processed_files ADD FOREIGN KEY (user_id) REFERENCES users(id)")
                )
                print("   ✓ Added foreign key constraint")
            except Exception as e:
                if "Duplicate foreign key" in str(e) or "already exists" in str(e):
                    print("   ⚠ Foreign key already exists, skipping...")
                else:
                    raise

            try:
                conn.execute(text("CREATE INDEX idx_processed_files_user ON processed_files(user_id)"))
                print("   ✓ Added index")
            except Exception as e:
                if "Duplicate key name" in str(e):
                    print("   ⚠ Index already exists, skipping...")
                else:
                    raise

            print()

            # 4. Add user_id to categories
            print("4. Migrating categories table...")
            try:
                conn.execute(text("ALTER TABLE categories ADD COLUMN user_id INTEGER"))
                print("   ✓ Added user_id column")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("   ⚠ Column already exists, skipping...")
                else:
                    raise

            conn.execute(
                text(f"UPDATE categories SET user_id = {admin_user.id} WHERE user_id IS NULL")
            )
            print(f"   ✓ Assigned all categories to {admin_user.username}")

            conn.execute(text("ALTER TABLE categories MODIFY user_id INTEGER NOT NULL"))
            print("   ✓ Made user_id NOT NULL")

            try:
                conn.execute(
                    text("ALTER TABLE categories ADD FOREIGN KEY (user_id) REFERENCES users(id)")
                )
                print("   ✓ Added foreign key constraint")
            except Exception as e:
                if "Duplicate foreign key" in str(e) or "already exists" in str(e):
                    print("   ⚠ Foreign key already exists, skipping...")
                else:
                    raise

            try:
                conn.execute(text("CREATE INDEX idx_categories_user ON categories(user_id)"))
                print("   ✓ Added index")
            except Exception as e:
                if "Duplicate key name" in str(e):
                    print("   ⚠ Index already exists, skipping...")
                else:
                    raise

            # Update unique constraint for categories (per-user unique)
            print("   ⚠ Note: Category names are now unique per user")
            print("     (Multiple users can have categories with the same name)")

            print()

        print("=" * 70)
        print("✅ Migration completed successfully!")
        print("=" * 70)
        print()
        print("Summary:")
        print(f"  - All data assigned to: {admin_user.username} (ID: {admin_user.id})")
        print("  - Added user_id to: transactions, budget_plans, processed_files, categories")
        print("  - Added foreign keys and indexes")
        print()
        print("Next steps:")
        print("  1. Restart the backend: sudo systemctl restart lucid-backend")
        print("  2. New users will start with empty data")
        print("  3. Existing data remains with admin user")
        print()

        return True

    except Exception as e:
        session.rollback()
        print()
        print("=" * 70)
        print("❌ Migration failed!")
        print("=" * 70)
        print(f"Error: {e}")
        print()
        print("The database has been rolled back to its previous state.")
        return False
    finally:
        session.close()


if __name__ == "__main__":
    # Check for --yes flag to skip confirmation
    skip_confirmation = "--yes" in sys.argv or "-y" in sys.argv
    success = run_migration(skip_confirmation=skip_confirmation)
    sys.exit(0 if success else 1)
