# Cloudflare Tunnel Setup for lucid-finance.cc

This guide shows you how to expose your LUCID Finance app to the internet securely using Cloudflare Tunnel with your domain `lucid-finance.cc`.

## Prerequisites

- ✅ Cloudflare account
- ✅ Domain `lucid-finance.cc` added to Cloudflare
- ✅ `cloudflared` installed on your Raspberry Pi
- ✅ App deployed and running on Pi

## Step 1: Login to Cloudflare (on Pi)

SSH to your Pi and authenticate with Cloudflare:

```bash
ssh luca@lucid-pi.local

# Login to Cloudflare
cloudflared tunnel login
```

This will open a browser window. Login and authorize the tunnel.

## Step 2: Create a Tunnel

```bash
# Create a tunnel named "lucid-finance"
cloudflared tunnel create lucid-finance

# Note the Tunnel ID that is displayed
# Example: Created tunnel lucid-finance with id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

The tunnel credentials will be saved to:
`~/.cloudflared/<tunnel-id>.json`

## Step 3: Configure DNS

Route your domain through the tunnel:

```bash
# Route your domain to the tunnel
cloudflared tunnel route dns lucid-finance lucid-finance.cc

# Optional: Add www subdomain
cloudflared tunnel route dns lucid-finance www.lucid-finance.cc
```

Alternatively, you can manually add DNS records in Cloudflare Dashboard:
- Type: `CNAME`
- Name: `@` (or `www` for subdomain)
- Target: `<tunnel-id>.cfargotunnel.com`
- Proxy status: Proxied (orange cloud)

## Step 4: Create Tunnel Configuration

Create the config file:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Add this configuration:

```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /home/luca/.cloudflared/<YOUR-TUNNEL-ID>.json

# Optional: Set log level
# loglevel: info

ingress:
  # Main domain - route to nginx
  - hostname: lucid-finance.cc
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  # www subdomain
  - hostname: www.lucid-finance.cc
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  # Catch-all rule (required)
  - service: http_status:404
```

**Important**: Replace `<YOUR-TUNNEL-ID>` with your actual tunnel ID.

## Step 5: Test the Tunnel

Test the tunnel before installing as a service:

```bash
cloudflared tunnel run lucid-finance
```

You should see:
```
INF Starting tunnel tunnelID=...
INF Connection registered connIndex=0
```

Open a browser and visit `https://lucid-finance.cc` - your app should load!

Press `Ctrl+C` to stop the test.

## Step 6: Install as System Service

Install the tunnel to run automatically on boot:

