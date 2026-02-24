#!/usr/bin/env python3
"""
Test backward compatibility: ensure UBS and CC extractors still work.
"""

from pathlib import Path
from data_pipeline.config import PipelineConfig
from data_pipeline.extractors import UBSExtractor, CCExtractor, identify_file_type

def test_ubs():
    """Test UBS extractor with sample file."""
    ubs_file = Path("../Helpers/Samples/ubs_transactions_aout_sept.csv")

    if not ubs_file.exists():
        print(f"❌ UBS sample file not found: {ubs_file}")
        return False

    print("\n" + "=" * 70)
    print("Testing UBS Extractor")
    print("=" * 70)

    # Test file type identification
    file_type = identify_file_type(ubs_file)
    print(f"✓ File type identified as: {file_type}")

    # Create extractor
    config = PipelineConfig()
    extractor = UBSExtractor(config)

    # Extract transactions
    try:
        metadata, transactions = extractor.extract(ubs_file)
        print(f"✓ Successfully extracted {len(transactions)} UBS transactions")
        print(f"  Metadata: Account {metadata.account_number}, Period: {metadata.period_from} to {metadata.period_until}")

        # Show first transaction
        if transactions:
            txn = transactions[0]
            print(f"\n  First transaction:")
            print(f"    Date:   {txn.date.strftime('%Y-%m-%d')}")
            print(f"    Amount: CHF {txn.amount:.2f}")
            print(f"    Type:   {'Credit' if txn.is_credit else 'Debit'}")

        return True
    except Exception as e:
        print(f"❌ UBS extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_cc():
    """Test CC extractor with sample file."""
    cc_file = Path("../Helpers/Samples/cc_invoice_aout_sept.csv")

    if not cc_file.exists():
        print(f"❌ CC sample file not found: {cc_file}")
        return False

    print("\n" + "=" * 70)
    print("Testing CC Extractor")
    print("=" * 70)

    # Test file type identification
    file_type = identify_file_type(cc_file)
    print(f"✓ File type identified as: {file_type}")

    # Create extractor
    config = PipelineConfig()
    extractor = CCExtractor(config)

    # Extract transactions
    try:
        transactions = extractor.extract(cc_file)
        print(f"✓ Successfully extracted {len(transactions)} CC transactions")

        # Show first transaction
        if transactions:
            txn = transactions[0]
            print(f"\n  First transaction:")
            print(f"    Date:   {txn.date.strftime('%Y-%m-%d')}")
            print(f"    Amount: CHF {txn.amount:.2f}")
            print(f"    Type:   {'Credit' if txn.is_credit else 'Debit'}")

        return True
    except Exception as e:
        print(f"❌ CC extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 70)
    print("Backward Compatibility Test")
    print("Testing UBS and CC extractors to ensure they still work")
    print("=" * 70)

    ubs_ok = test_ubs()
    cc_ok = test_cc()

    print("\n" + "=" * 70)
    print("Test Results:")
    print("=" * 70)
    print(f"UBS Extractor: {'✅ PASS' if ubs_ok else '❌ FAIL'}")
    print(f"CC Extractor:  {'✅ PASS' if cc_ok else '❌ FAIL'}")

    if ubs_ok and cc_ok:
        print("\n🎉 All backward compatibility tests PASSED!")
    else:
        print("\n⚠️ Some tests failed. Please review the errors above.")

if __name__ == "__main__":
    main()
