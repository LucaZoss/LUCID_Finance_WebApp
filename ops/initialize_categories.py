"""
Initialize the categories table with default categories from PipelineConfig.

This script populates the categories table with the default categories
defined in backend/data_pipeline/config.py, making them available for
user management in the Budget Planning page.

Usage:
    uv run python scripts/initialize_categories.py
    uv run python scripts/initialize_categories.py --force
"""

import sys
import argparse
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.data_pipeline.config import PipelineConfig
from backend.data_pipeline.models import DatabaseManager, Category


def main():
    """Initialize categories table with defaults from config."""
    parser = argparse.ArgumentParser(description="Initialize categories table")
    parser.add_argument('--force', action='store_true', help='Force initialization without prompting')
    args = parser.parse_args()

    print("=" * 60)
    print("Initializing Categories Table")
    print("=" * 60)
    print()

    db_manager = DatabaseManager()
    pipeline_config = PipelineConfig()
    session = db_manager.get_session()

    try:
        # Check if categories already exist
        existing_count = session.query(Category).count()

        if existing_count > 0 and not args.force:
            print(f"ℹ️  Found {existing_count} existing categories in database.")
            print("Run with --force to add missing categories")
            return

        # Collect all categories from config
        category_definitions = []

        # Income categories
        for i, cat_name in enumerate(pipeline_config.categories.income_categories):
            category_definitions.append({
                "name": cat_name,
                "type": "Income",
                "display_order": i
            })

        # Expense categories
        for i, cat_name in enumerate(pipeline_config.categories.expense_categories):
            category_definitions.append({
                "name": cat_name,
                "type": "Expenses",
                "display_order": i
            })

        # Savings categories
        for i, cat_name in enumerate(pipeline_config.categories.savings_categories):
            category_definitions.append({
                "name": cat_name,
                "type": "Savings",
                "display_order": i
            })

        print(f"Found {len(category_definitions)} categories to process...")
        print()

        added_count = 0
        skipped_count = 0

        for cat_def in category_definitions:
            # Check if category already exists
            existing = session.query(Category).filter(
                Category.name == cat_def["name"],
                Category.type == cat_def["type"]
            ).first()

            if existing:
                print(f"  ⏭️  Skipping {cat_def['type']:8s} / {cat_def['name']:30s} (already exists)")
                skipped_count += 1
            else:
                # Add new category
                new_category = Category(
                    name=cat_def["name"],
                    type=cat_def["type"],
                    display_order=cat_def["display_order"],
                    is_active=True
                )
                session.add(new_category)
                print(f"  ✅ Added   {cat_def['type']:8s} / {cat_def['name']:30s}")
                added_count += 1

        # Commit all changes
        session.commit()

        print()
        print("=" * 60)
        print("✅ Initialization Complete!")
        print("=" * 60)
        print(f"  Added: {added_count} categories")
        print(f"  Skipped: {skipped_count} categories (already existed)")
        print(f"  Total: {session.query(Category).count()} categories in database")
        print()
        print("You can now manage categories in the Budget Planning page!")
        print()

    except Exception as e:
        session.rollback()
        print()
        print("=" * 60)
        print("❌ Error occurred!")
        print("=" * 60)
        print(f"Error: {e}")
        print()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
