# LUCID Finance - User Guide

**Welcome to LUCID Finance!** 🎉

Your personal finance management tool to track expenses, plan budgets, and gain financial insights.

**Access:** https://lucid-finance.cc

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Transactions](#transactions)
4. [Budget Planning](#budget-planning)
5. [Categorization Rules](#categorization-rules)
6. [Tips & Best Practices](#tips--best-practices)
7. [FAQ](#faq)

---

## Getting Started

### First Login

1. Visit **https://lucid-finance.cc**
2. Enter your username and password (provided by admin)
3. You'll land on the Dashboard

### Navigation

The sidebar on the left has:
- **📊 Dashboard** - Financial overview
- **💳 Transactions** - View and manage transactions
- **📅 Budget Planning** - Create and track budgets
- **🤖 Rules** - Automate transaction categorization
- **👤 Profile** - Your account (logout button)

---

## Dashboard

### What You'll See

**At the Top:**
- **Year/Month Selector** - Choose the period to view
- **Sub-Type Filter** - Filter by Essentials, Needs, or Wants

**Summary Cards:**
- **Income** - Total income for the period
- **Expenses** - Total spending
- **Savings** - Money saved
- **Fixed Cost Ratio** - Essentials as % of income
  - 🟢 <50% = Excellent
  - 🟡 50-60% = Good
  - 🔴 >60% = High (review expenses)

**Charts:**
- **Top Expenses** - Your biggest spending categories (bar chart)
- **Income vs Expenses** - Breakdown pie chart
- **Monthly Trend** - Spending over time (line graph)

### How to Use

1. **Select Year** - View full year or specific month
2. **Analyze Spending** - Identify where money goes
3. **Compare Periods** - Year-over-year changes shown at bottom
4. **Export** - Download Excel report with "Export to Excel" button

---

## Transactions

### Viewing Transactions

**Filters:**
- **Year** - Select year
- **Month** - Specific month or "All Months"
- **Type** - Income, Expenses, or Savings
- **Category** - Filter by category (Housing, Groceries, etc.)
- **Sub-Type** - Essentials, Needs, or Wants
- **Amount** - Min/max range

**Transaction Table:**
- Date, Description, Type, Category, Sub-Type, Amount
- Click column headers to sort
- Checkbox to select multiple transactions

### Uploading Bank Files

1. Click **"Upload Bank Files"** button
2. Select files:
   - **UBS File** - Your UBS bank CSV export
   - **Credit Card File** - Credit card statement CSV
3. Click **"Upload and Process"**
4. Wait for processing (2-5 seconds)
5. View summary: "Processed X transactions, Y duplicates skipped"

**File Formats:**
- UBS: Standard UBS CSV export
- Credit Card: Credit card statement CSV
- Already processed files are automatically skipped (no duplicates!)

### Editing Transactions

**Single Transaction:**
1. Click pencil icon (✏️) next to transaction
2. Edit:
   - **Type** - Change Income/Expenses/Savings
   - **Category** - Select from dropdown
   - **Sub-Type** - Mark as Essentials/Needs/Wants
3. Click checkmark (✓) to save or X to cancel

**Bulk Edit (Multiple Transactions):**
1. Select checkboxes for transactions you want to edit
2. Click **"Bulk Edit"** button
3. Choose new Type, Category, or Sub-Type
4. Click **"Apply"**
5. All selected transactions updated instantly!

### Deleting Transactions

- **Single:** Click trash icon (🗑️)
- **Bulk:** Select multiple, click "Delete Selected"
- Confirm deletion

⚠️ **Note:** Deleting transactions is permanent (only admin can restore from backup)

---

## Budget Planning

### Overview

The Budget Planning page helps you:
- Set financial goals for each category
- Track actual vs budgeted spending
- See where you're over/under budget

### Budget Summary Dashboard

At the top, you'll see **7 key metrics:**

1. **Income Budget** - Planned income (100% baseline)
2. **Total Expenses** - All expenses with % of income
3. **Essentials & Needs** - Combined fixed costs with % of income
4. **Wants** - Discretionary spending with % of income
5. **Savings** - Planned savings with % of income
6. **Surplus/Deficit** - Net amount with % of income
   - Green = Surplus (saving money!)
   - Orange = Deficit (spending more than earning)

### Using the Budget Wizard 🧙‍♂️

**Best way to create budgets!**

1. Click **"Budget Wizard"** button (sparkles icon ✨)
2. Complete 5 simple steps:

#### Step 1: Income
- Enter your **annual gross income**
- Example: CHF 90,000

#### Step 2: Fixed Costs (Essentials)
- **Yearly Rent** - Your annual housing cost
- **Health Insurance** - Annual premium
- These are automatically marked as "Essentials"

#### Step 3: Needs
- Monthly essential expenses:
  - Groceries
  - Utilities
  - Transport
  - Phone/Internet
- Select categories and enter monthly amounts
- Wizard calculates annual totals

#### Step 4: Wants
- Discretionary spending:
  - Dining Out
  - Entertainment
  - Shopping
  - Subscriptions
- Enter monthly budgets for fun stuff!

#### Step 5: Review & Submit
- See summary of all budgets
- View remaining balance (surplus/deficit)
- Click **"Create Budgets"** to save

**What Happens:**
- Creates yearly budgets for all categories
- Auto-creates monthly budgets (yearly amount ÷ 12)
- Sets sub-types automatically:
  - Housing & Health Insurance → Essentials
  - Needs categories → Needs
  - Wants categories → Wants

### Manual Budget Creation

**If you prefer to add budgets one at a time:**

1. Click **"Add Budget"** button
2. Select:
   - **Type** - Income, Expenses, or Savings
   - **Category** - Choose from dropdown
   - **Sub-Type** - Essentials, Needs, or Wants (optional)
   - **Amount** - Budget amount
   - **Yearly or Monthly** - Check box for monthly budget
3. Click **"Save"**

### Viewing Budgets

**Budget Table Groups:**
- 🟢 **Income** - Expected income
- 🔵 **Expenses - Essentials & Needs** - Fixed costs (Housing first, then Health Insurance, then alphabetically)
- 🟣 **Expenses - Wants** - Discretionary spending
- 🔴 **Expenses - Other** - Uncategorized expenses
- 🟡 **Savings** - Planned savings

**Columns:**
- **Category** - Budget category
- **Jan, Feb, Mar...** - Monthly amounts
- **Yearly** - Total for year
- **Actions** - Delete budget (🗑️)

### Editing Budgets

- Click on a monthly cell to edit that month's budget
- Changes auto-save
- Yearly budget updates automatically when you edit monthly budgets

### Deleting Budgets

- **Single:** Click trash icon next to budget
- **Bulk:** Select checkboxes, click "Delete Selected"

---

## Categorization Rules

### What Are Rules?

Rules automatically categorize transactions based on description patterns.

**Example:**
- Pattern: "Migros"
- → Type: Expenses
- → Category: Groceries

Every time you upload a file with "Migros" in the description, it's automatically categorized!

### Creating Rules

1. Go to **Rules** page
2. Click **"Add Rule"**
3. Fill in:
   - **Pattern** - Text to match (e.g., "Migros", "Salary", "NETFLIX")
   - **Case Sensitive** - Check if exact case matters
   - **Type** - Income, Expenses, or Savings
   - **Category** - Desired category
   - **Priority** - Lower number = higher priority (0 is highest)
4. Click **"Save"**

**Priority Matters:**
- If multiple rules match, the one with lowest priority number wins
- Example: Priority 0 runs before Priority 1

### Amount-Based Rules

Want to categorize based on amount?

1. Add rule as usual
2. Select **Amount Operator** (=, <, >, <=, >=)
3. Enter **Amount Value**

**Example:**
- Pattern: "Transfer"
- Amount: >= 1000
- → Type: Savings, Category: Emergency Fund
- Transfers over CHF 1000 become savings!

### Applying Rules

**Automatically:** Rules apply when you upload new files

**Manually Apply to Existing Transactions:**
1. Go to Rules page
2. Click **"Apply Rules to Transactions"**
3. Rules run on ALL your transactions
4. View summary: "Updated X transactions"

### Editing/Deleting Rules

- **Edit:** Click pencil icon (✏️)
- **Deactivate:** Uncheck "Active" to disable without deleting
- **Delete:** Click trash icon (🗑️)

---

## Tips & Best Practices

### Getting the Most from LUCID Finance

#### 1. Upload Regularly
- Upload bank files monthly (or more often)
- Consistent uploads = accurate budget tracking

#### 2. Use the Budget Wizard
- Easiest way to set up budgets
- Automatically calculates monthly from yearly
- Sets sub-types correctly

#### 3. Review Your Fixed Cost Ratio
- Aim for <50% (excellent)
- If >60%, consider reviewing fixed costs
- Helps maintain financial flexibility

#### 4. Categorize Wisely
- **Essentials** - Must-have, can't reduce (rent, insurance)
- **Needs** - Essential but flexible (groceries, utilities)
- **Wants** - Nice-to-have, can cut (dining, entertainment)

#### 5. Set Up Rules Early
- Create rules for recurring merchants
- Saves time on future uploads
- More consistent categorization

#### 6. Monitor Monthly Trends
- Use Dashboard to spot spending patterns
- Adjust budgets if consistently over/under

#### 7. Export for Analysis
- Download Excel reports for deeper analysis
- Share with accountant if needed
- Keep records for taxes

### Budgeting Strategy: 50/30/20 Rule

A popular budgeting framework:
- **50%** - Essentials & Needs (fixed costs)
- **30%** - Wants (flexible spending)
- **20%** - Savings & Debt repayment

LUCID Finance tracks these for you with sub-types!

---

## FAQ

### How often should I upload transactions?
**Monthly is ideal.** Upload after you receive your bank statement. More frequent uploads are fine too!

### What if I upload the same file twice?
**No problem!** LUCID Finance uses file hashing to detect duplicates - transactions won't be added twice.

### Can I edit or delete transactions?
**Yes!** You can edit type, category, and sub-type. You can also delete transactions. Bulk editing is available for multiple transactions at once.

### How do I fix a mis-categorized transaction?
**Three ways:**
1. **Edit manually** - Click pencil icon and change category
2. **Create a rule** - Add rule for that merchant, then click "Apply Rules"
3. **Bulk edit** - Filter to similar transactions, select all, bulk edit

### What's the difference between Yearly and Monthly budgets?
- **Yearly Budget** - Total for entire year (e.g., CHF 24,000 rent)
  - Auto-creates 12 monthly budgets (CHF 2,000/month)
- **Monthly Budget** - Budget for specific month
  - If you create all 12 months, yearly total is calculated

**Tip:** Use Budget Wizard - it handles this automatically!

### Why did my budget disappear?
Check if you accidentally:
- Deleted it (trash icon)
- Filtered the view (check year selector)

Budgets are stored permanently unless you delete them.

### Can I have multiple users?
**Yes!** Each user has their own data (transactions, budgets, rules). An admin can create user accounts.

### How do I export my data?
**Dashboard → Export to Excel button**
- Downloads Excel file with all transactions for selected period
- Includes type, category, sub-type, amounts

### What if I find a bug?
**Report it!** Contact the admin with:
- What you were doing
- What happened vs what you expected
- Screenshot if possible

### Is my data secure?
**Yes!**
- Hosted on secure Raspberry Pi
- Cloudflare encryption (HTTPS)
- Password protected (bcrypt hashing)
- No data sharing with third parties
- You control your own data

### Can I access this on my phone?
**Yes!** The interface is mobile-responsive. Open https://lucid-finance.cc in your mobile browser.

### Will my data be backed up?
**Yes!** The database is automatically backed up daily at 2 AM. Backups are kept for 14 days.

---

## Need Help?

**Technical Issues:**
- Contact system administrator
- Provide details: what you were doing, error message, screenshot

**Feature Requests:**
- Share your ideas! This is beta - feedback is valuable

**General Questions:**
- Check this guide first
- Ask admin if still unclear

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial release |
| 1.1 | Feb 2026 | Added sub-types (Essentials/Needs/Wants), Budget Wizard, Bulk editing |

---

**Happy budgeting!** 💰📊

**Remember:** Financial awareness is the first step to financial freedom. LUCID Finance makes it easy to see where your money goes and plan where it should go.

---

**Feedback:** This is a beta version - your feedback helps make LUCID Finance better! Let the admin know what works well and what could be improved.
