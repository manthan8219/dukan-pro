# DukaanPro — Web frontend

Vite + React + TypeScript. Copy `.env.example` to `.env.local` and set API URL, Firebase, and Google Maps keys as needed.

```bash
npm install
npm run dev
```

## Deploy on Vercel

1. Import this repo; Vercel should detect **Vite** (`vercel.json` sets build output and SPA routing).
2. Under **Settings → Environment Variables**, add every `VITE_*` variable from `.env.example` (Production / Preview as needed). Use your **production** API URL for `VITE_API_URL`.
3. In **Firebase Console → Authentication → Settings → Authorized domains**, add your Vercel domain (e.g. `your-app.vercel.app`).
4. In **Google Cloud**, restrict the Maps JavaScript API key by HTTP referrer to your Vercel domain.

### Cursor: Vercel plugin

To install the official Vercel agent plugin locally (improves deploy/env guidance in Cursor):

```bash
npx plugins add vercel/vercel-plugin --target cursor
```

If the CLI cannot find Cursor on `PATH`, run the same command from a terminal where `cursor` is available, or omit `--target` when supported.
