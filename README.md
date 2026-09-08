# ShopWise 360 — Retail Demand & Customer Analytics Platform

Full-stack multi-role platform: React frontend, Node/Express backend, MySQL database,
and a Python (Scikit-learn) microservice for recommendations + demand forecasting.

## Stack
- **Frontend:** React (Vite), React Router, Recharts, Tailwind (CDN)
- **Backend:** Node.js, Express, MySQL2, JWT auth, express-validator, node-cron
- **ML service:** Python, Flask, Scikit-learn, Pandas
- **Database:** MySQL 8

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
- Validation (consistent `{ error, errors }` 400s), rate limiting (login/register), refresh-token rotation + reuse detection
- Global error handler (malformed JSON → 400, multer → 400/413)
- Docker Compose (MySQL + Redis + server + ML + client) + Dockerfiles + `.dockerignore`
- Automation-style regression suites + Jest integration tests + pytest unit tests

## What's intentionally left for you to extend (with OpenCode)
- Image upload for products (multer)
- Payment integration (mock or Razorpay/Stripe)
- Pagination, search & filters on product listing
- Order status tracking UI for retailer (backend flow is tested)
- Better ML: real train/test split, scheduled retraining via `/ml/retrain`, model drift monitoring
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
