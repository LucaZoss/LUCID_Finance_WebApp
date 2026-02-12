# CRITICAL: User Isolation Fix Required

## Problem

**SEVERITY: CRITICAL - PRIVACY VIOLATION**

All users currently share the same financial data. When user "yanni" logs in, they can see all of user "luca's" transactions, budgets, and categories. This is a critical privacy and security issue.

## Root Cause

The database models have NO `user_id` foreign keys, so there's no way to separate data between users. All API endpoints query data without filtering by the current user.

## Solution Overview

1. ✅ Add `user_id` columns to database tables (via migration)
2. ✅ Update SQLAlchemy models with `user_id` foreign keys
3. ⚠️  **IN PROGRESS**: Update ALL API endpoints to filter by current user
4. ⚠️  Run database migration on production Pi
5. ⚠️  Test multi-user isolation

## Database Changes (COMPLETED)

Added `user_id` to these tables:
- `transactions`
- `budget_plans`
- `processed_files`
- `categories`

Migration script created: `scripts/migrate_add_user_isolation.py`

## API Endpoints That Need Fixing (20+ endpoints)

### Transaction Endpoints
- [ ] `GET /api/transactions` - Add `.filter(Transaction.user_id == user_id)`
- [ ] `GET /api/transactions/{id}` - Add user filter
- [ ] `PATCH /api/transactions/{id}` - Verify ownership before update
- [ ] `DELETE /api/transactions/{id}` - Verify ownership before delete
- [ ] `POST /api/transactions/bulk-update` - Add user filter
- [ ] `POST /api/rules/apply` - Only apply to current user's transactions

### Budget Endpoints
- [ ] `GET /api/budgets` - Add user filter
- [ ] `POST /api/budgets` - Set `user_id` on creation, check user on update
- [ ] `DELETE /api/budgets/{id}` - Verify ownership
- [ ] `POST /api/budgets/bulk-delete` - Add user filter

### Category Endpoints
- [ ] `GET /api/categories` - Add user filter
- [ ] `GET /api/categories/all` - Add user filter
- [ ] `POST /api/categories` - Set `user_id` on creation
- [ ] `PATCH /api/categories/{id}` - Verify ownership
- [ ] `DELETE /api/categories/{id}` - Verify ownership + check usage in user's data only

### Dashboard Endpoints
- [ ] `GET /api/dashboard/summary` - Add user filter to ALL queries
- [ ] `GET /api/dashboard/monthly-trend` - Add user filter
- [ ] `GET /api/years` - Add user filter
- [ ] `GET /api/export/excel` - Add user filter to ALL queries

### Upload Endpoint
- [ ] `POST /api/upload` - Pass `user_id` to pipeline, associate uploads with user

## Migration Steps for Production

### Step 1: Backup Current Data (CRITICAL!)

```bash
# On your Pi
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp
./scripts/pi/backup_lucid.sh
```

### Step 2: Stop Backend Service

```bash
sudo systemctl stop lucid-backend
```

### Step 3: Pull Latest Code

```bash
git pull
```

### Step 4: Run Migration

```bash
/home/luca/.local/bin/uv run python scripts/migrate_add_user_isolation.py
```

This will:
- Add `user_id` columns to all tables
- Assign ALL existing data to admin user (luca)
- Add foreign keys and indexes

### Step 5: Restart Backend

```bash
sudo systemctl start lucid-backend
```

### Step 6: Test

- Login as admin (luca) - should see all existing data
- Login as regular user (yanni) - should see NOTHING (clean slate)
- Create a transaction as yanni - should ONLY be visible to yanni
- Verify luca still sees all their data

## Expected Outcome

After fixes:
- ✅ Each user has their own isolated financial data
- ✅ Users cannot see or modify other users' data
- ✅ Admin user (luca) keeps all existing data
- ✅ New users start with empty data
- ✅ Categories are per-user (users can customize their own)

## Estimated Work

- **API Endpoint Updates**: ~20-30 endpoints need modifications
- **Testing**: Comprehensive multi-user testing required
- **Time**: 1-2 hours of careful work

## Current Status

- ✅ Database models updated
- ✅ Migration script created
- ⚠️  API endpoints - NOT YET FIXED
- ⚠️  Production migration - NOT YET RUN

**DO NOT DEPLOY TO PRODUCTION UNTIL API ENDPOINTS ARE FIXED!**

## Next Steps

The code changes are extensive. Options:

1. **Fix all endpoints now** (recommended for security)
2. **Fix critical read endpoints first** (partial fix, still risky)
3. **Disable new user creation temporarily** (until fixed)

**Recommendation**: Fix all endpoints before deploying. This is a critical privacy issue.
