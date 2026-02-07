# LUCID Finance - Project Structure

Last Updated: February 7, 2026

## Overview

This document describes the organization of the LUCID Finance WebApp project. The structure follows industry best practices for a full-stack application with clear separation between frontend, backend, tests, and documentation.

## Directory Structure

```
LUCID_Finance_WebApp/
│
├── backend/                    # Backend Python application
│   ├── __init__.py
│   ├── api/                   # FastAPI REST API
│   │   ├── __init__.py
│   │   ├── main.py           # API endpoints & application entry
│   │   └── auth.py           # JWT authentication & authorization
│   └── data_pipeline/        # ETL pipeline for bank transactions
│       ├── __init__.py
│       ├── config.py         # Configuration & category mappings
│       ├── extractors.py     # CSV file parsers (UBS bank & CC)
│       ├── transformers.py   # Transaction categorization logic
│       ├── loaders.py        # Database loading & deduplication
│       ├── models.py         # SQLAlchemy ORM models
│       └── pipeline.py       # ETL orchestrator & CLI entry point
│
├── frontend/                  # React TypeScript frontend
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── pages/            # Page components
│   │   │   ├── DashboardPage.tsx      # Budget dashboard with charts
│   │   │   ├── TransactionsPage.tsx   # Transaction management
│   │   │   ├── BudgetPlanningPage.tsx # Budget planning interface
│   │   │   ├── RulesPage.tsx          # Categorization rules
│   │   │   └── LoginPage.tsx          # Authentication
│   │   ├── contexts/         # React contexts
│   │   │   └── AuthContext.tsx        # Authentication state
│   │   ├── api.ts            # API client (Axios)
│   │   ├── types.ts          # TypeScript type definitions
│   │   ├── App.tsx           # Main application component
│   │   └── main.tsx          # React entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts        # Vite configuration
│   └── tsconfig.json         # TypeScript configuration
│
├── model/                     # Machine Learning forecasting (future)
│   ├── __init__.py
│   ├── api/                  # Model API endpoints
│   │   └── __init__.py
│   ├── forecasting/          # Prediction models
│   │   └── __init__.py
│   ├── examples/             # Training examples & scripts
│   │   ├── __init__.py
│   │   └── train_forecast_model.py
│   ├── models/               # Trained model files (.pkl, .h5)
│   │   └── .gitkeep
│   ├── notebooks/            # Jupyter notebooks for analysis
│   └── README.md             # Comprehensive implementation guide
│
├── tests/                     # Test suite
│   ├── __init__.py
│   ├── backend/              # Backend API tests
│   │   ├── __init__.py
│   │   └── test_api.py
│   ├── frontend/             # Frontend tests
│   ├── test_amount_conditions.py     # Amount-based rule tests
│   ├── test_apply_rules.py           # Rule application tests
│   ├── test_budgets.py               # Budget functionality tests
│   ├── test_categorization_rules.py  # Categorization tests
│   ├── test_enhancements.py          # Enhancement tests
│   └── README.md
│
├── scripts/                   # Utility scripts
│   ├── create_admin.py       # Create admin user
│   └── migrate_add_amount_conditions.py  # DB migration
│
├── docs/                      # Documentation
│   ├── AUTHENTICATION.md     # Auth system documentation
│   ├── DASHBOARD_FIXES.md    # Dashboard implementation notes
│   ├── push-to-rasp.md       # Raspberry Pi deployment guide
│   └── PROJECT_STRUCTURE.md  # This file
│
├── Helpers/                   # Personal helper files (gitignored)
│   ├── MASTER_BUDGET_LUCA.xlsx
│   ├── Samples/
│   ├── budget_script_v1.py
│   └── filter_budget.py
│
├── raw_data/                  # Sample/test data files (gitignored)
│   ├── cc_invoice_oct25-jan26.csv
│   └── ubs_transactions_oct25-jan26.csv
│
├── output/                    # ETL pipeline output (gitignored)
│   └── categorized_transactions.csv
│
├── temp_uploads/              # Temporary upload storage (gitignored)
│
├── .venv/                     # Python virtual environment (gitignored)
├── .git/                      # Git repository
├── .github/                   # GitHub workflows (if added)
│
├── .env                       # Environment variables (gitignored)
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── .python-version            # Python version for uv
├── docker-compose.yml         # MySQL container configuration
├── pyproject.toml             # Python dependencies & project config
├── pytest.ini                 # Pytest configuration
├── uv.lock                    # uv lockfile
├── start_backend.sh           # Backend startup script
├── start_frontend.sh          # Frontend startup script
└── README.md                  # Main project README

```

## Key Changes from Original Structure

### Before Reorganization
- Test files scattered in project root
- `src/` folder name (generic)
- No model folder structure
- Documentation files in root
- Utility scripts in root

### After Reorganization
- All tests organized in `tests/` folder
- `backend/` folder (clearer naming)
- `model/` folder with ML implementation guide
- Documentation in `docs/` folder
- Utility scripts in `scripts/` folder

## Module Import Patterns

### Backend Imports
```python
# Within backend modules
from backend.data_pipeline.models import Transaction, User
from backend.api.auth import get_current_user

# From tests
from backend.data_pipeline.models import DatabaseManager
```

