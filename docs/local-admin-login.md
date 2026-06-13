# Local Admin Login (local testing)

Purpose: quickly create a local admin account for testing the Admin Console without touching production secrets.

Files added/created by this guide:
- `backend/scripts/create-local-admin-hash.cjs` — generate local admin password hash and session secret; writes `backend/.env.local.admin` (gitignored).

Warning:
- Do NOT commit `backend/.env.local.admin` or any real secrets.
- This guide is for local testing only.

Steps

1) Generate local admin env file (hidden prompt)

```bash
cd backend
node scripts/create-local-admin-hash.cjs
```

The script will prompt for a password (hidden). It writes `backend/.env.local.admin` with the following keys:

- `ADMIN_LOGIN_EMAIL` (example comment line; edit to your email)
- `ADMIN_PASSWORD_HASH` (pbkdf2:saltHex:hashHex)
- `ADMIN_SESSION_SECRET`
- `PORT=3001`

2) Use local env for backend

Copy values from `backend/.env.local.admin` into a local `.env` file under `backend/` (or set environment variables in your shell). Example (do NOT commit):

```
ADMIN_LOGIN_EMAIL=you@example.com
ADMIN_PASSWORD_HASH=pbkdf2:...
ADMIN_SESSION_SECRET=...
PORT=3001
```

3) Run backend

```bash
cd backend
node server.js
# or use nodemon if installed
```

4) Run frontend

From project root:

```bash
npm run dev
```

The frontend is configured to proxy `/api` to `http://localhost:3001` (see `vite.config.ts`).

5) Login on Admin Console

- Open: `http://localhost:5173/admin/console`
- Use the `ADMIN_LOGIN_EMAIL` and the password you entered when generating the hash.

6) Cleanup

- Remove `backend/.env.local.admin` when finished or rotate secrets. Never commit it.
