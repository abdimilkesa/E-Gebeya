# Gebeya

A location-based marketplace that helps customers discover products from local shops. The repository contains a React frontend, an Express API, shared TypeScript contracts, and the product specification in `docs/`.

> **Local setup guide:** follow the steps below to run the application on your computer. The payment, maps, and AI integrations may need their own provider credentials.

## What is included

- **Customer storefront:** browse shops and products, search the catalog, and use a shared cart.
- **Merchant area:** manage a shop and its products.
- **Admin area:** manage marketplace users, shops, and categories.
- **Market analyst:** ask questions about the public product catalog. It requires a Gemini API key.
- **Backend API:** Express and Prisma, backed by PostgreSQL.

The `docs/` folder contains the detailed product and technical specification. Treat it as the design reference; the presence of a feature in the specification does not by itself mean that every external integration is configured.

## Requirements

- Node.js **22.22.0 or newer**
- npm
- PostgreSQL, running locally or hosted

## Run locally

Run these commands from the repository root in PowerShell.

### 1. Install dependencies

```powershell
npm install
```

### 2. Configure environment variables

There is one `.env` file at the repository root for the API, Prisma, and Vite. Create it from the example only if it does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Set the following values in `.env`:

| Variable | What to set |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the development database. The example uses `localhost:5432/marketplace_dev`; make sure the database and credentials exist. |
| `JWT_ACCESS_SECRET` | A private random string of at least 32 characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. |
| `FRONTEND_ORIGIN` | Keep as `http://localhost:5173` for local development. |
| `ADMIN_USERNAME` | Username for the initial Super Admin. |
| `ADMIN_INITIAL_PASSWORD` | Initial Super Admin password; use 8–128 characters. You will be asked to change it at first sign-in. |

Optional:

- Set `DEMO_ACCOUNT_PASSWORD` if you want to create the demo merchants and shopper.
- Set `GEMINI_API_KEY` to enable the market analyst. Keep it server-side: **do not** rename it to a `VITE_` variable.
- Set `VITE_GOOGLE_MAPS_API_KEY` to enable Google Maps. The app can run without this key, but map features may be unavailable.

Never commit `.env` or share its secrets.

### 3. Prepare the database

Start PostgreSQL and make sure the database named in `DATABASE_URL` exists. Update the connection string in `.env` to match your PostgreSQL username, password, host, and database name.

Then apply the migrations and create the initial Super Admin and starter categories:

```powershell
npm run db:migrate
npm run db:seed
```

To load sample shops, products, merchant accounts, and a shopper, first set `DEMO_ACCOUNT_PASSWORD` in `.env`, then run:

```powershell
npm run db:seed:demo
```

Demo usernames are `abebe_coffee`, `selam_electronics`, `tigist_fashion`, `jimma_grocers`, and `demo_customer`. They share the password configured in `DEMO_ACCOUNT_PASSWORD`. Seeding creates missing accounts; it does not reset passwords for accounts that already exist.

### 4. Start the frontend and API

```powershell
npm run dev
```

Open the frontend at **http://localhost:5173**. The API listens at **http://localhost:4000**; its health endpoint is **http://localhost:4000/api/v1/health**.

Press **Ctrl+C** in the terminal to stop the development servers.

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the frontend and API together |
| `npm run build` | Build the shared contracts, API, and frontend |
| `npm run typecheck` | Type-check the workspaces |
| `npm test` | Run backend and frontend unit tests |
| `npm run db:studio -w @marketplace/backend` | Open Prisma Studio to inspect the database |

## Troubleshooting

- **`DATABASE_URL is required` or other environment validation errors:** check the named variable in the root `.env`. The JWT secret must be at least 32 characters, and `FRONTEND_ORIGIN` must be a URL.
- **Database connection or migration errors:** confirm PostgreSQL is running, the database exists, and the username/password in `DATABASE_URL` are correct.
- **The assistant says it is unavailable:** set a valid `GEMINI_API_KEY` in the root `.env`, make sure the Gemini API is enabled for that key, and restart `npm run dev`.
- **Port 5173 or 4000 is already in use:** stop the other process using that port, then run `npm run dev` again.
- **The store has no sample products:** run `npm run db:seed:demo` after setting `DEMO_ACCOUNT_PASSWORD`.

## Project layout

```text
backend/             Express API, Prisma schema, migrations, and seed scripts
frontend/            React application
packages/contracts/  Shared TypeScript API contracts
docs/                Product requirements and technical specification
```

For the specification's reading order and document index, see [`docs/README.md`](docs/README.md).
