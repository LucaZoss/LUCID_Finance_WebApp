# Raspberry Pi Restart Guide

This guide explains what happens when your Raspberry Pi is turned off and how to bring your app back online.

## What Happens When Pi Turns Off?

Your LUCID Finance app will become **temporarily unavailable** at `https://lucid-finance.cc`.

### Services That Stop

1. **MySQL Database** (Docker container)
2. **Backend API** (Python/FastAPI)
3. **nginx** (Web server)
4. **Cloudflare Tunnel** (Internet access)

### What's NOT Lost

✅ All your data is safe (stored on Pi's storage)
✅ All configuration is preserved
✅ All code remains intact

## Auto-Recovery (It Should Work Automatically!)

Your Pi is configured to automatically restart all services on boot:

### Services Set to Auto-Start:

1. ✅ **Docker** → Starts MySQL container automatically
2. ✅ **lucid-backend** → Backend API auto-starts after MySQL
3. ✅ **nginx** → Web server auto-starts
4. ✅ **cloudflared** → Cloudflare tunnel auto-starts

### Expected Startup Time:

- **Boot**: ~30-60 seconds
- **Docker/MySQL**: ~5-10 seconds
- **Backend API**: ~10-15 seconds (waits for MySQL)
- **Total**: ~1-2 minutes until `https://lucid-finance.cc` is accessible

## Manual Restart (If Auto-Start Fails)

If your app doesn't come back after 2-3 minutes:

### 1. Check All Services

```bash
# SSH to your Pi
ssh luca@lucid-pi.local

# Check all service statuses
sudo systemctl status lucid-backend
sudo systemctl status cloudflared
sudo systemctl status nginx
docker ps
```

### 2. Start Services Manually

```bash
# Start MySQL (Docker)
cd ~/LUCID_Finance_WebApp
docker compose up -d

# Wait for MySQL to be ready
sleep 10

# Start backend
sudo systemctl start lucid-backend

# Start nginx
sudo systemctl start nginx

# Start Cloudflare tunnel
sudo systemctl start cloudflared
```

### 3. Verify Everything is Running

```bash
# Check service statuses (should all be "active (running)")
sudo systemctl status lucid-backend cloudflared nginx

# Check Docker
docker ps | grep mysql

# Test locally
curl http://localhost:80
curl http://localhost:8000/api/health
```

### 4. Test Remote Access

Open `https://lucid-finance.cc` in your browser. It should work!

## Power Outage / Unexpected Shutdown

If your Pi loses power unexpectedly:

### 1. Verify Pi is Back Online

```bash
# From your Mac
ping lucid-pi.local

# If ping works, SSH in
ssh luca@lucid-pi.local
```

### 2. Check for Database Corruption

MySQL should recover automatically, but verify:

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Check MySQL container logs
docker logs lucid_finance_db | tail -50

# Test database connection
docker exec lucid_finance_db mysql -ulucid_user -p -e "SELECT 1;"
# Enter password when prompted
```

If you see errors, restore from backup:

```bash
cd ~/LUCID_Finance_WebApp

# List available backups
ls -lh ~/backups/

# Restore latest backup
./scripts/restore_database.sh ~/backups/your_latest_backup.sql
```

### 3. Check File System

After power loss, check for filesystem issues:

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Check disk usage
df -h

# Check for errors
dmesg | grep -i error
```

## Planned Shutdown

If you need to shut down your Pi cleanly:

### 1. Notify Users (If Applicable)

If others are using your app, let them know about the downtime.

### 2. Create a Backup

```bash
# SSH to Pi
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# Create backup
./scripts/backup_database.sh ~/backups/pre_shutdown_$(date +%Y%m%d).sql
```

### 3. Graceful Shutdown

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Shutdown gracefully (waits for services to stop cleanly)
sudo shutdown -h now
```

This ensures:
- All database writes complete
- Logs are flushed
- No file corruption

## Startup Checklist

After restarting your Pi, verify everything:

- [ ] Pi responds to `ping lucid-pi.local`
- [ ] Can SSH: `ssh luca@lucid-pi.local`
- [ ] MySQL running: `docker ps | grep mysql`
- [ ] Backend running: `sudo systemctl status lucid-backend`
- [ ] nginx running: `sudo systemctl status nginx`
- [ ] Tunnel running: `sudo systemctl status cloudflared`
- [ ] Local access works: `curl http://localhost:80`
- [ ] Remote access works: Visit `https://lucid-finance.cc`
- [ ] Can login to app
- [ ] Data is visible

## Troubleshooting

### Issue: Can't SSH to Pi

**Possible causes:**
1. Pi is still booting (wait 1-2 minutes)
2. Network issue (check if Pi's LED lights are on)
3. IP address changed (unlikely with `.local` hostname)

**Fix:**
```bash
# Find Pi's IP address from your router's admin page
# Or if you have access to Pi directly:
# Look at the Pi's screen if you have monitor connected
# Or check your router's DHCP client list
```

### Issue: MySQL Won't Start

**Fix:**
```bash
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# Check Docker logs
docker logs lucid_finance_db

# Restart Docker
docker compose down
docker compose up -d

# If still fails, restore from backup
./scripts/restore_database.sh ~/backups/your_backup.sql
```

### Issue: Backend Shows "Connection Refused" to MySQL

**Cause:** Backend started before MySQL was ready

**Fix:**
```bash
ssh luca@lucid-pi.local

# Wait for MySQL (it takes 5-10 seconds to start)
sleep 10

# Restart backend
sudo systemctl restart lucid-backend

# Check logs
sudo journalctl -u lucid-backend -n 50
```

### Issue: Site Not Accessible via lucid-finance.cc

**Possible causes:**
1. Cloudflare tunnel not running
2. DNS propagation delay (rare)

**Fix:**
```bash
ssh luca@lucid-pi.local

# Check tunnel status
sudo systemctl status cloudflared

# Restart tunnel if needed
sudo systemctl restart cloudflared

# Check tunnel logs
sudo journalctl -u cloudflared -n 50
```

### Issue: "502 Bad Gateway" Error

**Cause:** nginx is running but backend is not responding

**Fix:**
```bash
ssh luca@lucid-pi.local

# Check backend
sudo systemctl status lucid-backend

# Restart backend
sudo systemctl restart lucid-backend

# Check logs for errors
sudo journalctl -u lucid-backend -n 100
```

## Monitoring & Logs

### Check Service Logs

```bash
# Backend logs (last 50 lines)
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -n 50'

# Backend logs (real-time)
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -f'

# Cloudflare tunnel logs
ssh luca@lucid-pi.local 'sudo journalctl -u cloudflared -n 50'

# nginx error logs
ssh luca@lucid-pi.local 'sudo tail -50 /var/log/nginx/error.log'

# MySQL logs
ssh luca@lucid-pi.local 'docker logs lucid_finance_db | tail -50'
```

### Check System Resources

```bash
ssh luca@lucid-pi.local

# CPU and memory usage
htop

# Disk usage
df -h

# Disk I/O
iostat -x 1 5
```

## Quick Reference Commands

```bash
# Check if Pi is online
ping lucid-pi.local

# SSH to Pi
ssh luca@lucid-pi.local

# Check all services
sudo systemctl status lucid-backend cloudflared nginx
docker ps

# Restart all services
cd ~/LUCID_Finance_WebApp
docker compose restart
sudo systemctl restart lucid-backend cloudflared nginx

# View logs
sudo journalctl -u lucid-backend -f

# Create backup
cd ~/LUCID_Finance_WebApp
./scripts/backup_database.sh ~/backups/emergency_$(date +%Y%m%d_%H%M%S).sql

# Graceful shutdown
sudo shutdown -h now

# Reboot Pi
sudo reboot
```

## Prevention Tips

1. **Use a UPS** (Uninterruptible Power Supply) to prevent unexpected shutdowns
2. **Set up automatic backups** (cron job runs daily at 2 AM)
3. **Monitor remotely** - Set up monitoring service (optional)
4. **Enable LED indicators** on Pi to see its status at a glance

## Recovery Time Expectations

| Scenario | Expected Downtime |
|----------|-------------------|
| Normal reboot | 1-2 minutes |
| Power outage (clean restart) | 1-2 minutes |
| Power outage (requires manual restart) | 3-5 minutes |
| Database corruption (restore needed) | 5-15 minutes |
| Major issue (requires investigation) | 15-60 minutes |

## Emergency Contact Info

If you need help:

1. **Check logs first** (commands above)
2. **Read error messages** carefully
3. **Restore from backup** if database is corrupted
4. **Seek help** on relevant forums/communities if stuck

---

**Good News**: With all services set to auto-start, your app should recover automatically within 1-2 minutes of Pi reboot! 🎉
