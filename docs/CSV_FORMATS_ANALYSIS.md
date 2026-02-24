# CSV Formats Analysis

## Current Supported Formats

### UBS Bank Account Format
**File characteristics:**
- Separator: `;` (semicolon)
- Encoding: UTF-8 with BOM
- Metadata rows: 1-8 (Account info, IBAN, dates, balances)
- Header row: Line 10
- Data starts: Line 11

**Columns:**
```
Trade date;Trade time;Booking date;Value date;Currency;Debit;Credit;Individual amount;Balance;Transaction no.;Description1;Description2;Description3;Footnotes;
```

**Key features:**
- Date format: `YYYY-MM-DD`
- Separate `Debit` (negative) and `Credit` (positive) columns
- Multiple description columns (Description1, Description2, Description3)
- Metadata header with account info

**Sample row:**
```
2025-09-30;;2025-09-30;2025-09-30;CHF;-129.00;;;10310.74;9928273GK3883790;"ZOSSO, YANN; Debit UBS TWINT";;"Reason for payment: +41799016698; TWINT-Acc.:+41798977067; Transaction no. 9928273GK3883790";;
```

---

### Credit Card Invoice Format
**File characteristics:**
- Separator: `;` (semicolon)
- Encoding: Latin-1
- Skip rows: 1 (sep=; header)
- Header row: Line 2
- Data starts: Line 3

**Columns:**
```
Purchase date;Sector;Booking text;Amount;Debit;Credit;Original amount;Original currency;Exchange rate
```

**Key features:**
- Date format: `DD.MM.YYYY`
- Separate `Debit` and `Credit` columns
- `Sector` column for merchant category
- `Booking text` for transaction description

---

### BCV Bank Account Format (NEW)
**File characteristics:**
- Separator: `,` (comma)
- Encoding: UTF-8
- No metadata rows
- Header row: Line 1
- Data starts: Line 2

**Columns:**
```
Dates,Catégorie,Description,Comptes,Montant,Devise,Divisée opération
```

**Key features:**
- Date format: `DD.MM.YY`
- Single `Montant` column (negative = debit, positive = credit)
- Single `Description` column
- No metadata header

**Sample row:**
```
03.01.26,Non catégorisé,RETRAIT ETR SOCIETE GENERALE 62000 TOUQUET SGCT FRA,CH28 0076 7000 E519 3944 4,-74.44,CHF,Non
```

---

## Challenges for Generic Parser

### 1. Separator Detection
- UBS/CC use `;`
- BCV uses `,`
- Solution: Try both separators, use the one that produces more columns

### 2. Header Row Detection
- UBS: Row 10 (after 9 metadata rows)
- CC: Row 2 (after 1 sep=; row)
- BCV: Row 1 (no metadata)
- Solution: Find first row with >2 columns containing non-numeric text

### 3. Column Mapping
Different column names for same data:
- Date: `Trade date` (UBS), `Purchase date` (CC), `Dates` (BCV)
- Amount: `Debit`/`Credit` (UBS/CC), `Montant` (BCV)
- Description: `Description1/2/3` (UBS), `Booking text` (CC), `Description` (BCV)

### 4. Date Format Parsing
- UBS: `YYYY-MM-DD`
- CC: `DD.MM.YYYY`
- BCV: `DD.MM.YY` (2-digit year!)

### 5. Amount Handling
- UBS/CC: Separate Debit (negative) and Credit (positive) columns
- BCV: Single Montant column with sign (negative = debit)

---

## Proposed Generic Parser Architecture

### Step 1: Auto-detect File Format
```python
def detect_csv_format(filepath):
    # Try different separators (,;|tab)
    # Find header row (first row with >2 non-empty columns)
    # Return: separator, encoding, header_row_index
```

### Step 2: Intelligent Column Mapping
```python
def map_columns(headers):
    # Map known patterns to standard fields:
    # - date_column: contains "date", "data", "datum"
    # - amount_columns: numeric, contains "amount", "montant", "debit", "credit"
    # - description_columns: text, contains "description", "booking", "text"
```

### Step 3: Parse Rows Generically
```python
def parse_row(row, column_map):
    # Parse date (try multiple formats)
    # Parse amount (handle single column vs debit/credit)
    # Concatenate description fields
    # Return RawTransaction
```

### Step 4: File Type Identification
Instead of filename-based, use format detection:
```python
def identify_bank(column_headers, sample_data):
    # UBS: Has "trade date", "description1", "debit"/"credit" separate
    # CC: Has "purchase date", "sector", "booking text"
    # BCV: Has "dates", "montant" (single amount column)
    # Generic: Everything else
```

---

## Implementation Plan

1. **Create `GenericExtractor` class**
   - Auto-detect separator, encoding, header row
   - Intelligent column mapping
   - Handle multiple date formats
   - Support both single-amount and debit/credit columns

2. **Keep existing extractors for backward compatibility**
   - UBSExtractor (legacy)
   - CCExtractor (legacy)
   - Add BCVExtractor (new)

3. **Update `identify_file_type()` function**
   - Add "BCV" detection
   - Add format-based detection (not just filename)

4. **Add configuration for BCV**
   - Separator: `,`
   - Date format: `DD.MM.YY`
   - Column mappings

5. **Update API endpoint**
   - Accept files without requiring "UBS" or "CC" in filename
   - Use GenericExtractor as fallback

---

## Benefits of Generic Parser

✅ **Support any bank format** - Just upload CSV, parser figures it out
✅ **Less maintenance** - No need to create extractor for each bank
✅ **More robust** - Handles variations in CSV structure
✅ **Future-proof** - Easy to add new banks
✅ **User-friendly** - No need to label files with bank name

---

## Testing Strategy

1. **Test with existing formats**
   - Ensure UBS and CC files still parse correctly
   - No regression in existing functionality

2. **Test with BCV format**
   - Parse sample BCV file
   - Verify date parsing (DD.MM.YY)
   - Verify amount parsing (single column with sign)

3. **Test edge cases**
   - Empty rows
   - Missing columns
   - Invalid dates
   - Multiple separators in data

---

**Next Steps:**
1. Implement `GenericExtractor` class
2. Add `BCVExtractor` class
3. Update configuration
4. Test with all three formats
5. Update API documentation
