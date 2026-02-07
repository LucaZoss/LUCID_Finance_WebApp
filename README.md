# LUCID Finance WebApp

A personal budgeting application with ETL pipeline for bank transactions and budget tracking.

## Features

### 1. Transaction Management
- Upload and process UBS bank statements and credit card invoices (CSV format)
- Automatic categorization based on transaction patterns
- Manual editing of transaction types and categories
- Deduplication to prevent duplicate entries
- Full CRUD operations on transactions

### 2. Budget Planning
- Set yearly and monthly budgets for income, expenses, and savings categories
- Separate budgets by category (Housing, Groceries, Restaurants, etc.)
- Easy-to-use interface with inline editing
- Budget summary overview

### 3. Budget Dashboard
- Visual overview of budget vs actual spending
- Interactive charts:
  - Monthly trend line chart
  - Category distribution pie chart
  - Top 10 expenses bar chart
- Detailed breakdowns for Income, Expenses, and Savings
- Period selection (yearly or monthly view)

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database operations
- **MySQL 8.0** - Database (running in Docker)
- **Pandas** - Data processing for ETL pipeline
- **Python-dotenv** - Environment configuration

### Frontend
- **React 18** with **TypeScript**
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **Recharts** - Data visualization
- **Axios** - API client
- **Lucide React** - Icons

## Project Structure

```
LUCID_Finance_WebApp/
├── backend/                    # Backend Python application
│   ├── api/                   # FastAPI REST API
│   │   ├── main.py           # API endpoints
│   │   └── auth.py           # Authentication & authorization
│   └── data_pipeline/        # ETL pipeline
│       ├── config.py         # Configuration & category mappings
│       ├── extractors.py     # CSV file parsers
│       ├── transformers.py   # Transaction categorization
│       ├── loaders.py        # Database loaders
│       ├── models.py         # SQLAlchemy ORM models
│       └── pipeline.py       # Main ETL orchestrator
├── frontend/                  # React TypeScript frontend
│   ├── src/
│   │   ├── pages/            # Page components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── TransactionsPage.tsx
│   │   │   ├── BudgetPlanningPage.tsx
│   │   │   ├── RulesPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── contexts/         # React contexts
│   │   ├── api.ts            # API client
│   │   ├── types.ts          # TypeScript types
│   │   └── App.tsx           # Main app component
│   ├── package.json
│   └── vite.config.ts
├── model/                     # ML forecasting models (future)
│   ├── api/                  # Model API endpoints
│   ├── forecasting/          # Prediction models
│   ├── examples/             # Training examples
│   ├── models/               # Trained model files (.pkl)
│   └── README.md             # Model implementation guide
├── tests/                     # Test suite
│   ├── backend/              # Backend API tests
│   ├── test_*.py             # Pipeline & integration tests
│   └── README.md
├── scripts/                   # Utility scripts
│   ├── create_admin.py       # Admin user creation
│   └── migrate_*.py          # Database migrations
├── docs/                      # Documentation
│   ├── AUTHENTICATION.md
│   ├── DASHBOARD_FIXES.md
│   └── push-to-rasp.md
├── docker-compose.yml        # MySQL container config
├── .env.example              # Environment template
├── .env                      # Environment variables (git-ignored)
├── pyproject.toml            # Python dependencies
├── start_backend.sh          # Backend startup script
├── start_frontend.sh         # Frontend startup script
└── README.md                 # This file

```

## Setup Instructions

### Prerequisites
- Python 3.12+
- Node.js 18+
- Docker Desktop (for MySQL)
- `uv` (Python package manager)

### 1. Clone and Setup Environment

```bash
cd LUCID_Finance_WebApp

# Copy environment template
cp .env.example .env

# Edit .env if needed (default values work for local development)
```

### 2. Install Backend Dependencies

```bash
# Install Python dependencies with uv
uv sync
```

### 3. Start MySQL Database

