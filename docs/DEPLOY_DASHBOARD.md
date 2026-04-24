# Deploy Dashboard Enhancements

## Changes Committed
- ✅ Backend: Added fixed cost ratio and year-over-year comparison
- ✅ Frontend: Updated all 4 dashboard cards with new metrics
- ✅ Code pushed to GitHub (commit 591dd6b)

## Deployment Steps

SSH to your Pi and run these commands:

```bash
# Navigate to project directory
cd /home/pi/LUCID_Finance_WebApp

# Pull latest code from GitHub
git pull origin main

# Build the frontend
cd frontend
npm run build

# Restart backend service
sudo systemctl restart lucid-backend

# Check backend status
sudo systemctl status lucid-backend

# Check logs if needed
sudo journalctl -u lucid-backend -f
```

## What's New

### 1. Income Card
- Shows **% of Budget** with color coding
- **Green**: Over 100% (exceeding budget)
- **Red**: Under 100% (below budget)
- **Grey**: Exactly 100%

### 2. Expenses Card
- Shows **% of Budget** with color coding
- **Green**: Under 100% (under budget)
- **Red**: Over 100% (over budget)
- **Grey**: Exactly 100%

### 3. Fixed Cost Ratio Card (replaces Savings)
- **Formula**: (Housing + Health Insurance + Health Other + Tax) / Total Income × 100
- Shows financial health assessment
- **Green badge**: <50% (Excellent)
- **Yellow badge**: 50-60% (Good)
- **Red badge**: >60% (High)

### 4. Net Balance Card
- Shows **Year-over-Year comparison**
- Compares to same period from previous year
  - If viewing February 2025 → compares to February 2024
  - If viewing Full Year 2025 → compares to Full Year 2024
- Shows absolute change and percentage change
- **Green badge**: Positive change (improved)
- **Red badge**: Negative change (decreased)

## After Deployment

Visit https://lucid-finance.cc to see the new dashboard!
