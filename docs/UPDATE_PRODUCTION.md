# Updating Production Server

This guide explains how to update your Raspberry Pi server when you push new code to the main branch.

## Quick Update Process

When you've made changes and pushed to GitHub:

```bash
# From your Mac, in the project directory
./deploy_to_pi.sh
```

When prompted:
- **"Transfer database?"** → Answer `n` (unless you added new data locally)
- **"Transfer your local .env file?"** → Answer `n` (keep production config)

The script will:
1. Pull latest code from GitHub
2. Install any new backend dependencies
3. Rebuild the frontend
4. Restart the backend service
5. Your app is updated!

## Detailed Update Steps

### 1. Push Your Changes to GitHub

```bash
# On your Mac
git add .
git commit -m "Description of your changes"
git push origin main
```

### 2. Deploy to Production

```bash
./deploy_to_pi.sh
```

### 3. Verify the Update

Check that everything is working:

```bash
# Check backend service
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend'

# View recent logs
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -n 50'

# Test the API
curl https://lucid-finance.cc/api/health
```

Visit `https://lucid-finance.cc` and test your changes.

## When to Transfer Database

Only answer **yes** to database transfer if:
- You added sample data locally that you want in production
- You made schema changes and have migration data
- You're fixing corrupted production data

**Otherwise, always answer `n`** to preserve your production data!

## Update-Specific Scenarios

### Frontend-Only Changes

If you only changed frontend code (React/TypeScript):

```bash
./deploy_to_pi.sh
# Answer 'n' to both prompts
```

The script will rebuild the frontend automatically.

### Backend-Only Changes

If you only changed backend code (Python/FastAPI):

```bash
./deploy_to_pi.sh
# Answer 'n' to both prompts
```

The script will restart the backend service automatically.

### Database Schema Changes

If you modified database models:

```bash
# SSH to Pi
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# Create backup first!
./scripts/backup_database.sh ~/backups/pre_update_$(date +%Y%m%d).sql

# Run your migration script
/home/luca/.local/bin/uv run python scripts/your_migration_script.py

# Test that everything works
curl http://localhost:8000/api/health
```

Then deploy your code:

```bash
# From your Mac
./deploy_to_pi.sh
# Answer 'n' to database transfer
```

### Dependency Changes

If you added new Python packages or npm packages:

The deployment script automatically handles this:
- Backend: `uv sync` installs new Python dependencies
- Frontend: `npm install` installs new JavaScript packages

Just run:

```bash
./deploy_to_pi.sh
```

## Rollback Process

If an update breaks something:

### 1. Rollback Code

```bash
# SSH to Pi
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# Check commit history
git log --oneline -5

# Rollback to previous commit (replace COMMIT_HASH)
git reset --hard COMMIT_HASH

# Restart services
sudo systemctl restart lucid-backend
```

### 2. Rollback Database (if needed)

```bash
# SSH to Pi
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# List available backups
ls -lh ~/backups/

# Restore from backup
./scripts/restore_database.sh ~/backups/your_backup.sql
```

## Monitoring After Update

Watch logs for errors:

```bash
# Backend logs (real-time)
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -f'

# Cloudflare tunnel logs (real-time)
ssh luca@lucid-pi.local 'sudo journalctl -u cloudflared -f'

# nginx error logs
ssh luca@lucid-pi.local 'sudo tail -f /var/log/nginx/error.log'
```

## Best Practices

1. **Always test locally first** before pushing to production
2. **Create a backup** before major updates:
   ```bash
   ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && ./scripts/backup_database.sh ~/backups/manual_$(date +%Y%m%d).sql'
   ```
3. **Deploy during low-traffic times** (if others are using it)
4. **Check logs immediately** after deployment
5. **Keep your local and production .env files separate**

## Common Issues

### Issue: "Permission denied" when pulling from Git

**Fix**: Your SSH keys may have expired on the Pi. Re-authenticate:

```bash
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp
git pull  # This will prompt for credentials if needed
```

### Issue: Backend won't restart

**Fix**: Check the logs for the specific error:

```bash
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -n 100'
```

Common causes:
- Syntax error in Python code
- Missing environment variable
- Database connection issue

### Issue: Frontend changes not visible

**Fix**: Clear your browser cache or hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

If still not working, check if frontend was built:

```bash
ssh luca@lucid-pi.local 'ls -lh ~/LUCID_Finance_WebApp/frontend/dist/'
```

## Quick Reference Commands

```bash
# Full deployment
./deploy_to_pi.sh

# Manual restart backend only
ssh luca@lucid-pi.local 'sudo systemctl restart lucid-backend'

# Manual restart all services
ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && docker compose restart && sudo systemctl restart lucid-backend cloudflared nginx'

# View all service statuses
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend cloudflared nginx'

# Create backup
ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && ./scripts/backup_database.sh ~/backups/manual_$(date +%Y%m%d).sql'
```

---

**Remember**: Your app is live in production. Always test changes locally before deploying!
