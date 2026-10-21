# LifeSync Production Deployment Guide

This guide provides end-to-end instructions for deploying LifeSync to production with **Supabase PostgreSQL** and modern cloud platforms (**Render**, **Railway**, **Fly.io**).

---

## Architecture Overview

```
                      +-----------------------------+
                      |   LifeSync Web Frontend     |
                      |   (HTML5, CSS3, Vanilla ES6)|
                      +--------------+--------------+
                                     |
                                     | HTTPS / REST APIs
                                     v
                      +-----------------------------+
                      |     Express 5 Backend       |
                      |   (JWT Auth, Rate Limit)    |
                      +--------------+--------------+
                                     |
                  +------------------+------------------+
                  |                                     |
                  v                                     v
       [Production Mode]                         [Offline Fallback]
  Supabase PostgreSQL Pool                    Local SQLite (lifesync.db)
  (DATABASE_URL configured)                   (DATABASE_URL unset)
```

---

## 1. Supabase PostgreSQL Setup

### Step 1.1: Create a Supabase Project
1. Log in to [Supabase](https://supabase.com).
2. Click **New Project**, choose an organization, set a project name (e.g., `lifesync-prod`), and select your closest AWS region.
3. Save your database password securely.

### Step 1.2: Obtain Connection String
1. In Supabase Dashboard, go to **Project Settings** > **Database**.
2. Locate the **Connection string** section:
   - **Connection Pooler (Recommended for cloud hosting/containers)**:
     ```text
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
     ```
   - **Direct Connection**:
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
     ```

---

## 2. Running Database Migrations

LifeSync includes version-controlled SQL migrations located in `backend/migrations/`:
- `001_initial_schema.sql`: Core tables, foreign keys, and indexes.
- `002_notifications_and_pomodoro.sql`: Smart notification triggers & Pomodoro sessions.
- `003_supabase_rls.sql`: Row-Level Security policies.

### Run Migrations Automatically
Set your `DATABASE_URL` in `backend/.env` (or in platform environment variables) and run:
```bash
npm run migrate
```
Or from the backend folder:
```bash
cd backend
npm run migrate
```

### (Optional) Migrate Existing Local SQLite Data to Supabase
To preserve and transfer all local development data from `lifesync.db` into Supabase:
```bash
# 1. Ensure SQLite is backed up
npm run backup

# 2. Run data transfer with row-count verification
npm run migrate:data
```

---

## 3. Deploying to Render

Render is the recommended hosting platform for LifeSync.

1. Create an account on [Render](https://render.com).
2. Click **New** > **Web Service**.
3. Connect your Git repository (`LifeSync`).
4. Configure service settings:
   - **Name**: `lifesync-app`
   - **Region**: Same region as your Supabase database.
   - **Branch**: `main`
   - **Root Directory**: Leave blank (uses repository root).
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run migrate`
   - **Start Command**: `npm start`
5. Configure **Environment Variables**:
   | Variable | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production optimizations |
   | `PORT` | `10000` | Render assigns this automatically |
   | `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]...` | Supabase pooler URL with SSL |
   | `JWT_SECRET` | Strong 64-char random string | e.g. generated via crypto |
   | `CLIENT_URL` | `https://lifesync-app.onrender.com` | Your assigned Render domain |
6. Click **Create Web Service**.

---

## 4. Deploying to Railway

1. Install Railway CLI or connect via [Railway.app](https://railway.app).
2. Create **New Project** > **Deploy from GitHub repo**.
3. In service **Variables**, add:
   - `DATABASE_URL` = Your Supabase connection string.
   - `JWT_SECRET` = Your production JWT key.
   - `NODE_ENV` = `production`
4. Set build & start commands:
   - Build: `npm install && npm run migrate`
   - Start: `npm start`
5. Click **Deploy**.

---

## 5. Health Check & Post-Deployment Verification

Verify your live deployment by hitting the `/api/health` endpoint:

```bash
curl -i https://your-deployment-url.com/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "uptime": 1240,
  "timestamp": "2026-10-20T12:00:00.000Z",
  "environment": "production",
  "database": {
    "status": "connected",
    "driver": "pg",
    "latencyMs": 18
  }
}
```

---

## 6. Backup, Rollback & Disaster Recovery

### SQLite Local Backup
To create a safe timestamped copy of your local SQLite database:
```bash
npm run backup
```
Backups are archived in `backend/backups/lifesync_backup_<timestamp>.db`.

### Supabase Automated Backups
Supabase automatically captures daily database snapshots. In the Supabase dashboard:
- Navigate to **Project Settings** > **Database** > **Backups**.
- Point-In-Time Recovery (PITR) is supported on Pro plans.

### Reverting to SQLite (Zero-Downtime Fallback)
If the external PostgreSQL database ever experiences an outage:
1. Clear or remove the `DATABASE_URL` environment variable.
2. Restart the web service.
3. The LifeSync dual-mode adapter will automatically fall back to local SQLite without changing any application code.

---

## 7. Security Best Practices Checklist

- [x] Passwords salted and hashed with `bcryptjs` (cost factor 10).
- [x] JWT sessions issued with expiration and validated on every protected API route.
- [x] User tenant isolation strictly enforced (`req.user.id`).
- [x] Supabase Row-Level Security (RLS) enabled across all tables.
- [x] SSL encryption enforced for PostgreSQL pool clients (`rejectUnauthorized: false` for managed certs).
- [x] Secrets excluded from version control via `.gitignore`.
- [x] Graceful shutdown traps configured (`SIGTERM`, `SIGINT`) to drain connections cleanly.
