#!/usr/bin/env python3
"""
Test script for GenericExtractor with BCV CSV file.
"""

from pathlib import Path
from data_pipeline.config import PipelineConfig
from data_pipeline.extractors import GenericExtractor, identify_file_type

def main():
    # Path to BCV sample file
    bcv_file = Path("../Helpers/Samples/Transactions précédentes_01-01-2026_03-01-2026.csv")

    if not bcv_file.exists():
        print(f"❌ BCV sample file not found: {bcv_file}")
        return

    print("=" * 70)
    print("Testing GenericExtractor with BCV Sample File")
    print("=" * 70)

    # Test file type identification
    file_type = identify_file_type(bcv_file)
    print(f"\n✓ File type identified as: {file_type}")

    # Create extractor
    config = PipelineConfig()
    extractor = GenericExtractor(config)

    # Extract transactions
    print(f"\n📂 Extracting transactions from: {bcv_file.name}")
    try:
        transactions = extractor.extract(bcv_file, bank_hint="BCV")
        print(f"✓ Successfully extracted {len(transactions)} transactions")

        # Display first 5 transactions
        print("\n" + "=" * 70)
        print("First 5 Transactions:")
        print("=" * 70)

        for i, txn in enumerate(transactions[:5], 1):
            print(f"\n[{i}] Transaction:")
            print(f"  Date:        {txn.date.strftime('%Y-%m-%d')}")
            print(f"  Amount:      CHF {txn.amount:.2f}")
            print(f"  Type:        {'Credit (Income)' if txn.is_credit else 'Debit (Expense)'}")
            print(f"  Description: {txn.description}")
            print(f"  Source:      {txn.source}")

        # Summary
        print("\n" + "=" * 70)
        print("Summary:")
        print("=" * 70)

        total_debits = sum(t.amount for t in transactions if not t.is_credit)
        total_credits = sum(t.amount for t in transactions if t.is_credit)
        num_debits = sum(1 for t in transactions if not t.is_credit)
        num_credits = sum(1 for t in transactions if t.is_credit)

        print(f"Total Transactions: {len(transactions)}")
        print(f"Expenses (Debits):  {num_debits} transactions, CHF {total_debits:.2f}")
        print(f"Income (Credits):   {num_credits} transactions, CHF {total_credits:.2f}")
        print(f"Net Amount:         CHF {total_credits - total_debits:.2f}")

        print("\n✅ BCV extraction test PASSED!")

    except Exception as e:
        print(f"\n❌ Error during extraction: {e}")
        import traceback
        traceback.print_exc()
        return

    print("\n" + "=" * 70)
    print("Test Complete!")
    print("=" * 70)

if __name__ == "__main__":
    main()
