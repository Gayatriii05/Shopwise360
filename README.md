# ShopWise 360 — Retail Demand & Customer Analytics Platform

Full-stack multi-role platform: React frontend, Node/Express backend, MySQL database,
and a Python (Scikit-learn) microservice for recommendations + demand forecasting.

## Stack
- **Frontend:** React (Vite), React Router, Recharts, Tailwind (CDN)
- **Backend:** Node.js, Express, MySQL2, JWT auth, express-validator, node-cron, Nodemailer
- **ML service:** Python, Flask, Scikit-learn, Pandas
- **Database:** MySQL 8

## Quick start (clone → running in < 5 minutes)

Prereqs: **Node 18+**, **Python 3.9+**, and a locally running **MySQL 8** server.

```bash
# 1. Get the code
git clone <this-repo> shopwise360 && cd shopwise360

# 2. Create the database (tables + indexes)
mysql -u root -p < database/schema.sql

# 3. Backend API (port 5000)
cd server
cp .env.example .env          # set DB_PASSWORD + JWT_SECRET
npm install
npm run seed                  # demo users + sample products/sales/orders
npm run dev

# 4. ML microservice (port 6000) — recommendations + demand forecasts
cd ../ml-service
cp .env.example .env          # set DB_PASSWORD
python -m venv venv
venv\Scripts\activate         # Windows;  source venv/bin/activate (Mac/Linux)
pip install -r requirements.txt
python app.py

# 5. Web app (port 3001)
cd ../client
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:3001** and sign in with any demo account below.

> Emails (order confirmation, status changes, low-stock alerts) work **out of the box** in
> dev via [Ethereal](https://ethereal.email) — no SMTP config needed. Each message's preview
> URL is printed in the server console. Switch to real SMTP (or the JSON dump mode) via
> `MAIL_TRANSPORT` (see env vars). API docs are served live at `/api/docs`.

### Demo logins (password `Password123` for all)
- admin@shopwise.com — Admin
- retailer@shopwise.com — Retailer
- supplier@shopwise.com — Supplier
- customer@shopwise.com — Customer

## Features by role

| Role | What they can do |
|---|---|
| **Customer** | Browse/search/filter products, place orders with coupon codes (auto discount), track order status in real time, review only purchased items, get personalized recommendations, maintain a wishlist, receive email confirmations + status alerts |
| **Retailer** | Manage inventory (bulk, per-product), get low-stock alerts (live socket + email), fulfil orders through the status flow (pending → confirmed → shipped → delivered), see revenue/profit KPIs, top products, daily sales, and per-product demand forecasts, export CSV/PDF reports |
| **Supplier** | Maintain products (with image upload), see sales performance across retailers |
| **Admin** | Platform-wide revenue/profit KPIs, per-retailer revenue, user breakdown, ML model health + on-demand retrain, coupon management, CSV/PDF reports, **live API docs** (`/api/docs`), and a **paginated audit log** of admin actions |

## Project structure
```
shopwise360/
├── client/          # React frontend (Vite)
├── server/          # Node/Express API
├── ml-service/      # Python Flask ML microservice
├── database/        # SQL schema
├── tests/           # Jest + regression verification suites
└── docker-compose.yml / render.yaml / vercel.json   # deployment
```

## Setup

### 1. Database
```bash
mysql -u root -p < database/schema.sql
```

### 2. Backend
```bash
cd server
cp .env.example .env      # edit DB_PASSWORD and JWT_SECRET
npm install
npm run seed               # creates demo users + sample products/sales
npm run dev                # starts on http://localhost:5000
```

Demo logins (password `Password123` for all):
- admin@shopwise.com
- retailer@shopwise.com
- supplier@shopwise.com
- customer@shopwise.com

### 3. ML service
```bash
cd ml-service
cp .env.example .env
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
python app.py                # starts on http://localhost:6000
```

### 4. Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev                  # starts on http://localhost:3001
```

Open http://localhost:3001

> Port 3000 on some Windows machines is reserved by IIS/HTTP.sys (a system service),
> so the client dev server is configured for **3001**. Both the API base URL and the
> socket URL point straight at `localhost:5000`, so nothing else needs to change.

## Environment variables

