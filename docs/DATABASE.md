# LUCID Finance - Database Management

**MySQL 8.0 in Docker** | **Last Updated:** February 2026

Complete guide to database structure, management, and maintenance for LUCID Finance.

---

## Table of Contents

1. [Database Overview](#database-overview)
2. [Schema](#schema)
3. [Indexes & Performance](#indexes--performance)
4. [Migrations](#migrations)
5. [Backup & Restore](#backup--restore)
6. [Maintenance](#maintenance)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Database Overview

### Connection Details

| Parameter | Value |
|-----------|-------|
| **Host** | localhost (Docker container) |
| **Port** | 3306 |
| **Database** | lucid_finance |
| **User** | lucid_user |
| **Password** | lucid_pass_2025 (change in production!) |
| **Root Password** | lucid_root_pass (stored in .env) |
| **Character Set** | utf8mb4 |
| **Collation** | utf8mb4_unicode_ci |

### Container Information

```bash
# Container name
lucid_finance_db

# Image
mysql:8.0

# Volume
mysql_data (persistent storage)

# Config location
~/LUCID_Finance_WebApp/mysql-config/optimized.cnf
```

---

## Schema

### Entity Relationship Diagram

```
users (1) ──────┬─────── (N) transactions
                │
                ├─────── (N) budget_plans
                │
                ├─────── (N) categorization_rules
                │
                └─────── (N) processed_files

categories (standalone)
```

### Tables

#### 1. users

**Purpose:** User authentication and authorization

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_username (username),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Fields:**
- `username` - Unique login identifier
- `hashed_password` - bcrypt hashed password (rounds=12)
- `is_active` - Account enabled/disabled
- `is_admin` - Admin privileges flag

**Typical Data:**
```sql
INSERT INTO users (username, full_name, hashed_password, is_admin)
VALUES ('admin', 'Administrator', '$2b$12$...', TRUE);
```

---

#### 2. transactions

**Purpose:** Financial transactions from bank CSV imports

```sql
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    description VARCHAR(500),
    type VARCHAR(50) NOT NULL,           -- Income, Expenses, Savings
    category VARCHAR(100) NOT NULL,       -- Housing, Groceries, etc.
    sub_type VARCHAR(50) NULL,            -- Essentials, Needs, Wants
    amount DECIMAL(10, 2) NOT NULL,
    source VARCHAR(50),                   -- UBS, CreditCard
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_user_date (user_id, date),
    INDEX idx_user_year_month (user_id, year, month),
    INDEX idx_type (type),
    INDEX idx_category (category),
    INDEX idx_sub_type (sub_type),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Fields:**
- `date` - Transaction date (from bank statement)
- `year`, `month` - Extracted for efficient querying
- `type` - Income | Expenses | Savings
- `category` - Specific category (Housing, Groceries, etc.)
- `sub_type` - Budget classification (Essentials, Needs, Wants)
- `amount` - Transaction amount (positive for all types)
- `source` - Origin (UBS, CreditCard)

**Auto-categorization:**
- Housing & Health Insurance → `sub_type = 'Essentials'`

**Typical Data:**
```sql
INSERT INTO transactions (user_id, date, year, month, description, type, category, sub_type, amount, source)
VALUES (1, '2026-01-15', 2026, 1, 'Migros - Grocery shopping', 'Expenses', 'Groceries', 'Needs', 120.50, 'UBS');
```

---

#### 3. budget_plans

**Purpose:** User-defined budgets (yearly and monthly)

```sql
CREATE TABLE budget_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,           -- Income, Expenses, Savings
    category VARCHAR(100) NOT NULL,       -- Housing, Groceries, etc.
    sub_type VARCHAR(50) NULL,            -- Essentials, Needs, Wants
    year INT NOT NULL,
    month INT NULL,                       -- NULL = yearly budget, 1-12 = monthly
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    UNIQUE KEY unique_budget (user_id, type, category, year, month),
    INDEX idx_user_year (user_id, year),
    INDEX idx_user_year_month (user_id, year, month),
    INDEX idx_sub_type (sub_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Fields:**
- `month` - NULL for yearly budgets, 1-12 for monthly budgets
- `amount` - Budget amount (yearly: full year, monthly: that month only)

**Auto-populate Logic:**
- **Yearly budget created** → Auto-creates 12 monthly budgets (amount ÷ 12)
- **Monthly budget created** → If all 12 months exist, creates/updates yearly total

**Typical Data:**
```sql
-- Yearly budget
INSERT INTO budget_plans (user_id, type, category, sub_type, year, month, amount)
VALUES (1, 'Expenses', 'Housing', 'Essentials', 2026, NULL, 24000);

-- Monthly budget (auto-created from yearly: 24000 ÷ 12 = 2000)
INSERT INTO budget_plans (user_id, type, category, sub_type, year, month, amount)
VALUES (1, 'Expenses', 'Housing', 'Essentials', 2026, 1, 2000);
```

---

#### 4. categories

**Purpose:** Predefined and custom categories for transactions

```sql
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,   -- Category name (e.g., "Housing")
    type VARCHAR(50) NOT NULL,            -- Income, Expenses, Savings
    is_active BOOLEAN DEFAULT TRUE,       -- Active/archived
    display_order INT DEFAULT 0,          -- UI display order
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_type_active (type, is_active),
    INDEX idx_type_order (type, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Fields:**
- `name` - Unique category name
- `type` - Income, Expenses, or Savings
- `is_active` - Soft delete (archived categories not shown in UI)
- `display_order` - Sort order in dropdowns

**Default Categories:**
```sql
-- Income
INSERT INTO categories (name, type, display_order) VALUES
('Employment', 'Income', 1),
('Freelance', 'Income', 2),
('Investments', 'Income', 3);

-- Expenses
INSERT INTO categories (name, type, display_order) VALUES
('Housing', 'Expenses', 1),
('Health Insurance', 'Expenses', 2),
('Groceries', 'Expenses', 3),
('Dining Out', 'Expenses', 4),
('Transport', 'Expenses', 5),
('Entertainment', 'Expenses', 6);

-- Savings
INSERT INTO categories (name, type, display_order) VALUES
('Retirement', 'Savings', 1),
('Emergency Fund', 'Savings', 2),
('Vacation', 'Savings', 3);
```

---

#### 5. categorization_rules

**Purpose:** Automated transaction categorization rules

```sql
CREATE TABLE categorization_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,                    -- NULL = global rule, otherwise user-specific
    pattern VARCHAR(255) NOT NULL,       -- Regex pattern to match description
    case_sensitive BOOLEAN DEFAULT FALSE,
    amount_operator VARCHAR(10) NULL,    -- =, >, <, >=, <=
    amount_value DECIMAL(10, 2) NULL,
    type VARCHAR(50) NOT NULL,           -- Resulting type
    category VARCHAR(100) NOT NULL,       -- Resulting category
    priority INT DEFAULT 0,               -- Lower number = higher priority
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_active_priority (is_active, priority),
    INDEX idx_user_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Fields:**
- `pattern` - Regex pattern matched against transaction description
- `priority` - Rules with priority 0 apply first, then 1, 2, etc.
- `case_sensitive` - Whether pattern matching is case-sensitive
- `amount_operator` - Optional amount condition (>, <, =, >=, <=)
- `user_id` - NULL for global rules, user ID for per-user overrides

**Example Rules:**
```sql
-- Global rule: All Migros transactions are Groceries
INSERT INTO categorization_rules (user_id, pattern, type, category, priority)
VALUES (NULL, 'Migros', 'Expenses', 'Groceries', 0);

-- User-specific rule: Salary from employer
INSERT INTO categorization_rules (user_id, pattern, type, category, priority)
VALUES (1, 'ACME Corp Salary', 'Income', 'Employment', 0);

-- Amount-based rule: Large transfers are savings
INSERT INTO categorization_rules (user_id, pattern, amount_operator, amount_value, type, category, priority)
VALUES (1, 'Transfer to savings', '>=', 1000.00, 'Savings', 'Emergency Fund', 1);
```

**Rule Application:**
1. Sort by `priority` ASC (0 first)
2. For each rule, check pattern match (case-sensitive if specified)
3. If pattern matches AND amount condition (if any) matches:
   - Set transaction type and category
   - Stop (don't apply further rules)

---

#### 6. processed_files

**Purpose:** Track imported CSV files to prevent duplicates

```sql
CREATE TABLE processed_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 hash of file content
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_file_hash (file_hash),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Fields:**
- `file_hash` - SHA-256 hash of CSV file content
- `filename` - Original filename (for reference)

**Deduplication Logic:**
1. Upload CSV file
2. Calculate SHA-256 hash
3. Check if `file_hash` exists in table
4. If exists → Skip (return "already processed")
5. If new → Process transactions + insert hash

---

## Indexes & Performance

### Index Strategy

All tables use appropriate indexes for:
- **Primary Keys:** Auto-indexed
- **Foreign Keys:** Indexed for JOIN performance
- **Frequently Queried Columns:**
  - `transactions.user_id`, `date`, `year`, `month`
  - `budget_plans.user_id`, `year`, `month`
  - `categorization_rules.priority`, `is_active`

### Query Performance

**Typical Query Times (on Raspberry Pi 4):**
- Dashboard summary (year): 50-150ms
- Transaction list (1000 records): 30-80ms
- Budget list (full year): 20-50ms
- Rule application (500 transactions): 200-500ms

### Optimization Settings

**File:** `mysql-config/optimized.cnf`

```ini
[mysqld]
# SD Card Optimizations
skip-log-bin
innodb_flush_log_at_trx_commit = 2
innodb_buffer_pool_size = 256M
innodb_io_capacity = 200
innodb_io_capacity_max = 400
performance_schema = OFF
```

See [RASPBERRY_PI_SETUP.md](RASPBERRY_PI_SETUP.md) for full configuration.

---

## Migrations

### Migration History

| Version | Date | Description | Script |
|---------|------|-------------|--------|
| 1.0 | 2025-12 | Initial schema | `database_manager.py::create_all_tables()` |
| 1.1 | 2026-01 | Add `sub_type` field | `migrate_add_subtype.py` |

### Running Migrations

#### Add `sub_type` Column (v1.1)

```bash
# SSH to Pi
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp

# Run migration
.venv/bin/python backend/migrate_add_subtype.py

# Expected output:
# ✓ Added sub_type column to budget_plans
# ✓ Added sub_type column to transactions
# ✓ Created indexes
# ✓ Migration completed successfully

# Restart backend
sudo systemctl restart lucid-backend
```

**What This Migration Does:**
1. Adds `sub_type VARCHAR(50) NULL` to `budget_plans`
2. Adds `sub_type VARCHAR(50) NULL` to `transactions`
3. Creates indexes: `idx_budget_sub_type`, `idx_transaction_sub_type`

### Creating New Migrations

**Template:**

```python
# backend/migrate_<description>.py
from backend.data_pipeline.database_manager import DatabaseManager
from sqlalchemy import text

def run_migration():
    db = DatabaseManager()
    conn = db.engine.connect()

    try:
        # Execute SQL
        conn.execute(text("""
            ALTER TABLE <table>
            ADD COLUMN <column> <type>
        """))

        conn.commit()
        print("✓ Migration completed")

    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        raise

    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
```

**Best Practices:**
- Use `ALTER TABLE` for non-destructive changes
- Always test on development copy first
- Backup database before migration
- Make migrations reversible if possible
- Use transactions (rollback on error)

---

## Backup & Restore

### Automated Backups

**Configured via cron:**
```bash
# Daily at 2 AM
0 2 * * * /home/luca/backup_lucid.sh >> /home/luca/backup.log 2>&1
```

**Backup Script:** `~/backup_lucid.sh`

**Features:**
- Compressed SQL dumps (`.sql.gz`)
- Automatic rotation (keeps 14 days)
- Backup verification
- Email notifications (optional)

### Manual Backup

```bash
# Quick backup
ssh luca@lucid-pi.local "~/backup_lucid.sh"

# Or manual
docker exec lucid_finance_db mysqldump \
  -ulucid_user -plucid_pass_2025 \
  --single-transaction \
  --quick \
  --lock-tables=false \
  lucid_finance | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore from Backup

```bash
# List available backups
ssh luca@lucid-pi.local "ls -lh ~/backups/"

# Restore specific backup
gunzip -c ~/backups/lucid_backup_20260215_020001.sql.gz | \
docker exec -i lucid_finance_db mysql \
  -ulucid_user -plucid_pass_2025 \
  lucid_finance
```

### Backup Best Practices

1. **Automated Daily Backups:** Already configured
2. **Weekly Off-site Backups:** Copy to USB drive or cloud
3. **Test Restores:** Verify backups work monthly
4. **Before Major Changes:** Always backup first
5. **Retention Policy:** Keep 14 days locally, 6 months off-site

---

## Maintenance

### Weekly Tasks

**Optimize Tables** (automated via cron)

```bash
# Create maintenance script
cat > ~/maintenance_lucid.sh << 'EOF'
#!/bin/bash
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance -e "
    OPTIMIZE TABLE transactions;
    OPTIMIZE TABLE budget_plans;
    OPTIMIZE TABLE categorization_rules;
    OPTIMIZE TABLE users;
    OPTIMIZE TABLE categories;
    OPTIMIZE TABLE processed_files;
"
EOF

chmod +x ~/maintenance_lucid.sh

# Schedule (first Sunday of month at 4 AM)
# crontab -e
# 0 4 1-7 * 0 /home/luca/maintenance_lucid.sh >> /home/luca/maintenance.log 2>&1
```

### Monthly Tasks

1. **Check Database Size**
   ```sql
   SELECT
       table_name AS 'Table',
       ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
       table_rows AS 'Rows'
   FROM information_schema.TABLES
   WHERE table_schema = 'lucid_finance'
   ORDER BY (data_length + index_length) DESC;
   ```

2. **Analyze Slow Queries** (if enabled)
   ```bash
   docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 \
     -e "SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;"
   ```

3. **Check for Orphaned Records** (shouldn't happen due to CASCADE)
   ```sql
   -- Transactions without users (should be empty)
   SELECT COUNT(*) FROM transactions t
   LEFT JOIN users u ON t.user_id = u.id
   WHERE u.id IS NULL;
   ```

### Quarterly Tasks

1. **Archive Old Transactions** (if needed)
   ```sql
   -- Export old transactions (older than 3 years)
   SELECT * FROM transactions
   WHERE year < YEAR(CURDATE()) - 3
   INTO OUTFILE '/tmp/archive_transactions.csv'
   FIELDS TERMINATED BY ',' ENCLOSED BY '"'
   LINES TERMINATED BY '\n';

   -- Delete after verifying export
   -- DELETE FROM transactions WHERE year < YEAR(CURDATE()) - 3;
   ```

2. **Review and Clean Rules**
   ```sql
   -- Find unused rules (no matches in last 90 days)
   SELECT r.id, r.pattern, r.category,
          COUNT(t.id) as recent_matches
   FROM categorization_rules r
   LEFT JOIN transactions t ON t.description LIKE CONCAT('%', r.pattern, '%')
       AND t.created_at > DATE_SUB(NOW(), INTERVAL 90 DAY)
   WHERE r.is_active = TRUE
   GROUP BY r.id
   HAVING recent_matches = 0;
   ```

---

## Monitoring

### Database Health Checks

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Check MySQL is running
docker ps | grep lucid_finance_db

# Database size
docker exec lucid_finance_db du -sh /var/lib/mysql

# Connection count
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 \
  -e "SHOW STATUS LIKE 'Threads_connected';"

# Table row counts
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance -e "
    SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
    UNION ALL
    SELECT 'transactions', COUNT(*) FROM transactions
    UNION ALL
    SELECT 'budget_plans', COUNT(*) FROM budget_plans
    UNION ALL
    SELECT 'categories', COUNT(*) FROM categories
    UNION ALL
    SELECT 'categorization_rules', COUNT(*) FROM categorization_rules
    UNION ALL
    SELECT 'processed_files', COUNT(*) FROM processed_files;
"
```

### Performance Monitoring

```sql
-- Currently running queries
SHOW FULL PROCESSLIST;

-- InnoDB status
SHOW ENGINE INNODB STATUS;

-- Buffer pool usage
SHOW STATUS LIKE 'Innodb_buffer_pool%';
```

---

## Troubleshooting

### MySQL Won't Start

```bash
# Check Docker container logs
docker logs lucid_finance_db

# Common issues:
# 1. Port 3306 already in use
sudo lsof -i :3306

# 2. Volume corruption
docker compose down
docker volume ls
docker volume rm lucid_finance_webapp_mysql_data  # ⚠️ DELETES DATA
docker compose up -d

# 3. Config file syntax error
docker exec lucid_finance_db cat /etc/mysql/conf.d/optimized.cnf
```

### Connection Refused

```bash
# Test MySQL connectivity
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 -e "SELECT 1;"

# Check if port is exposed
docker port lucid_finance_db

# Test from backend
cd ~/LUCID_Finance_WebApp
.venv/bin/python -c "
from backend.data_pipeline.database_manager import DatabaseManager
db = DatabaseManager()
conn = db.engine.connect()
result = conn.execute('SELECT 1')
print('✓ Connection OK')
conn.close()
"
```

### Slow Queries

```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- View slow queries
SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;
```

### Disk Space Full

```bash
# Check MySQL data size
docker exec lucid_finance_db du -sh /var/lib/mysql

# Optimize tables to reclaim space
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance -e "
    OPTIMIZE TABLE transactions;
"

# Purge old binary logs (if binary logging is enabled)
docker exec lucid_finance_db mysql -uroot -plucid_root_pass -e "
    PURGE BINARY LOGS BEFORE NOW();
"
```

---

## Quick Reference

```bash
# Access MySQL console
docker exec -it lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance

# Backup database
~/backup_lucid.sh

# Restore database
gunzip -c ~/backups/backup.sql.gz | docker exec -i lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance

# Check database size
docker exec lucid_finance_db du -sh /var/lib/mysql

# Optimize tables
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance -e "OPTIMIZE TABLE transactions;"

# View logs
docker logs -f lucid_finance_db
```

---

**Next Steps:** See [QUICK_START_TECHNICAL.md](QUICK_START_TECHNICAL.md) for deployment procedures.
