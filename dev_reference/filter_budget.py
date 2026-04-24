import pandas as pd
import os
import glob
import re

# Define the path to the raw data folder, the summary file, and the processed files log
raw_data_folder = "/Users/lucazosso/Desktop/Luca_Sandbox_Env/budget_script/raw_ds"

processed_files_log = (
    "/Users/lucazosso/Desktop/Luca_Sandbox_Env/budget_script/processed_files.log"
)


# Function to get the list of processed files
def get_processed_files():
    if not os.path.exists(processed_files_log):
        return set()
    with open(processed_files_log, "r") as f:
        return set(f.read().splitlines())


# Function to add a file to the processed list
def add_to_processed_files(filename):
    with open(processed_files_log, "a") as f:
        f.write(filename + "\n")


# Get the list of all CSV files and processed files
all_files = glob.glob(os.path.join(raw_data_folder, "*.csv"))
processed_files = get_processed_files()

# Filter out the files that have already been processed
unprocessed_files = [f for f in all_files if os.path.basename(f) not in processed_files]
