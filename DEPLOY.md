# TaskFlow — Deployment Guide

## Prerequisites

- A GitHub repository with the code pushed
- A domain name (optional but recommended)
- The three required secrets generated (see below)

## Generate Required Secrets

Run these commands to generate the required environment variable values:

```bash
# NEXTAUTH_SECRET (32-byte random string)
openssl rand -base64 32

# FIELD_ENCRYPTION_KEY (64-char hex = 32 bytes)
openssl rand -hex 32

# POSTGRES_PASSWORD (for EC2/Lightsail deployments)
openssl rand -base64 24
```

## Health Checks

The app exposes `GET /api/health` which pings the database and returns
`200 {"status":"ok","db":"up"}` or `503` when the database is unreachable.
Point your platform's health probe at it:

- **Railway:** Service → Settings → Health Check Path → `/api/health`
- **nginx / load balancer:** use `/api/health` as the upstream check
- **Kubernetes:** use it for both liveness and readiness probes

Environment variables are validated when the server boots — a missing or
malformed `DATABASE_URL`, `NEXTAUTH_SECRET`/`AUTH_SECRET`, or
`FIELD_ENCRYPTION_KEY` fails startup with a message listing every problem.

## Scaling Notes

- Rate limiting is in-memory (per instance). If you run more than one
  replica, swap `lib/rateLimit.ts` to a Redis-backed store
  (`rate-limiter-flexible` supports this directly).
- Agent session staleness is computed lazily on read, so no background
  worker is required.

---

## Option A: Railway (Recommended — 5 minutes)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/task-management.git
git push -u origin main
```

### Step 2 — Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your repository
3. Railway auto-detects Next.js + Dockerfile

### Step 3 — Add PostgreSQL

1. In your Railway project → **+ New** → **Database** → **PostgreSQL**
2. Click the PostgreSQL service → **Variables** → copy `DATABASE_URL`

### Step 4 — Set environment variables

In your app service → **Variables**, add:

```
DATABASE_URL          = (copied from PostgreSQL service)
NEXTAUTH_URL          = https://your-app.railway.app
NEXTAUTH_SECRET       = (from openssl above)
FIELD_ENCRYPTION_KEY  = (from openssl above)
```

### Step 5 — Run database migration

In Railway → your app service → **Deploy** tab, add a deploy command:
```
npx prisma db push && node server.js
```
Or use the Railway CLI:
```bash
railway run npx prisma db push
```

### Step 6 — Configure CI (optional but recommended)

In Railway → your app service → **Settings** → **Source** → enable **"Wait for CI checks"**. This ensures Railway only deploys after GitHub Actions CI passes.

### Custom domain

Railway → your app service → **Settings** → **Domains** → Add custom domain → update DNS.

---

## Option B: AWS Lightsail (AWS, simple pricing)

### Step 1 — Create Managed Database

1. AWS Console → Lightsail → **Databases** → **Create database**
2. Choose **PostgreSQL 16**, **Micro** ($15/month)
3. Note the endpoint, username, and password

### Step 2 — Create Container Service

1. Lightsail → **Containers** → **Create container service**
2. Choose **Nano** ($7/month), capacity: 1
3. **Set up deployment** → Image source: ECR or Docker Hub (push your image first)

### Step 3 — Push Docker image

```bash
# Build
docker build -t taskflow .

# Tag and push to ECR (or Docker Hub)
aws ecr create-repository --repository-name taskflow
docker tag taskflow:latest YOUR_ECR_URL/taskflow:latest
docker push YOUR_ECR_URL/taskflow:latest
```

### Step 4 — Configure environment variables

In the Lightsail container deployment, set:
```
DATABASE_URL          = postgresql://user:pass@YOUR_DB_ENDPOINT:5432/postgres
NEXTAUTH_URL          = https://your-service.lightsail.aws
NEXTAUTH_SECRET       = (from openssl above)
FIELD_ENCRYPTION_KEY  = (from openssl above)
```

### Step 5 — Run migration

SSH into a temporary container or run via Lightsail terminal:
```bash
npx prisma db push
```

---

## Option C: AWS EC2 + Docker Compose (Most control, cheapest)

### Step 1 — Launch EC2 instance

1. AWS Console → EC2 → **Launch Instance**
2. **Ubuntu 24.04 LTS**, **t3.small** (~$15/month)
3. Create/select a key pair
4. Security group: allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
5. Storage: 20 GB gp3

### Step 2 — Install Docker

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# Install Docker Compose
sudo apt-get install docker-compose-plugin
```

### Step 3 — Clone and configure

```bash
git clone https://github.com/YOUR_USER/task-management.git
cd task-management

cp .env.example .env
chmod 600 .env
nano .env  # Fill in your values
```

### Step 4 — Run the app

```bash
# Start database + app
docker compose -f docker-compose.prod.yml --profile app up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec app npx prisma db push
```

### Step 5 — Set up HTTPS with Nginx + Certbot

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    server_name your-domain.com;
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```bash
# Get certificate
docker compose -f docker-compose.prod.yml --profile certbot run --rm certbot certonly \
  --webroot -w /var/www/certbot -d your-domain.com --email you@email.com --agree-tos

# Start Nginx
docker compose -f docker-compose.prod.yml --profile nginx up -d
```

### Step 6 — Auto-renew certificates

```bash
# Add to crontab (runs every day at 3am)
(crontab -l 2>/dev/null; echo "0 3 * * * docker compose -f /home/ubuntu/task-management/docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f /home/ubuntu/task-management/docker-compose.prod.yml exec nginx nginx -s reload") | crontab -
```

---

## Updating the App

### Railway
```bash
git push origin main  # CI runs → Railway auto-deploys on green
```

### EC2
```bash
ssh ubuntu@YOUR_EC2_IP
cd task-management
git pull
docker compose -f docker-compose.prod.yml --profile app up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma db push
```

---

## Recurring Tasks Cron Job

The `/api/recurring` endpoint generates upcoming recurring task instances. Set up a daily cron to call it:

### Railway/Lightsail
Use a service like [cron-job.org](https://cron-job.org) (free) to POST to:
```
POST https://your-app.com/api/recurring
Authorization: Bearer YOUR_CRON_SECRET
```

### EC2
```bash
(crontab -l 2>/dev/null; echo "0 6 * * * curl -s -X POST https://your-domain.com/api/recurring -H 'Authorization: Bearer YOUR_CRON_SECRET'") | crontab -
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Random 32-byte secret for sessions |
| `NEXTAUTH_URL` | Yes | Full URL of your deployment |
| `FIELD_ENCRYPTION_KEY` | Yes | 64-char hex key for encrypting API keys |
| `CRON_SECRET` | Recommended | Bearer token for `/api/recurring` |
| `POSTGRES_PASSWORD` | EC2 only | PostgreSQL root password |