```bash
# Install as a system service
sudo cloudflared service install

# Start the service
sudo systemctl start cloudflared

# Enable on boot
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

## Step 7: Update nginx Configuration (Optional but Recommended)

Update nginx to handle the domain properly:

```bash
sudo nano /etc/nginx/sites-available/lucid-finance
```

Update the server block:

```nginx
server {
    listen 80;
    server_name lucid-finance.cc www.lucid-finance.cc localhost _;

    # Frontend - serve static files
    location / {
        root /home/luca/LUCID_Finance_WebApp/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API - proxy to FastAPI
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:8000/api/health;
    }
}
```

Restart nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Step 8: Configure Cloudflare Settings

### 8.1 SSL/TLS Mode

In Cloudflare Dashboard:
1. Go to SSL/TLS → Overview
2. Set encryption mode to **"Flexible"** or **"Full"**
   - Flexible: HTTP between Cloudflare and your Pi (simpler)
   - Full: Requires HTTPS on your Pi (more secure)

### 8.2 Security Settings (Recommended)

**Enable Security Features:**

1. **Security → WAF** - Enable Web Application Firewall
2. **Security → Bots** - Configure bot protection
3. **Security → DDoS** - DDoS protection (enabled by default)

**Rate Limiting (Optional):**

Create a rate limiting rule for your API:
- Path: `/api/*`
- Rate: 1000 requests per 10 minutes
- Action: Block

### 8.3 Caching Rules

Optimize performance with caching:

1. Go to **Caching → Configuration**
2. Add cache rule:
   - Match: `lucid-finance.cc/*`
   - Settings:
     - Browser Cache TTL: 4 hours
     - Cache Level: Standard
   - Bypass cache for: `/api/*`

## Step 9: Update Backend CORS (If Needed)

If you encounter CORS issues, update your backend:

Edit `backend/api/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lucid-finance.cc",
        "https://www.lucid-finance.cc",
        "http://localhost:5173",  # Keep for local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then restart the backend:

```bash
sudo systemctl restart lucid-backend
```

## Access Your Application

Your app is now accessible worldwide at:

- 🌐 **https://lucid-finance.cc**
- 🌐 **https://www.lucid-finance.cc**

**Benefits of Cloudflare Tunnel:**
- ✅ No port forwarding needed on router
- ✅ DDoS protection
- ✅ Free SSL certificate
- ✅ Hide your home IP address
- ✅ Access control with Cloudflare Access (optional)
- ✅ Analytics and logging

## Monitoring & Maintenance

### View Tunnel Logs

```bash
sudo journalctl -u cloudflared -f
```

### Check Tunnel Status

```bash
cloudflared tunnel list
cloudflared tunnel info lucid-finance
```

### Restart Tunnel

```bash
sudo systemctl restart cloudflared
```

### Update cloudflared

```bash
sudo cloudflared update
sudo systemctl restart cloudflared
```

## Optional: Add Cloudflare Access for Extra Security

Restrict access to your app with authentication:

1. Go to **Cloudflare Zero Trust**
2. Create an **Access Application**:
   - Name: LUCID Finance
   - Domain: `lucid-finance.cc`
   - Path: `/`
3. Add **Access Policies**:
   - Rule: Allow specific emails
   - Enter your email address

Now users must authenticate before accessing your app.

## Troubleshooting

### Tunnel Not Connecting

```bash
# Check if cloudflared is running
sudo systemctl status cloudflared

# Check logs
sudo journalctl -u cloudflared -n 100

# Test manually
cloudflared tunnel run lucid-finance
```

### 502 Bad Gateway

This means Cloudflare can't reach your local service:

```bash
# Check if nginx is running
sudo systemctl status nginx

# Check if backend is running
sudo systemctl status lucid-backend

# Test local access
curl http://localhost:80
```

### DNS Not Resolving

```bash
# Check DNS records
nslookup lucid-finance.cc

# Should return Cloudflare IPs, not your home IP
```

Wait up to 5 minutes for DNS propagation.

### Connection Timing Out

Check your tunnel configuration:

```bash
cat ~/.cloudflared/config.yml

# Verify tunnel ID matches
cloudflared tunnel list
```

## Security Best Practices

1. **Change Default Passwords**: Update admin password after first login
2. **Enable 2FA**: On your Cloudflare account
3. **Monitor Logs**: Regularly check cloudflared and nginx logs
4. **Update Regularly**: Keep cloudflared and your system updated
5. **Restrict Admin Access**: Consider using Cloudflare Access for admin routes
6. **Use Strong JWT Secret**: Update `SECRET_KEY` in `backend/api/auth.py`
7. **Database Backups**: Schedule regular backups

## Update JWT Secret Key

Before going to production, update your JWT secret:

```bash
# On your Pi
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# Generate a secure secret
openssl rand -hex 32

# Update backend/api/auth.py
nano backend/api/auth.py
```

Replace:
```python
SECRET_KEY = "your-secret-key-change-this-in-production-use-env-variable"
```

With:
```python
SECRET_KEY = "<your-generated-secret>"
```

Restart backend:
```bash
sudo systemctl restart lucid-backend
```

## Quick Reference

```bash
# Tunnel management
cloudflared tunnel list
cloudflared tunnel info lucid-finance
sudo systemctl status cloudflared
sudo systemctl restart cloudflared
sudo journalctl -u cloudflared -f

# Test tunnel locally
cloudflared tunnel run lucid-finance

# DNS check
nslookup lucid-finance.cc

# Update cloudflared
sudo cloudflared update
```

---

**🎉 Congratulations!** Your LUCID Finance app is now securely accessible worldwide at `https://lucid-finance.cc`
