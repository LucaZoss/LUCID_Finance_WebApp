# Dashboard Fixes & Improvements

## Issues Fixed ✅

### 1. Top 10 Expenses Graph - No Budgets Displayed
**Problem**: Budget amounts weren't showing in the bar chart.

**Root Cause**: When viewing yearly data with both yearly budgets AND monthly budgets, the API was incorrectly summing monthly budgets instead of using the yearly budget.

**Fix**: Updated budget aggregation logic in `src/api/main.py`:
- For **yearly view**: Prefer yearly budget if it exists, otherwise sum monthly budgets
- For **monthly view**: Use monthly budget, or divide yearly budget by 12

**Result**: Budgets now display correctly in all charts.

---

### 2. Expenses Breakdown - No Percentages
**Problem**: Percentage completion wasn't displaying.

**Root Cause**: Two issues:
1. Missing percent calculation for items with actual but no budget
2. Budget aggregation was wrong (same as issue #1)

**Fix**:
- Added proper percent calculation: `(actual / budget * 100)` when budget exists
- For items with actual spending but no budget: show 100%
- Fixed budget aggregation (see issue #1)

**Result**: Percentages now display correctly for all expense categories.

---

### 3. Savings Breakdown - No Actual Savings
**Problem**: Savings section shows only budgets, no actual savings.

**Root Cause**: **The ETL pipeline doesn't automatically categorize any transactions as "Savings"**. It only creates:
- `Income` - from employment, side hustles
- `Expenses` - all spending
- `CC_Refund` - credit card payments
- `No-Label` - uncategorized items

**Why?** Bank statements don't clearly distinguish "savings" from regular transactions. Savings need to be explicitly tracked.

---

## Solutions for Savings Tracking

### Option 1: Manual Categorization (Quick)
1. Go to **Transactions** page
2. Find transactions that represent savings (e.g., transfers to savings accounts)
3. Click **Edit** icon
4. Change **Type** to "Savings"
5. Select appropriate **Category**:
   - Rent Guarantee
   - Emergency Fund
   - Retirement Account
   - Stock Portfolio
   - Sinking Fund Down Payment
   - Sinking Fund Rest

### Option 2: Bulk Update (Efficient)
Use the new bulk update endpoint to reclassify multiple transactions at once:

```python
import requests

# Example: Reclassify all transactions with "savings" in description
requests.post("http://localhost:8000/api/transactions/bulk-update", json={
    "description_contains": "epargne",  # or "savings", "compte", etc.
    "updates": {
        "type": "Savings",
        "category": "Emergency Fund"
    }
})
```

### Option 3: Add Automatic Detection (Advanced)
Update the ETL pipeline to auto-detect savings:

1. Edit `src/data_pipeline/config.py`:
```python
# Add savings patterns
ubs_savings_patterns: Dict[str, str] = field(default_factory=lambda: {
    "compte épargne": "Emergency Fund",
    "compte 3a": "Retirement Account",
    "caution loyer": "Rent Guarantee",
    # Add your patterns here
})
```

2. Edit `src/data_pipeline/transformers.py` in `_categorize_ubs_expense()`:
```python
# Check for savings (add before final return)
for pattern, category in self.categories.ubs_savings_patterns.items():
    if pattern in desc1 or pattern in desc3:
        return ("Savings", category)
```

3. Reprocess your CSV files with `--force` flag

---

## Testing

### Test Budget Aggregation
```bash
# Start backend
./start_backend.sh

# In another terminal
curl 'http://localhost:8000/api/dashboard/summary?year=2025'
```

### Test Bulk Update
```bash
uv run python -c "
import requests

# Reclassify uncategorized transactions as savings
result = requests.post('http://localhost:8000/api/transactions/bulk-update', json={
    'category_filter': 'Uncategorized',
    'updates': {'type': 'Savings', 'category': 'Emergency Fund'}
})
print(result.json())
"
```

---

## Current Data Summary (2025)

Based on your database:

**Income**: CHF 29,880.65
- Employment: CHF 24,953.95
- Side Hustle: CHF 4,009.60
- Twint Chargeback: CHF 917.10

**Expenses**: CHF 10,036.62
- Housing: CHF 3,824.00 (Budget: CHF 10,000 - 38% used)
- Restaurants: CHF 1,812.97 (No budget)
- Groceries: CHF 688.40 (Budget: CHF 500 - 138% over)
- Health Insurance: CHF 1,504.05 (No budget)
- Other categories...

**Savings**: CHF 0.00 (No savings transactions yet)
- Budget: CHF 6,240 (Rent Guarantee)

**Uncategorized**: CHF 14,472.93 (65 transactions)
- **Action needed**: Review and categorize these!

---

## Recommendations

1. **Review Uncategorized Transactions** (65 items totaling CHF 14,472)
   - These might include savings, refunds, or unrecognized expenses
   - Go through them in the Transactions page

2. **Set More Budgets**
   - Many expense categories have no budget set
   - Go to Budget Planning and set budgets for:
     - Restaurants
     - Health Insurance
     - Train
     - Internet + Mobile
     - etc.

3. **Track Savings Properly**
   - Identify which transactions are savings
   - Use manual categorization or bulk update
   - Consider adding auto-detection if you have clear patterns

4. **Regular Reviews**
   - Check the dashboard monthly
   - Adjust budgets based on actual spending patterns
   - Keep uncategorized items to a minimum

---

## Files Modified

- `src/api/main.py` - Fixed budget aggregation and added bulk update endpoint
- `src/data_pipeline/models.py` - Updated BudgetPlan schema (amount field, nullable month)
- `frontend/src/pages/BudgetPlanningPage.tsx` - Better validation and error handling

All changes are backward compatible and working! 🎉
