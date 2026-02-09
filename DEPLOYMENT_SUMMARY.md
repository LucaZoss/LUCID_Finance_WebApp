# Deployment to Raspberry Pi - Quick Summary

Your LUCID Finance app is ready to deploy to production on your Raspberry Pi with domain `lucid-finance.cc`.

## 🚀 Quick Start

### 1. Update GitHub Repo URL (One-time setup)

```bash
nano deploy_to_pi.sh
# Update line 16 with your GitHub repo URL
```

### 2. Deploy with Database Migration

```bash
./deploy_to_pi.sh
```

The script will ask:
- **"Transfer database?"** → Answer `y` to migrate your data
- **"Transfer your local .env file?"** → Answer `y` to use your config

This will:
- Deploy your app to the Pi
- Transfer your local `.env` configuration
- Transfer your local database with all data
- Setup systemd services
- Configure nginx

**Important**: After deployment, review production settings:
```bash
ssh luca@lucid-pi.local 'nano ~/LUCID_Finance_WebApp/.env'
# Update passwords and JWT secret for production
```

See [docs/PRODUCTION_ENV.md](docs/PRODUCTION_ENV.md) for details.

### 3. Setup Cloudflare Tunnel

Follow the guide: [docs/CLOUDFLARE_TUNNEL.md](docs/CLOUDFLARE_TUNNEL.md)

Quick version:
```bash
ssh luca@lucid-pi.local

cloudflared tunnel login
cloudflared tunnel create lucid-finance
cloudflared tunnel route dns lucid-finance lucid-finance.cc
cloudflared tunnel route dns lucid-finance www.lucid-finance.cc

# Create config (see full guide for details)
nano ~/.cloudflared/config.yml

# Install as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### 4. Access Your App

**Worldwide:** `https://lucid-finance.cc`

---

## 📁 New Files Created

### Deployment Scripts

| File | Purpose |
|------|---------|
| `deploy_to_pi.sh` | Main deployment script - handles code deployment, dependency installation, and optional database migration |
| `scripts/backup_database.sh` | Create database backup (MySQL dump) |
| `scripts/restore_database.sh` | Restore database from backup |
| `scripts/transfer_database.sh` | Backup local DB and transfer to Pi |

### Documentation

| File | Purpose |
|------|---------|
| `docs/PRODUCTION_DEPLOYMENT.md` | **START HERE** - Complete production deployment guide with all steps |
| `docs/CLOUDFLARE_TUNNEL.md` | Detailed Cloudflare Tunnel setup for `lucid-finance.cc` |
| `docs/PRODUCTION_ENV.md` | Environment configuration (`.env` file) for production |
| `docs/DEPLOY_PI.md` | Detailed Raspberry Pi deployment reference |
| `DEPLOYMENT_SUMMARY.md` | This file - quick reference |

---

## 🎯 Deployment Checklist

### Pre-Deployment
- [ ] Update `deploy_to_pi.sh` with your GitHub repo URL
- [ ] Ensure local database has all your data
- [ ] Verify Pi is accessible at `luca@lucid-pi.local`
- [ ] Domain `lucid-finance.cc` is added to Cloudflare

### Deploy Application
- [ ] Run `./deploy_to_pi.sh`
- [ ] Choose to transfer `.env` file when prompted (recommended: yes)
- [ ] Choose to transfer database when prompted (recommended: yes)
- [ ] Verify deployment completed successfully
- [ ] Test local access: `http://lucid-pi.local`
- [ ] Review and update production settings in `.env` on Pi

### Setup Cloudflare Tunnel
- [ ] SSH to Pi and login to Cloudflare
- [ ] Create tunnel: `cloudflared tunnel create lucid-finance`
- [ ] Configure DNS routing
- [ ] Create `~/.cloudflared/config.yml`
- [ ] Test tunnel: `cloudflared tunnel run lucid-finance`
- [ ] Install as service
- [ ] Verify access: `https://lucid-finance.cc`

