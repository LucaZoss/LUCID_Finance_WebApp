"""Budget Script with process tracking using log.txt"""

import pandas as pd
from datetime import datetime
import sys
import os
import logging
import glob

# ==========================
# Setup logging
# ==========================
LOG_FILE = "log.txt"

# Create log.txt if it does not exist
if not os.path.exists(LOG_FILE):
    open(LOG_FILE, "w").close()

# Configure logging to file + console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# Add a session header for traceability
logger.info("=" * 60)
logger.info(f"🔹 New Script Execution: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
logger.info("=" * 60)

# ==========================
# Absolute paths setup
# ==========================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_FOLDER = os.path.join(SCRIPT_DIR, "raw_ds")
OUTPUT_FOLDER = os.path.join(SCRIPT_DIR, "output")
PROCESSED_FILES_LOG = os.path.join(SCRIPT_DIR, "processed_files.txt")
LOG_FILE = os.path.join(SCRIPT_DIR, "log.txt")

# ==========================
# Setup logging
# ==========================
# Create log.txt if it does not exist
if not os.path.exists(LOG_FILE):
    open(LOG_FILE, "w").close()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# Session header
logger.info("=" * 60)
logger.info(f"🔹 New Script Execution: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
logger.info("=" * 60)

# ==========================
# Ensure folders exist
# ==========================
for folder in [RAW_FOLDER, OUTPUT_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)
        logger.info(f"Created folder: {folder}")


# ==========================
# Process tracking functions
# ==========================
def get_processed_files():
    if not os.path.exists(PROCESSED_FILES_LOG):
        return set()
    with open(PROCESSED_FILES_LOG, "r") as f:
        return set(f.read().splitlines())


def add_to_processed_files(filename):
    with open(PROCESSED_FILES_LOG, "a") as f:
        f.write(filename + "\n")


def get_unprocessed_csv_files():
    all_files = glob.glob(os.path.join(RAW_FOLDER, "*.csv"))
    if not all_files:
        logger.warning(f"No CSV files found in {RAW_FOLDER}")
        return []

    processed_files = get_processed_files()
    unprocessed = [f for f in all_files if os.path.basename(f) not in processed_files]

    if unprocessed:
        logger.info(f"Found {len(unprocessed)} unprocessed CSV files:")
        for f in unprocessed:
            logger.info(f"  - {os.path.basename(f)}")
    else:
        logger.info("No new UBS+CC CSV pair to process. Exiting.")
    return unprocessed


# ==========================
# Step 1: Load & Sanitize
# ==========================
def load_and_sanitize_csv(ubs_csv_path, cc_csv_path):
    """Load and sanitize UBS and CC CSV files."""
    logger.info(f"Loading CC CSV: {cc_csv_path}")
    cc_df = pd.read_csv(cc_csv_path, sep=";", encoding="latin1", skiprows=1)
    logger.info(f"Loaded {len(cc_df)} CC transactions")

    def process_ubs(ubs_csv_path):
        logger.info(f"Processing UBS CSV: {ubs_csv_path}")
        meta_series = pd.read_csv(
            ubs_csv_path,
            sep=";",
            encoding="utf-8-sig",
            nrows=8,
            header=None,
            index_col=0,
            usecols=[0, 1],
        ).squeeze("columns")
        meta_series.index = meta_series.index.str.replace(":", "").str.strip()
        meta_dict = {
            k: v
            for k, v in meta_series.to_dict().items()
            if k
            in [
                "From",
                "Until",
                "Opening balance",
                "Closing balance",
                "Numbers of transactions in this period",
            ]
        }
        df_metadata = pd.DataFrame.from_dict(
            meta_dict, orient="index", columns=["Value"]
        )
        df = pd.read_csv(ubs_csv_path, sep=";", encoding="utf-8-sig", skiprows=9)
        logger.info(f"Loaded {len(df)} UBS transactions")
        return df_metadata, df

    metadata_df, ubs_df = process_ubs(ubs_csv_path)

    # Sanitize data
    cc_df.columns = cc_df.columns.str.lower()
    ubs_df.columns = ubs_df.columns.str.lower()
    cc_df = cc_df.applymap(lambda s: s.lower() if isinstance(s, str) else s)
    ubs_df = ubs_df.applymap(lambda s: s.lower() if isinstance(s, str) else s)

    logger.info("Data sanitization completed")
    return metadata_df, ubs_df, cc_df


# ==========================
# Step 2: Categorize Transactions
# ==========================
def categorize_transactions(cc_df, ubs_df):
    """Combine and categorize transactions from CC and UBS CSVs"""
    logger.info("Starting transaction categorization...")
    categorized = []

    # UBS
    for _, row in ubs_df.iterrows():
        if pd.isna(row.get("trade date")):
            continue
        date = pd.to_datetime(row["trade date"]).strftime("%d-%m-%Y")
        desc1 = str(row.get("description1", "")).lower()
        desc2 = str(row.get("description2", "")).lower()
        desc3 = str(row.get("description3", "")).lower()

        if pd.notna(row.get("credit")) and row["credit"] > 0:
            amount = row["credit"]
            ttype = "Income"
            if "webloyalty sarl" in desc1 and "reason for payment: salaire" in desc3:
                cat = "Employment"
            elif "credit ubs twint" in desc2:
                cat = "Extras / Twint Chargeback"
            else:
                cat = "Side Hustle"
        elif pd.notna(row.get("debit")) and row["debit"] < 0:
            amount = row["debit"]
            ttype = "Expenses"
            if "sbb mobile" in desc1:
                cat = "Train"
            elif "ubs card center ag" in desc1:
                ttype = "CC_Refund"
                cat = "Card Refund Luca"
            elif "pilet + renaud sa" in desc1 and "bd georges-favon 2" in desc1:
                cat = "Housing"
            else:
                cat = f"{desc1} [UBS]"
        else:
            continue
        categorized.append(
            {"date": date, "Type": ttype, "Category": cat, "Amount": amount}
        )

    # CC
    for _, row in cc_df.iterrows():
        if pd.isna(row.get("purchase date")) or pd.isna(row.get("sector")):
            continue
        date = pd.to_datetime(row["purchase date"], format="%d.%m.%Y").strftime(
            "%d-%m-%Y"
        )
        sector = str(row.get("sector", "")).lower()
        amount = -abs(row.get("amount", 0))
        ttype = "Expenses"
        if "grocery stores" in sector:
            cat = "Groceries"
        elif any(
            x in sector
            for x in [
                "restaurants",
                "bakeries",
                "fast-food restaurants",
                "fast food restaurant",
            ]
        ):
            cat = "Restaurants"
        elif "gasoline service stations" in sector:
            cat = "Car"
        elif "pharmacies" in sector:
            cat = "Health Other"
        else:
            ttype = "No-Label"
            cat = f"{sector} - {row.get('booking text', '')} [CC]"
        categorized.append(
            {"date": date, "Type": ttype, "Category": cat, "Amount": amount}
        )

    df_result = pd.DataFrame(categorized).sort_values("date")
    logger.info(f"Total categorized transactions: {len(df_result)}")
    return df_result


# ==========================
# Step 3: Save results
# ==========================
def save_results(result_df, metadata_df, output_folder):
    result_df.to_csv(
        os.path.join(output_folder, "categorized_transactions.csv"), index=False
    )
    metadata_df.to_csv(os.path.join(output_folder, "metadata.csv"), index=True)
    logger.info("Results saved.")


# ==========================
# Step 4: Validate
# ==========================
def validate_transaction_counts(cc_df, ubs_df, result_df):
    valid_cc = cc_df.dropna(subset=["purchase date", "sector"])
    valid_ubs = ubs_df.dropna(subset=["trade date"])
    valid_ubs = valid_ubs[
        ((pd.notna(valid_ubs.get("credit"))) & (valid_ubs["credit"] > 0))
        | ((pd.notna(valid_ubs.get("debit"))) & (valid_ubs["debit"] < 0))
    ]

    cc_proc = len(result_df[result_df["Category"].str.contains(r"\[CC\]", na=False)])
    ubs_proc = len(result_df[~result_df["Category"].str.contains(r"\[CC\]", na=False)])
    total_expected = len(valid_cc) + len(valid_ubs)
    total_processed = len(result_df)

    logger.info(f"CC - expected: {len(valid_cc)}, processed: {cc_proc}")
    logger.info(f"UBS - expected: {len(valid_ubs)}, processed: {ubs_proc}")
    logger.info(f"Total - expected: {total_expected}, processed: {total_processed}")
    if total_expected == total_processed:
        logger.info("✅ All transactions processed successfully!")
    else:
        logger.warning(f"⚠️ {total_expected - total_processed} transactions missing.")


# ==========================
# Main Execution
# ==========================
if __name__ == "__main__":
    logger.info("Starting budget script execution")

    LOCK_FILE = "budget_script.lock"
    if os.path.exists(LOCK_FILE):
        logger.info("Script is already running. Exiting to avoid duplicate processing.")
        sys.exit(0)

    # Create lock
    open(LOCK_FILE, "w").close()

    try:
        # Detect unprocessed CSV files
        unprocessed_files = get_unprocessed_csv_files()
        if len(unprocessed_files) < 2:
            if len(unprocessed_files) == 0:
                logger.info("No new UBS+CC CSV pair to process. Exiting.")
            else:
                logger.error(
                    "Need at least two unprocessed CSV files (UBS+CC). Exiting."
                )
            sys.exit(0)

        # Identify UBS vs CC automatically
        ubs_csv = next(
            (f for f in unprocessed_files if "ubs" in os.path.basename(f).lower()), None
        )
        cc_csv = next(
            (
                f
                for f in unprocessed_files
                if "cc" in os.path.basename(f).lower()
                or "invoice" in os.path.basename(f).lower()
            ),
            None,
        )

        if not ubs_csv or not cc_csv:
            logger.error(
                "Could not identify UBS or CC CSV file. Make sure filenames contain 'ubs' or 'cc'."
            )
            sys.exit(1)

        logger.info(f"Processing UBS file: {ubs_csv}")
        logger.info(f"Processing CC file: {cc_csv}")

        # ✅ Immediately mark as processed to avoid duplicates
        add_to_processed_files(os.path.basename(ubs_csv))
        add_to_processed_files(os.path.basename(cc_csv))

        # Run main pipeline
        metadata, ubs_df, cc_df = load_and_sanitize_csv(ubs_csv, cc_csv)
        result_df = categorize_transactions(cc_df, ubs_df)
        validate_transaction_counts(cc_df, ubs_df, result_df)
        save_results(result_df, metadata, OUTPUT_FOLDER)

        # Log processed files in log.txt
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(
                f"Processed UBS file: {os.path.basename(ubs_csv)} on {datetime.now()}\n"
            )
            f.write(
                f"Processed CC file: {os.path.basename(cc_csv)} on {datetime.now()}\n"
            )

        logger.info("Budget script execution completed successfully")

    finally:
        # Remove lock file
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
