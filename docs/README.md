# LUCID Finance - Documentation

**Complete documentation for developers, administrators, and users**

---

## 📚 Documentation Index

### For Users

| Document | Description | Audience |
|----------|-------------|----------|
| **[USER_GUIDE.md](USER_GUIDE.md)** | Complete user guide for beta testers | End Users |

**Start here if you're learning to use LUCID Finance!**

---

### For Developers & Administrators

#### Essential Reading

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Complete system architecture | Understanding how everything works |
| **[QUICK_START_TECHNICAL.md](QUICK_START_TECHNICAL.md)** | Quick technical actions reference | Daily operations & deployment |
| **[DATABASE.md](DATABASE.md)** | Database schema & management | Database operations & migrations |
| **[RASPBERRY_PI_SETUP.md](RASPBERRY_PI_SETUP.md)** | Pi optimizations & setup | Setting up/maintaining Pi server |

#### Setup & Deployment

| Document | Description |
|----------|-------------|
| **[CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md)** | Cloudflare Tunnel setup for internet access |
| **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)** | Production deployment procedures |

#### Historical Reference

| Document | Description | Status |
|----------|-------------|--------|
| [SD_CARD_OPTIMIZATION.md](SD_CARD_OPTIMIZATION.md) | SD card optimizations (Log2Ram, zRAM, etc.) | ✅ Implemented (see RASPBERRY_PI_SETUP.md) |
| [USER_ISOLATION_FIX.md](USER_ISOLATION_FIX.md) | User data isolation fix documentation | ✅ Completed |
| [DASHBOARD_FIXES.md](DASHBOARD_FIXES.md) | Dashboard improvements log | 📝 Historical |
| [AUTHENTICATION.md](AUTHENTICATION.md) | Authentication system docs | 📝 Historical |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Project structure overview | 📝 Historical |

---

## 🚀 Quick Start

### I want to...

**...use LUCID Finance**
→ Read [USER_GUIDE.md](USER_GUIDE.md)

**...understand the system architecture**
→ Read [ARCHITECTURE.md](ARCHITECTURE.md)

