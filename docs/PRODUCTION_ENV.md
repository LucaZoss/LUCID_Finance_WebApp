# Production Environment Configuration

This guide covers the `.env` file configuration for your Raspberry Pi production environment.

## Overview

The `.env` file contains sensitive configuration like database passwords and secrets. It's **NOT** in git for security reasons, so you need to transfer or configure it on your Pi.

## Deployment Options

### Option 1: Transfer Local .env (Recommended)

The deployment script will ask if you want to transfer your local `.env` file:

```bash
./deploy_to_pi.sh
# When prompted: "Transfer your local .env file to Pi? (y/n):" answer y
```

This transfers your working local configuration to the Pi.

**After transfer, you should:**
1. Update production-specific values (see below)
2. Use stronger passwords
3. Change the JWT secret

### Option 2: Manual Configuration

If you don't transfer the .env file, create it on the Pi:

```bash
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp
cp .env.example .env
nano .env
```

## Production Environment Variables

Here's what needs to be in your `.env` file:

### Database Configuration

```bash
# Database Host (localhost for local MySQL)
DB_HOST=localhost

# Database Port (default MySQL port)
DB_PORT=3306

# Database Name
DB_NAME=lucid_finance

# Database User
DB_USER=lucid_user

# ⚠️ CHANGE THIS: Use a strong password for production
DB_PASSWORD=your_strong_production_password_here

# ⚠️ CHANGE THIS: Root password for MySQL
DB_ROOT_PASSWORD=your_strong_root_password_here
```

### API Configuration (Optional)

```bash
# API Host (0.0.0.0 to accept connections from all interfaces)
API_HOST=0.0.0.0

# API Port (default: 8000)
API_PORT=8000
```

### JWT Secret (Recommended)

While not currently in `.env`, you should add this:

```bash
# ⚠️ IMPORTANT: Generate a secure JWT secret
# Generate with: openssl rand -hex 32
JWT_SECRET_KEY=your_generated_secret_key_here
```

Then update `backend/api/auth.py` to use it:

```python
import os
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key")
```

## Security Checklist

### Before Production

- [ ] Change `DB_PASSWORD` to a strong, unique password
- [ ] Change `DB_ROOT_PASSWORD` to a strong, unique password
- [ ] Generate and set a JWT secret key
- [ ] Review all values in `.env`
- [ ] Ensure `.env` has proper permissions on Pi

### Generate Strong Passwords

On your Pi:

```bash
# Generate strong password (32 characters)
openssl rand -base64 32

# Generate JWT secret (64 hex characters)
openssl rand -hex 32
```

### Set Proper Permissions

On your Pi:

```bash
# Set restrictive permissions on .env file
chmod 600 ~/LUCID_Finance_WebApp/.env

# Verify
ls -la ~/LUCID_Finance_WebApp/.env
# Should show: -rw------- (only owner can read/write)
```

## Updating Production Configuration

### Change Database Password

If you change the database password in `.env`, you must also update it in MySQL:

```bash
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# Update .env file
nano .env
# Change DB_PASSWORD=new_password

# Restart MySQL with new password
docker compose down
docker compose up -d

# Wait for MySQL to start
sleep 5

# Connect and verify
docker exec -it lucid_finance_db mysql -ulucid_user -p
# Enter new password
```

### Update JWT Secret

```bash
ssh luca@lucid-pi.local

# Generate new secret
openssl rand -hex 32

# Add to .env
nano ~/LUCID_Finance_WebApp/.env
# Add: JWT_SECRET_KEY=<generated-secret>

# Update backend code to use it
nano ~/LUCID_Finance_WebApp/backend/api/auth.py
# Update SECRET_KEY line

# Restart backend
sudo systemctl restart lucid-backend
```

**Note**: Changing JWT secret will invalidate all existing user sessions. Users will need to login again.

## Production vs Development

### Development (.env)
```bash
DB_PASSWORD=lucid_pass_2025          # Simple password
DB_ROOT_PASSWORD=lucid_root_2025     # Simple password
API_HOST=localhost                   # Local only
```

### Production (.env)
```bash
DB_PASSWORD=K7mP9nQ2rX5tY8wZ...      # Strong password (24+ chars)
DB_ROOT_PASSWORD=A3fH6kL9pS2v...     # Strong password (24+ chars)
API_HOST=0.0.0.0                     # All interfaces
JWT_SECRET_KEY=a1b2c3d4e5f6...       # 64 character hex
```

## Verifying Configuration

### Check .env File Exists

```bash
ssh luca@lucid-pi.local 'ls -la ~/LUCID_Finance_WebApp/.env'
```

Should show the file with restricted permissions.

### Test Database Connection

```bash
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# Load .env
export $(cat .env | grep -v '^#' | xargs)

# Test connection
docker exec lucid_finance_db mysql -u${DB_USER} -p${DB_PASSWORD} -e "SELECT 1;"
```

Should return `1` if connection works.

### Test Backend with New Config

```bash
# Restart backend to apply changes
ssh luca@lucid-pi.local 'sudo systemctl restart lucid-backend'

# Check logs for errors
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -n 50'

# Test API
curl https://lucid-finance.cc/api/health
```

## Troubleshooting

### "Access denied" Database Error

Your database password in `.env` doesn't match MySQL:

```bash
# Option 1: Fix password in .env to match current MySQL
ssh luca@lucid-pi.local 'nano ~/LUCID_Finance_WebApp/.env'

# Option 2: Recreate database with new password
ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && docker compose down -v && docker compose up -d'
# Then restore your data
```

### Backend Won't Start After .env Change

```bash
# Check for syntax errors in .env
ssh luca@lucid-pi.local 'cat ~/LUCID_Finance_WebApp/.env'

# Check backend logs
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -n 100'

# Test .env loading
ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && export $(cat .env | grep -v "^#" | xargs) && echo "DB_HOST=$DB_HOST DB_USER=$DB_USER"'
```

### JWT Errors After Secret Change

If you changed JWT secret, all existing sessions are invalid:
- Users must logout and login again
- Clear browser cookies
- This is normal and expected behavior

## Best Practices

1. **Never commit .env to git** - Already in `.gitignore`
2. **Use strong passwords** - 24+ characters, mix of types
3. **Rotate secrets periodically** - Change every 6-12 months
4. **Backup .env securely** - Store encrypted backup offline
5. **Limit .env access** - Only you and the application should read it
6. **Use environment-specific configs** - Development vs Production

## Quick Reference

```bash
# Transfer .env during deployment
./deploy_to_pi.sh
# Answer 'y' when asked about .env transfer

# Manually edit .env on Pi
ssh luca@lucid-pi.local 'nano ~/LUCID_Finance_WebApp/.env'

# Generate strong password
openssl rand -base64 32

# Generate JWT secret
openssl rand -hex 32

# Set proper permissions
ssh luca@lucid-pi.local 'chmod 600 ~/LUCID_Finance_WebApp/.env'

# Restart services after .env change
ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && docker compose restart && sudo systemctl restart lucid-backend'

# View .env (be careful!)
ssh luca@lucid-pi.local 'cat ~/LUCID_Finance_WebApp/.env'
```

---

**Security Reminder**: The `.env` file contains sensitive credentials. Protect it like you would protect your passwords!
