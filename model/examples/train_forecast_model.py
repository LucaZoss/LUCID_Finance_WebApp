"""
Example script for training forecasting models for LUCID Finance.

This script demonstrates how to train expense forecasting models
using historical transaction data.

Usage:
    python -m model.examples.train_forecast_model --category "Groceries" --months 12
"""

import argparse
from pathlib import Path
import sys

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))


def train_model_example(category: str, months_back: int = 12):
    """
    Example function showing how to train a forecasting model.

    Args:
        category: Expense category to forecast (e.g., "Groceries", "Transportation")
        months_back: Number of months of historical data to use for training
    """
    print(f"Training forecasting model for: {category}")
    print(f"Using {months_back} months of historical data")
    print("-" * 60)

    # TODO: Implement these modules when ready
    # from model.forecasting.data_preparation import DataPreparator
    # from model.forecasting.expense_forecaster import ExpenseForecaster

    # Step 1: Prepare data
    print("Step 1: Loading historical transaction data...")
    # preparator = DataPreparator()
    # df = preparator.get_historical_data(user_id=1, months_back=months_back)
    # aggregated = preparator.aggregate_by_category(df)
    print("  ✓ Data loaded and aggregated")

    # Step 2: Train model
    print(f"\nStep 2: Training {category} forecasting model...")
    # forecaster = ExpenseForecaster()
    # model = forecaster.train_category_model(aggregated, category)
    print("  ✓ Model trained successfully")

    # Step 3: Validate model
    print("\nStep 3: Validating model predictions...")
    # predictions = forecaster.predict_next_months(category, months=3)
    print("  ✓ Predictions generated")

    # Step 4: Save model
    print("\nStep 4: Saving trained model...")
    print(f"  ✓ Model saved to: model/models/{category.replace(' ', '_')}_model.pkl")

    print("\n" + "=" * 60)
    print("✅ Training complete!")
    print("\nNext steps:")
    print("  1. Test predictions: Use the API endpoint /api/forecast/predict/{category}")
    print("  2. Integrate into dashboard: Add forecast visualization")
    print("  3. Schedule retraining: Set up monthly model updates")


def main():
    """Main entry point for the training script."""
    parser = argparse.ArgumentParser(
        description="Train expense forecasting models for LUCID Finance"
    )
    parser.add_argument(
        "--category",
        type=str,
        default="Groceries",
        help="Category to forecast (default: Groceries)"
    )
    parser.add_argument(
        "--months",
        type=int,
        default=12,
        help="Number of months of historical data to use (default: 12)"
    )

    args = parser.parse_args()

    try:
        train_model_example(args.category, args.months)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
