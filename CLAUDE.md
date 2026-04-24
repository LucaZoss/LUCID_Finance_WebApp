# LUCID Finance WebApp

Personal finance application for tracking bank transactions, budgets, and spending. **Multi-user system** — each user has fully isolated data (transactions, budgets, categories, rules).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + TailwindCSS + Recharts |
| Backend | FastAPI + SQLAlchemy + Python 3.12 |
| Database | MySQL 8.0 (Docker) |
| Auth | JWT (python-jose) + bcrypt |
| Python packages | `uv` |
| Node packages | `npm` |

## Development Commands

```bash
# Start MySQL
docker compose up -d

# Start backend (port 8000)
./start_backend.sh
# or manually:
uv run uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000

# Start frontend (port 5173)
./start_frontend.sh
# or manually:
cd frontend && npm run dev

# Run tests
uv run pytest tests/

# Frontend build
cd frontend && npm run build
```

**Access:**
- App: http://localhost:5173
- API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

## Project Structure

```
LUCID_Finance_WebApp/
├── backend/
│   ├── api/
│   │   ├── main.py          # FastAPI app init, CORS, router registration
│   │   ├── auth.py          # JWT creation, password hashing
│   │   ├── dependencies.py  # get_current_user, get_admin_user (Depends)
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── constants.py
│   │   ├── exceptions.py
│   │   └── routers/         # One file per domain
│   │       ├── auth.py
│   │       ├── transactions.py
│   │       ├── budgets.py
│   │       ├── categories.py
│   │       ├── rules.py
│   │       ├── dashboard.py
│   │       └── export.py
│   └── data_pipeline/       # ETL for CSV bank imports
│       ├── models.py        # SQLAlchemy ORM models
│       ├── config.py        # Category lists, pattern mappings
│       ├── extractors.py    # UBS + CC CSV parsers
│       ├── transformers.py  # Categorization logic
│       ├── loaders.py       # DB insert/upsert
│       └── pipeline.py      # ETL orchestrator
├── frontend/
│   └── src/
│       ├── pages/           # DashboardPage, TransactionsPage, BudgetPlanningPage, RulesPage, LoginPage, UserManagementPage
│       ├── components/
│       │   ├── BudgetWizard.tsx
│       │   └── ui/          # Button, Card, Input, Select, Modal, LoadingSpinner
│       ├── contexts/AuthContext.tsx
│       ├── api.ts           # Axios client, all API calls
│       ├── types.ts         # TypeScript interfaces
│       ├── constants.ts
│       └── utils/           # formatters.ts, errors.ts
├── tests/                   # pytest test suite
├── ops/                     # Operational & admin tooling (NOT application code)
│   ├── create_admin.py      # Create admin user
│   ├── create_user.py       # Create regular user
│   ├── initialize_categories.py  # Seed default categories
│   ├── migrate_add_*.py     # One-time DB migrations
│   ├── backup_database.sh   # Dump MySQL to file
│   ├── restore_database.sh  # Restore from dump
│   ├── transfer_database.sh # Backup local DB and push to Pi
│   └── pi/                  # Pi-specific deployment & maintenance
│       ├── deploy_to_pi.sh  # Full deploy (git pull, build, systemd, nginx)
│       ├── setup_ssh_key.sh # One-time SSH key setup for Pi
│       ├── backup_lucid.sh  # Cron backup script (runs on Pi)
│       ├── maintenance_lucid.sh  # DB maintenance (runs on Pi)
│       ├── monitor_disk.sh  # Disk health check (runs on Pi)
│       └── install_sd_optimizations.sh  # Pi SD card tuning
├── docs/                    # Architecture, deployment, CSV format docs
├── dev_reference/           # Sample CSVs, reference budget file
├── migrations/              # SQL migration files
├── start_backend.sh         # Dev: start MySQL + FastAPI
├── start_frontend.sh        # Dev: start Vite dev server
├── docker-compose.yml       # MySQL container (dev + prod)
├── pyproject.toml           # Python dependencies
└── .env                     # DB credentials, JWT secret (git-ignored)
```

## Architecture Notes

- **All API routes** require JWT auth via `Depends(get_current_user)` — defined in `backend/api/dependencies.py`
- **Pydantic models** (request/response schemas) live in `backend/api/schemas.py`
- **SQLAlchemy ORM models** live in `backend/data_pipeline/models.py`
- **Routers** are registered in `backend/api/main.py` with `app.include_router(...)`
- Backend enforces strict **user isolation** — every query filters by `user_id == current_user["id"]`. Users cannot see each other's data. Admin users can manage accounts via `Depends(get_admin_user)`.

## Database

MySQL 8.0 running in Docker. Credentials in `.env` (see `.env.example`).

Key tables:
| Table | Purpose |
|-------|---------|
| `transactions` | All bank transactions |
| `budget_plans` | Yearly and monthly budgets per category |
| `categories` | User-defined categories |
| `users` | User accounts |
| `categorization_rules` | Auto-categorization rules (pattern matching) |
| `processed_files` | Tracks imported CSV files (deduplication) |

## Key Patterns

**Adding a new category:**
Edit `backend/data_pipeline/config.py` — add to the relevant list (`income_categories`, `expense_categories`, `savings_categories`) and optionally add a pattern to `ubs_expense_patterns`.

**CSV imports:**
Two supported sources — UBS bank statement CSV and UBS credit card invoice CSV. Auto-detected by `identify_file_type()` in `extractors.py`.

**Categorization rules:**
User-created rules stored in `categorization_rules` table. Applied via `POST /api/rules/apply`. Pattern matching runs in `transformers.py → _check_custom_rules()`.

**Budget auto-populate:**
When a yearly budget is saved, monthly budgets are auto-created (÷12). When all 12 monthly budgets exist, the yearly total is auto-updated. Logic in `routers/budgets.py`.

## Deployment

Currently hosted on Raspberry Pi. Migration to more stable server planned.

```bash
# Deploy to Pi (run from project root)
./ops/pi/deploy_to_pi.sh

# One-time SSH setup
./ops/pi/setup_ssh_key.sh

# Transfer local DB to Pi
./ops/transfer_database.sh

# Pi maintenance scripts (run on the Pi itself)
~/LUCID_Finance_WebApp/ops/pi/backup_lucid.sh
~/LUCID_Finance_WebApp/ops/pi/maintenance_lucid.sh
```

See `docs/RASPBERRY_PI_SETUP.md` and `docs/PRODUCTION_DEPLOYMENT.md` for full deployment guides.