**...deploy code to production**
→ Follow [QUICK_START_TECHNICAL.md](QUICK_START_TECHNICAL.md#deploy-to-production-pi)

**...create a new user**
→ See [QUICK_START_TECHNICAL.md](QUICK_START_TECHNICAL.md#create-a-new-user)

**...backup/restore the database**
→ Check [DATABASE.md](DATABASE.md#backup--restore)

**...troubleshoot an issue**
→ Consult [QUICK_START_TECHNICAL.md](QUICK_START_TECHNICAL.md#troubleshooting)

**...set up Cloudflare Tunnel**
→ Follow [CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md)

---

## 📋 Document Descriptions

### ARCHITECTURE.md
**Complete technical architecture documentation**

Covers:
- Technology stack (Frontend, Backend, Database, Infrastructure)
- System components and data flow
- Network architecture (Cloudflare Tunnel setup)
- Security architecture
- Database schema
- Deployment architecture
- Performance characteristics

**Read this for:** Deep understanding of how LUCID Finance works

---

### QUICK_START_TECHNICAL.md
**Quick reference for common technical tasks**

Covers:
- Creating users (3 methods)
- Deploying to production (full, backend-only, frontend-only)
- Database operations (backup, restore, queries)
- Troubleshooting common issues
- Service management
- Development workflow

**Read this for:** Day-to-day operations and quick answers

---

### DATABASE.md
**MySQL database management guide**

Covers:
- Database schema (all tables with field descriptions)
- Indexes and performance optimization
- Migration procedures
- Backup and restore procedures
- Maintenance tasks (weekly, monthly, quarterly)
- Monitoring and troubleshooting
- Quick reference commands

**Read this for:** Database-related tasks and understanding data structure

---

### RASPBERRY_PI_SETUP.md
**Raspberry Pi configuration and optimizations**

Covers:
- Hardware requirements
- SD card optimizations (Log2Ram, zRAM, tmpfs)
- MySQL optimizations for Pi
- System services configuration (systemd)
- Automated maintenance (backups, optimization, monitoring)
- Performance monitoring
- Troubleshooting Pi-specific issues
- USB SSD upgrade path

**Read this for:** Setting up or maintaining the Raspberry Pi server

---

### USER_GUIDE.md
**User manual for end users and beta testers**

Covers:
- Getting started (login, navigation)
- Dashboard usage
- Transaction management (upload, edit, delete)
- Budget planning (Budget Wizard, manual budgets)
- Categorization rules
- Tips and best practices
- FAQ

**Read this for:** Learning to use LUCID Finance as an end user

---

### CLOUDFLARE_TUNNEL.md
**Setting up Cloudflare Tunnel for internet access**

Covers:
- Tunnel creation and configuration
- DNS setup
- Nginx integration
- Cloudflare security settings (WAF, rate limiting, caching)
- CORS configuration
- Monitoring and troubleshooting
- Security best practices

**Read this for:** Exposing LUCID Finance to the internet securely

---

## 🔧 Technical Stack Overview

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS 3
- **Charts:** Recharts 2
- **HTTP Client:** Axios

### Backend
- **Language:** Python 3.13+
- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.x
- **Validation:** Pydantic 2.x
- **Server:** Uvicorn

### Database
- **RDBMS:** MySQL 8.0 (Docker)
- **Optimizations:** Custom config for Raspberry Pi

### Infrastructure
- **Host:** Raspberry Pi 4/5
- **Reverse Proxy:** Nginx
- **Internet Access:** Cloudflare Tunnel
- **Service Manager:** systemd
- **SD Protection:** Log2Ram, zRAM, tmpfs

---

## 📊 System Status

**Production Environment:**
- **URL:** https://lucid-finance.cc
- **Hosting:** Raspberry Pi (Home)
- **Database:** MySQL 8.0 (Docker)
- **Backups:** Daily at 2 AM (14 days retention)
- **Uptime Target:** 99%+

**Current Version:** 1.1 (February 2026)

**Recent Changes:**
- ✅ Added sub_type field (Essentials/Needs/Wants)
- ✅ Budget Wizard implementation
- ✅ Bulk transaction editing
- ✅ Improved Budget Planning UI with summary dashboard
- ✅ Fixed Cost Ratio now based on Essentials only

---

## 🛠️ Maintenance

### Regular Tasks

| Task | Frequency | Automated? |
|------|-----------|------------|
| Database backup | Daily (2 AM) | ✅ Yes (cron) |
| Table optimization | Monthly | ✅ Yes (cron) |
| Disk health check | Weekly | ✅ Yes (cron) |
| System updates | Monthly | ❌ Manual |
| Backup verification | Monthly | ❌ Manual |
| Log review | Weekly | ❌ Manual |

### Scripts Location

All maintenance scripts are in the home directory on the Pi:
- `~/backup_lucid.sh` - Database backup
- `~/maintenance_lucid.sh` - Table optimization
- `~/monitor_disk.sh` - Disk health monitoring

---

## 📞 Support

### Getting Help

1. **Check documentation** - Start with relevant doc above
2. **Search GitHub issues** - May have been solved before
3. **Contact admin** - For technical issues or access problems

### Reporting Issues

When reporting a bug or issue, include:
1. **What you were doing** - Steps to reproduce
2. **What happened** - Actual behavior
3. **What you expected** - Expected behavior
4. **Screenshots** - If applicable
5. **Error messages** - From browser console or logs

---

## 📝 Contributing to Documentation

Documentation is maintained in `/docs` directory.

**Updating docs:**
1. Edit the relevant `.md` file
2. Ensure proper markdown formatting
3. Update version history if significant change
4. Commit with clear message

**Adding new documentation:**
1. Create new `.md` file in `/docs`
2. Add entry to this README.md index
3. Link from related documents
4. Follow existing document structure

---

## 📚 External Resources

### Technology Documentation
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [MySQL](https://dev.mysql.com/doc/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

### Raspberry Pi Resources
- [Official Documentation](https://www.raspberrypi.com/documentation/)
- [Log2Ram](https://github.com/azlux/log2ram)
- [Performance Tuning](https://www.raspberrypi.com/documentation/computers/config_txt.html)

---

## 📅 Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| 1.0 | Dec 2025 | Initial release |
| 1.1 | Feb 2026 | Sub-types, Budget Wizard, Bulk editing, UI improvements |

---

**Last Updated:** February 2026

**Next Documentation Review:** March 2026

---

**Need to add a new document?** Contact the development team or create a pull request!
