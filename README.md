# AfghanEarn Backend

Root-level Node.js/Express backend for AfghanEarn.

## Requirements

- Node.js 18+
- MongoDB
- npm

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env` and set:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_this
MIN_WITHDRAWAL=1
```

Never upload `.env` to GitHub.

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Create the first admin:

```bash
npm run create-admin
```

## Health

`GET /`

`GET /api/health`

## Main APIs

Auth:
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`

Users:
- GET `/api/users/profile`
- PATCH `/api/users/profile`
- GET `/api/users/transactions`
- GET `/api/users/stats`

Games:
- GET `/api/games`
- GET `/api/games/:id`
- POST `/api/games/:id/start`
- POST `/api/games/:id/complete`

Rewards:
- GET `/api/rewards/my`
- Admin reward pool endpoints are available through `/api/rewards/pool`

Withdrawals:
- POST `/api/withdrawals`
- GET `/api/withdrawals/my`
- GET `/api/withdrawals/admin`
- PATCH `/api/withdrawals/admin/:id`

Admin:
- GET `/api/admin/dashboard`
- GET `/api/admin/users`
- GET `/api/admin/games`
- POST `/api/admin/games`
- PATCH `/api/admin/games/:id`
- DELETE `/api/admin/games/:id`
- GET `/api/admin/withdrawals`
- GET `/api/admin/transactions`
- GET `/api/admin/reward-pool`
- GET `/api/admin/reports`

## Important

This backend is a foundation for a rewards platform. Real-money withdrawals, advertising revenue, payment providers, and cryptocurrency payouts require additional business, security, compliance, and fraud controls before production use.
