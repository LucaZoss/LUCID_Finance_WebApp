"""
Main ETL Pipeline Orchestrator.

Coordinates the full ETL process:
1. Extract - Read raw CSV files (UBS + CC)
2. Transform - Categorize and enrich transactions
3. Load - Persist to MySQL database
"""

import glob
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from .config import PipelineConfig, DatabaseConfig
from .extractors import UBSExtractor, CCExtractor, identify_file_type, RawTransaction
from .transformers import TransactionTransformer, TransactionValidator, TransformedTransaction
from .loaders import TransactionLoader, ProcessedFileTracker, TransactionExporter
from .models import DatabaseManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


class TransactionPipeline:
    """
    Main ETL pipeline for processing bank transactions.

    Usage:
        pipeline = TransactionPipeline()
        pipeline.run("/path/to/raw_csv_folder")

    Or for specific files:
        pipeline.process_files(ubs_file="/path/to/ubs.csv", cc_file="/path/to/cc.csv")
    """

    def __init__(
        self,
        config: Optional[PipelineConfig] = None,
        db_config: Optional[DatabaseConfig] = None,
    ):
        """
        Initialize the pipeline.

        Args:
            config: Pipeline configuration (uses defaults if not provided)
            db_config: Database configuration (uses defaults if not provided)
        """
        self.config = config or PipelineConfig()

        if db_config:
            self.config.database = db_config

        # Initialize components
        self.db_manager = DatabaseManager(self.config.database)
        self.ubs_extractor = UBSExtractor(self.config)
        self.cc_extractor = CCExtractor(self.config)
        self.transformer = TransactionTransformer(self.config, self.db_manager)
        self.validator = TransactionValidator(self.config)
        self.loader = TransactionLoader(self.db_manager)
        self.file_tracker = ProcessedFileTracker(self.db_manager)
        self.exporter = TransactionExporter(self.db_manager, self.config)

    def setup_database(self) -> None:
        """Create database tables if they don't exist."""
        logger.info("Setting up database tables...")
        self.db_manager.create_tables()

        # Initialize default categories
        session = self.db_manager.get_session()
        try:
            self.db_manager.init_default_categories(session)
        finally:
            session.close()

        logger.info("Database setup complete")

    def run(
        self,
        raw_folder: str,
        output_folder: Optional[str] = None,
        force: bool = False,
    ) -> dict:
        """
        Run the full ETL pipeline on a folder of CSV files.

        Args:
            raw_folder: Path to folder containing raw CSV files
            output_folder: Optional path for output files
            force: If True, reprocess already processed files

        Returns:
            Dict with processing statistics
        """
        logger.info("=" * 60)
        logger.info(f"Starting ETL Pipeline: {datetime.now()}")
        logger.info("=" * 60)

        # Ensure database is set up
        self.setup_database()

        # Find unprocessed files
        ubs_files, cc_files = self._find_csv_files(raw_folder, force)

        if not ubs_files and not cc_files:
            logger.info("No unprocessed files found. Exiting.")
            return {"status": "no_files", "processed": 0}

        # Process file pairs
        total_stats = {
            "ubs_files": 0,
            "cc_files": 0,
            "total_transactions": 0,
            "inserted": 0,
            "skipped": 0,
            "errors": 0,
        }

        # Process UBS files
        for ubs_file in ubs_files:
            try:
                stats = self._process_ubs_file(ubs_file)
                total_stats["ubs_files"] += 1
                total_stats["total_transactions"] += stats.get("total", 0)
                total_stats["inserted"] += stats.get("inserted", 0)
                total_stats["skipped"] += stats.get("skipped", 0)
                total_stats["errors"] += stats.get("errors", 0)
            except Exception as e:
                logger.error(f"Failed to process UBS file {ubs_file}: {e}")
                total_stats["errors"] += 1

        # Process CC files
        for cc_file in cc_files:
            try:
                stats = self._process_cc_file(cc_file)
                total_stats["cc_files"] += 1
                total_stats["total_transactions"] += stats.get("total", 0)
                total_stats["inserted"] += stats.get("inserted", 0)
                total_stats["skipped"] += stats.get("skipped", 0)
                total_stats["errors"] += stats.get("errors", 0)
            except Exception as e:
                logger.error(f"Failed to process CC file {cc_file}: {e}")
                total_stats["errors"] += 1

        # Export to CSV if output folder specified
        if output_folder:
            os.makedirs(output_folder, exist_ok=True)
            output_file = os.path.join(output_folder, "categorized_transactions.csv")
            self.exporter.export_to_csv(output_file)

        logger.info("=" * 60)
        logger.info(f"Pipeline Complete: {total_stats}")
        logger.info("=" * 60)

        return total_stats

    def process_files(
        self,
        ubs_file: Optional[str] = None,
        cc_file: Optional[str] = None,
        force: bool = False,
    ) -> dict:
        """
        Process specific UBS and/or CC files.

        Args:
            ubs_file: Path to UBS CSV file
            cc_file: Path to CC CSV file
            force: If True, reprocess already processed files

        Returns:
            Dict with processing statistics
        """
        self.setup_database()

        stats = {
            "ubs": None,
            "cc": None,
            "total_inserted": 0,
        }

        if ubs_file:
            if force or not self.file_tracker.is_processed(Path(ubs_file).name):
                stats["ubs"] = self._process_ubs_file(ubs_file)
                stats["total_inserted"] += stats["ubs"].get("inserted", 0)
            else:
                logger.info(f"Skipping already processed file: {ubs_file}")

        if cc_file:
            if force or not self.file_tracker.is_processed(Path(cc_file).name):
                stats["cc"] = self._process_cc_file(cc_file)
                stats["total_inserted"] += stats["cc"].get("inserted", 0)
            else:
                logger.info(f"Skipping already processed file: {cc_file}")

        return stats

    def _find_csv_files(
        self, folder: str, force: bool = False
    ) -> Tuple[List[str], List[str]]:
        """Find UBS and CC CSV files in a folder."""
        all_files = glob.glob(os.path.join(folder, "*.csv"))

        ubs_files = []
        cc_files = []

        for filepath in all_files:
            filename = os.path.basename(filepath)

            # Skip if already processed (unless force=True)
            if not force and self.file_tracker.is_processed(filename):
                logger.info(f"Skipping already processed: {filename}")
                continue

            file_type = identify_file_type(Path(filepath))
            if file_type == "UBS":
                ubs_files.append(filepath)
            elif file_type == "CC":
                cc_files.append(filepath)
            else:
                logger.warning(f"Unknown file type: {filename}")

        logger.info(f"Found {len(ubs_files)} UBS files, {len(cc_files)} CC files")
        return ubs_files, cc_files

    def _process_ubs_file(self, filepath: str) -> dict:
        """Process a single UBS file through the ETL pipeline."""
        filename = os.path.basename(filepath)
        logger.info(f"Processing UBS file: {filename}")

        # Extract
        metadata, raw_transactions = self.ubs_extractor.extract(Path(filepath))
        logger.info(f"Extracted {len(raw_transactions)} raw transactions")

        # Transform
        transformed = self.transformer.transform(raw_transactions, source_file=filename)

        # Validate
        valid, errors = self.validator.validate(transformed)
        if errors:
            logger.warning(f"Validation errors: {len(errors)}")

        # Load
        stats = self.loader.load(valid)

        # Mark as processed
        self.file_tracker.mark_processed(filename, "UBS", len(valid))

        return stats

    def _process_cc_file(self, filepath: str) -> dict:
        """Process a single CC file through the ETL pipeline."""
        filename = os.path.basename(filepath)
        logger.info(f"Processing CC file: {filename}")

        # Extract
        raw_transactions = self.cc_extractor.extract(Path(filepath))
        logger.info(f"Extracted {len(raw_transactions)} raw transactions")

        # Transform
        transformed = self.transformer.transform(raw_transactions, source_file=filename)

        # Validate
        valid, errors = self.validator.validate(transformed)
        if errors:
            logger.warning(f"Validation errors: {len(errors)}")

        # Load
        stats = self.loader.load(valid)

        # Mark as processed
        self.file_tracker.mark_processed(filename, "CC", len(valid))

        return stats

    def get_summary(self, year: int, month: Optional[int] = None) -> dict:
        """Get summary statistics for a period."""
        return self.exporter.get_summary(year, month)

    def export_transactions(
        self,
        filepath: str,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> int:
        """Export transactions to CSV file."""
        return self.exporter.export_to_csv(filepath, year, month)


def main():
    """CLI entry point for the pipeline."""
    import argparse

    parser = argparse.ArgumentParser(description="LUCID Finance ETL Pipeline")
    parser.add_argument(
        "raw_folder",
        nargs="?",
        default="raw_ds",
        help="Folder containing raw CSV files",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="output",
        help="Output folder for exported files",
    )
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Force reprocess already processed files",
    )
    parser.add_argument(
        "--db-host",
        default=os.getenv("DB_HOST", "localhost"),
        help="MySQL host",
    )
    parser.add_argument(
        "--db-port",
        type=int,
        default=int(os.getenv("DB_PORT", "3306")),
        help="MySQL port",
    )
    parser.add_argument(
        "--db-user",
        default=os.getenv("DB_USER", "root"),
        help="MySQL user",
    )
    parser.add_argument(
        "--db-password",
        default=os.getenv("DB_PASSWORD", ""),
        help="MySQL password",
    )
    parser.add_argument(
        "--db-name",
        default=os.getenv("DB_NAME", "lucid_finance"),
        help="MySQL database name",
    )

    args = parser.parse_args()

    # Create config
    db_config = DatabaseConfig(
        host=args.db_host,
        port=args.db_port,
        user=args.db_user,
        password=args.db_password,
        database=args.db_name,
    )

    # Run pipeline
    pipeline = TransactionPipeline(db_config=db_config)
    stats = pipeline.run(args.raw_folder, args.output, args.force)

    print(f"\nPipeline completed: {stats}")


if __name__ == "__main__":
    main()