### Production Security
- [ ] Review `.env` file on Pi
- [ ] Change database passwords in `.env` (use strong passwords)
- [ ] Generate and set JWT secret key (add to `.env`)
- [ ] Update `backend/api/auth.py` to use JWT secret from `.env`
- [ ] Set proper permissions: `chmod 600 ~/.env`
- [ ] Configure Cloudflare SSL (Flexible or Full)
- [ ] Enable Cloudflare WAF
- [ ] Test login functionality
- [ ] Restart services after changes

See [docs/PRODUCTION_ENV.md](docs/PRODUCTION_ENV.md) for detailed security setup.

### Setup Backups
- [ ] Create backup script on Pi: `~/backup_lucid.sh`
- [ ] Add to crontab for daily backups
- [ ] Test backup: `./scripts/backup_database.sh`

### Testing
- [ ] Login works with your credentials
- [ ] All data is visible (transactions, budgets, categories)
- [ ] Can create/edit/delete items
- [ ] Dashboard displays correctly
- [ ] Budget Helper works
- [ ] File upload works
- [ ] HTTPS is active (green lock)

---

## 🔧 Common Commands

### Deployment & Updates
```bash
# Deploy app (with optional DB transfer)
./deploy_to_pi.sh

# Transfer database only
./scripts/transfer_database.sh

# Backup local database
./scripts/backup_database.sh
```

### Service Management
```bash
# Restart backend
ssh luca@lucid-pi.local 'sudo systemctl restart lucid-backend'

# Restart tunnel
ssh luca@lucid-pi.local 'sudo systemctl restart cloudflared'

# Restart everything
ssh luca@lucid-pi.local 'sudo systemctl restart lucid-backend cloudflared nginx && docker compose -f ~/LUCID_Finance_WebApp/docker-compose.yml restart'
```

### Monitoring
```bash
# View backend logs
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -f'

# View tunnel logs
ssh luca@lucid-pi.local 'sudo journalctl -u cloudflared -f'

# Check all services
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend cloudflared nginx'

# Monitor resources
ssh luca@lucid-pi.local 'htop'
```

### Database Operations
```bash
# Backup on Pi
ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && ./scripts/backup_database.sh'

# Access database
ssh luca@lucid-pi.local 'docker exec -it lucid_finance_db mysql -ulucid_user -p lucid_finance'

# Check database size
ssh luca@lucid-pi.local 'docker exec lucid_finance_db du -sh /var/lib/mysql'
```

---

## 📚 Detailed Documentation

For complete instructions, see:

1. **[docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md)** - Full production deployment guide (START HERE)
2. **[docs/CLOUDFLARE_TUNNEL.md](docs/CLOUDFLARE_TUNNEL.md)** - Cloudflare Tunnel setup
3. **[docs/DEPLOY_PI.md](docs/DEPLOY_PI.md)** - Raspberry Pi deployment reference

---

## 🆘 Troubleshooting

### Database not transferred?
```bash
# Check database on Pi
ssh luca@lucid-pi.local 'docker exec -it lucid_finance_db mysql -ulucid_user -p -e "USE lucid_finance; SELECT COUNT(*) FROM transactions;"'

# If empty, transfer again
./scripts/transfer_database.sh
```

### Can't access lucid-finance.cc?
```bash
# Check tunnel status
ssh luca@lucid-pi.local 'sudo systemctl status cloudflared'

# Check DNS
nslookup lucid-finance.cc

# Test local access first
ssh luca@lucid-pi.local 'curl http://localhost:80'
```

### Login not working?
```bash
# Restart backend
ssh luca@lucid-pi.local 'sudo systemctl restart lucid-backend'

# Check logs for errors
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -n 50'
```

---

## ✅ Success Indicators

You know everything is working when:
- ✅ `https://lucid-finance.cc` loads with HTTPS (green lock)
- ✅ You can login with your credentials
- ✅ All your transactions and budgets are visible
- ✅ Dashboard shows correct data
- ✅ Can upload new CSV files
- ✅ Budget Helper works
- ✅ Category management works

---

## 🎉 You're Live!

Once complete, your app is:
- 🌐 Accessible worldwide at `https://lucid-finance.cc`
- 🔒 Secured with HTTPS via Cloudflare
- 🛡️ Protected with authentication
- 💾 Backed up automatically
- 📊 Hosting all your financial data

**Enjoy your self-hosted finance app!**