### Running Commands
```bash
# Start backend
uv run uvicorn backend.api.main:app --reload

# Run ETL pipeline
uv run python -m backend.data_pipeline.pipeline raw_data

# Run tests
pytest tests/

# Create admin user
uv run python scripts/create_admin.py
```

## Technology Stack

### Backend
- **FastAPI** - REST API framework
- **SQLAlchemy** - ORM
- **MySQL 8.0** - Database (Docker)
- **Pandas** - ETL data processing
- **JWT** - Authentication
- **Bcrypt** - Password hashing

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Recharts** - Data visualization
- **Axios** - HTTP client

### Development
- **uv** - Python package manager
- **pytest** - Testing framework
- **Docker Compose** - MySQL containerization

## Core Features

### 1. Transaction Management
- CSV upload (UBS bank & credit card)
- Automatic categorization
- Manual editing
- Deduplication
- Full CRUD operations

### 2. Budget Planning
- Yearly/monthly budgets
- Category-based budgets
- Income/Expenses/Savings tracking
- Budget vs actual comparison

### 3. Dashboard
- Budget summary cards
- Monthly trend chart (bar + line)
- Category distribution pie chart
- Top 10 expenses bar chart
- Detailed breakdowns by type
- Excel export functionality

### 4. Categorization Rules
- Pattern-based categorization
- Amount conditions (>, <, >=, <=, =)
- Priority system
- Active/inactive toggle
- Apply to existing transactions

### 5. Authentication
- JWT-based authentication
- Role-based access (admin/user)
- Secure password hashing
- User management

## Database Schema

### Main Tables
- **users** - User accounts & authentication
- **transactions** - All processed transactions
- **budget_plans** - Budget entries (yearly/monthly)
- **categorization_rules** - Custom categorization rules
- **processed_files** - Track uploaded CSV files

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/users` - Create user (admin only)
- `GET /api/auth/users` - List users (admin only)

### Transactions
- `GET /api/transactions` - List with filters
- `PATCH /api/transactions/{id}` - Update
- `DELETE /api/transactions/{id}` - Delete
- `POST /api/upload` - Upload CSV files

### Budgets
- `GET /api/budgets` - List all
- `POST /api/budgets` - Create/update
- `DELETE /api/budgets/{id}` - Delete
- `POST /api/budgets/bulk-delete` - Delete multiple

### Categorization Rules
- `GET /api/rules` - List rules
- `POST /api/rules` - Create rule
- `PATCH /api/rules/{id}` - Update rule
- `DELETE /api/rules/{id}` - Delete rule
- `POST /api/rules/apply` - Apply to existing transactions

### Dashboard
- `GET /api/dashboard/summary` - Budget summary
- `GET /api/dashboard/monthly-trend` - Monthly trend data

### Export
- `GET /api/export/excel` - Download Excel report

### Metadata
- `GET /api/categories` - Available categories
- `GET /api/types` - Transaction types
- `GET /api/years` - Years with data
- `GET /api/health` - Health check

## Future Enhancements (model/ folder)

See [model/README.md](../model/README.md) for detailed implementation guide.

### Planned Features
1. **Expense Forecasting** - Predict future spending by category
2. **Budget Optimization** - Suggest optimal budget allocations
3. **Anomaly Detection** - Identify unusual spending patterns
4. **Cash Flow Predictions** - Project future income/expenses
5. **Trend Analysis** - Long-term financial insights

### Technologies (planned)
- Prophet / scikit-learn for forecasting
- XGBoost for classification
- Pandas for data preparation
- Joblib for model serialization

## Development Workflow

### Local Development
1. Start MySQL: `docker compose up -d`
2. Start backend: `./start_backend.sh`
3. Start frontend: `./start_frontend.sh`
4. Access app at http://localhost:5173

### Testing
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_budgets.py

# Run with coverage
pytest --cov=backend tests/
```

### Database Management
```bash
# Access MySQL CLI
docker exec -it lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance

# Create admin user
uv run python scripts/create_admin.py

# Run migration
uv run python scripts/migrate_add_amount_conditions.py
```

## Deployment

### Environment Setup
1. Copy `.env.example` to `.env`
2. Update production values
3. Set secure `SECRET_KEY` in auth.py

### Production Considerations
- Use environment variables for secrets
- Enable HTTPS/SSL
- Configure CORS properly
- Set up database backups
- Monitor logs and errors
- Use systemd for backend service
- Use nginx for frontend serving

## Git Workflow

### Ignored Files (.gitignore)
- Python artifacts (`__pycache__`, `*.pyc`)
- Virtual environments (`.venv/`)
- Environment files (`.env`)
- Database files (`*.db`, `*.sqlite`)
- Data folders (`raw_data/`, `output/`)
- Frontend build artifacts (`dist/`, `node_modules/`)
- ML models (`model/models/*.pkl`)
- IDE files (`.vscode/`, `.idea/`)
- Logs (`*.log`)

### Commit Guidelines
- Use descriptive commit messages
- Group related changes
- Test before committing
- Keep commits atomic

## Support & Documentation

- Main README: [../README.md](../README.md)
- Authentication: [AUTHENTICATION.md](AUTHENTICATION.md)
- Dashboard Implementation: [DASHBOARD_FIXES.md](DASHBOARD_FIXES.md)
- Raspberry Pi Deployment: [push-to-rasp.md](push-to-rasp.md)
- ML Model Guide: [../model/README.md](../model/README.md)

## Author

Luca Zosso