```bash
# Start MySQL in Docker
docker compose up -d

# Verify it's running
docker ps
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

## Running the Application

### Option 1: Using Startup Scripts

**Terminal 1 - Backend:**
```bash
./start_backend.sh
```

**Terminal 2 - Frontend:**
```bash
./start_frontend.sh
```

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
# Ensure MySQL is running
docker compose up -d

# Start FastAPI server
uv run uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Usage Guide

### 1. Upload Transactions

1. Navigate to the "Transactions" page
2. Upload your UBS bank statement CSV (exported from UBS e-banking)
3. Upload your Credit Card invoice CSV (exported from UBS CC portal)
4. Click "Upload & Process"
5. Transactions will be automatically categorized and stored

### 2. Review and Edit Transactions

- Filter transactions by year, month, or type
- Search by description or category
- Click the edit icon to modify type/category
- Click the delete icon to remove transactions

### 3. Set Budgets

1. Go to "Budget Planning" page
2. Select the year
3. Click "Add Budget"
4. Choose type (Income/Expenses/Savings), category, and amount
5. Select if it's a yearly or monthly budget
6. Save the budget

Or edit directly in the table by entering amounts in the cells.

### 4. View Dashboard

1. Navigate to "Dashboard"
2. Select year and period (full year or specific month)
3. View:
   - Summary cards with actuals vs budget
   - Monthly trend chart
   - Distribution pie chart
   - Top expenses bar chart
   - Detailed breakdowns by type

## Database Schema

### Tables

- **transactions** - All processed transactions
- **budget_plans** - Budget entries (yearly or monthly)
- **categories** - Category definitions
- **processed_files** - Track which CSV files have been processed

### Transaction Categorization

The ETL pipeline automatically categorizes transactions based on:

**UBS Transactions:**
- Income: Employment, Side Hustle, Twint Chargebacks
- Expenses: Housing, Groceries, Train, Health Insurance, etc.
- Pattern matching on description fields

**Credit Card Transactions:**
- Mapped by merchant category codes (MCC)
- Sector-based categorization (restaurants, groceries, pharmacies, etc.)

Uncategorized transactions are marked as "Uncategorized" for manual review.

## API Endpoints

### Transactions
- `GET /api/transactions` - List transactions with filters
- `GET /api/transactions/{id}` - Get single transaction
- `PATCH /api/transactions/{id}` - Update transaction
- `DELETE /api/transactions/{id}` - Delete transaction
- `POST /api/upload` - Upload and process CSV files

### Budgets
- `GET /api/budgets` - List all budgets
- `POST /api/budgets` - Create/update budget
- `DELETE /api/budgets/{id}` - Delete budget

### Dashboard
- `GET /api/dashboard/summary` - Get budget summary
- `GET /api/dashboard/monthly-trend` - Get monthly trend data

### Metadata
- `GET /api/categories` - Get available categories
- `GET /api/types` - Get transaction types
- `GET /api/years` - Get years with data
- `GET /api/health` - Health check

## Development

### Run ETL Pipeline Directly

```bash
# Process files in raw_data folder
uv run python -m backend.data_pipeline.pipeline raw_data --output output

# Force reprocess files
uv run python -m backend.data_pipeline.pipeline raw_data --force

# Custom database settings
uv run python -m backend.data_pipeline.pipeline raw_data \
  --db-host localhost \
  --db-port 3306 \
  --db-user lucid_user \
  --db-password lucid_pass_2025
```

### Database Management

```bash
# Access MySQL CLI
docker exec -it lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance

# View tables
SHOW TABLES;

# Query transactions
SELECT type, category, COUNT(*) as count, SUM(amount) as total
FROM transactions
GROUP BY type, category
ORDER BY total DESC;
```

### Add New Categories

Edit `backend/data_pipeline/config.py`:

```python
# For expenses
expense_categories: List[str] = field(default_factory=lambda: [
    "Housing",
    "Groceries",
    # Add your new category here
    "Your New Category",
])

# Add pattern matching
ubs_expense_patterns: Dict[str, str] = field(default_factory=lambda: {
    "your pattern": "Your New Category",
})
```

## Deployment (Raspberry Pi)

1. Install Docker on Raspberry Pi
2. Clone the repository
3. Follow setup instructions above
4. Configure `.env` with production settings
5. Use `docker-compose` for MySQL
6. Run backend with `uvicorn` (consider using `systemd` service)
7. Build frontend: `cd frontend && npm run build`
8. Serve frontend with nginx or similar

## License

Personal project - All rights reserved

## Author

Luca Zosso