### Server (`server/.env`) — copy from `server/.env.example`
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | API listen port |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | — | MySQL password (required) |
| `DB_NAME` | `shopwise360` | MySQL database |
| `JWT_SECRET` | — | Random long string signing access tokens (required) |
| `ML_SERVICE_URL` | `http://127.0.0.1:6000` | Base URL of the ML microservice |
| `ACCESS_TOKEN_TTL` | `15m` | Access-token lifetime (e.g. `15m`, `1h`) |
| `REFRESH_TOKEN_TTL` | `7d` | Refresh-token lifetime |
| `AUTH_RATE_MAX` | `20` | Max login attempts per IP+email per window |
| `AUTH_RATE_WINDOW_MS` | `900000` | Rate-limit window (ms) for login |
| `REGISTER_RATE_MAX` | `50` | Max registrations per IP per window |
| `REGISTER_RATE_WINDOW_MS` | `3600000` | Rate-limit window (ms) for register |
| `REDIS_URL` | `redis://localhost:6379` | Optional Redis for dashboard cache (app **fails open** to DB when unreachable) |
| `DASH_CACHE_TTL` | `60` | Dashboard cache TTL in seconds |
| `MAIL_TRANSPORT` | `ethereal` | How emails are sent: `ethereal` (dev, auto test account + preview URLs), `smtp` (real SMTP/Hosted), `json` (dry-run: dump each message to `MAIL_DUMP_DIR`) |
| `SMTP_HOST` | — | SMTP server host (used when `MAIL_TRANSPORT=smtp`) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | `true` for port 465 |
| `SMTP_USER` / `SMTP_PASS` | — | SMTP credentials |
| `MAIL_FROM` | `ShopWise 360 <no-reply@shopwise360.local>` | Sender shown on outgoing mail |
| `MAIL_DUMP_DIR` | `./mail-dump` | Where `MAIL_TRANSPORT=json` writes composed messages (JSON files) |

### ML service (`ml-service/.env`) — copy from `ml-service/.env.example`
| Variable | Default | Purpose |
|---|---|---|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | — | MySQL password (required) |
| `DB_NAME` | `shopwise360` | MySQL database |
| `ML_PORT` | `6000` | Flask listen port |
| `MODEL_MAX_AGE_SECONDS` | `43200` (12h) | Persisted model freshness window (stale/missing → lazy retrain) |

### Client (`client/.env`) — copy from `client/.env.example`
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000/api` | API base URL the frontend calls |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Socket.IO server URL for real-time alerts |

## Tests
- **API/Jest** (`tests/`): `npm run test:unit` — auth, transaction-safe orders, RBAC. Requires MySQL + the server running on `:5000`.
- **SQL regressions** (`tests/`): `npm run verify:phase0`, `verify:phase3`, `verify:phase4`, plus `socket:e2e`.
- **Phase 7 features** (`tests/`): `npm run verify:phase7` — email notifications (JSON mail-dump mode), Swagger spec/UI, and the admin audit log. Spawns its own server on `:5007`.
- **ML/pytest** (`ml-service/`): `pip install -r requirements-dev.txt && python -m pytest` — cold-start recommender + demand fallback unit tests (no DB/network needed).

## What's implemented
- JWT auth + role-based access (customer/retailer/supplier/admin) with access + rotating refresh tokens
- Full product CRUD, multi-table joined queries for inventory/sales
- Order placement with transaction-safe inventory decrement + profit calc (oversell → 409 + rollback)
- Retailer dashboard: revenue/profit, top products, category breakdown, daily sales chart, low-stock alerts
- Admin dashboard: platform-wide aggregates, per-retailer revenue, user counts (Redis-cached, DB fallback)
- Supplier dashboard: product performance, stock across retailers
- Scikit-learn recommender (item-based collaborative filtering, cosine similarity, popularity cold-start fallback)
- Scikit-learn demand forecast (per-product linear regression on sales history, avg fallback)
- Hourly cron job auto-generating low-stock alerts
- Email notifications via Nodemailer (Ethereal dev transport or real SMTP): order confirmation + status changes to customers, low-stock alerts to retailers
- Live API docs via swagger-jsdoc + swagger-ui-express (`/api/docs`) with a boot-time route-coverage check
- Admin audit log (`audit_log` table): coupon/product create/delete, order status changes, model retrains — browsable in the Admin dashboard
- Validation (consistent `{ error, errors }` 400s), rate limiting (login/register), refresh-token rotation + reuse detection
- Global error handler (malformed JSON → 400, multer → 400/413)
- Docker Compose (MySQL + Redis + server + ML + client) + Dockerfiles + `.dockerignore`
- Automation-style regression suites + Jest integration tests + pytest unit tests

## What's intentionally left for you to extend (with OpenCode)
- Payment integration (mock or Razorpay/Stripe)
- Order status tracking UI polish + cancellation reasons
- Better ML: real train/test split, feature engineering, scheduled retraining automation, model drift monitoring
- Real Redis + Docker deployment on a hosted provider (configs ship in `render.yaml` / `vercel.json` / Dockerfiles)

## API overview
| Method | Route | Access |
|---|---|---|
| POST | /api/auth/register | public |
| POST | /api/auth/login | public |
| GET | /api/products | public |
| POST/PUT/DELETE | /api/products | supplier, admin |
| GET/PUT/POST | /api/inventory | retailer, admin |
| POST | /api/orders | customer |
| GET | /api/dashboard/retailer/:id/summary | retailer, admin |
| GET | /api/dashboard/admin/summary | admin |
| GET | /api/dashboard/supplier/:id/summary | supplier, admin |
| GET | /api/ml/recommend/:customerId | authenticated |
| GET | /api/ml/predict-demand/:retailerId | authenticated |
| POST | /api/ml/retrain | admin |
| GET | /api/audit?page=&limit=&action=&entity_type=&entity_id= | admin |
| GET | /api/docs | public (Swagger UI) |
| GET | /api/docs/swagger.json | public (raw OpenAPI spec) |
