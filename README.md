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
└── database/        # SQL schema
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

## What's implemented
- JWT auth + role-based access (customer/retailer/supplier/admin)
- Full product CRUD, multi-table joined queries for inventory/sales
- Order placement with transaction-safe inventory decrement + profit calc
- Retailer dashboard: revenue/profit, top products, category breakdown, daily sales chart, low-stock alerts
- Admin dashboard: platform-wide aggregates, per-retailer revenue, user counts
- Supplier dashboard: product performance, stock across retailers
- Scikit-learn recommender (item-based collaborative filtering, cosine similarity)
- Scikit-learn demand forecast (per-product linear regression on sales history)
- Hourly cron job auto-generating low-stock alerts

## What's intentionally left for you to extend (with OpenCode)
- Image upload for products (multer)
- Payment integration (mock or Razorpay/Stripe)
- Pagination, search & filters on product listing
- Order status tracking UI for retailer
- Better ML: real train/test split, model persistence with joblib, scheduled retraining
- Redis caching for dashboard aggregate queries
- Dockerize (compose file for mysql + server + ml-service + client)
- Unit/integration tests
- Deployment configs (Vercel for client, Render/Railway for server + ml-service)

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
