# Shrine Mobile Web

A mobile-first Shrine-style React app with local account registration, memorial creation, search, settings, profile, blocked users, contact, and custom terms screens.

## Run locally

```bash
npm install
npm run dev
```

The app stores accounts and memorial entries in browser `localStorage`, so the data you enter stays on the same browser/device until storage is cleared.

## WhatsApp OTP

Create `.env.local` from `.env.example` and add your Oncallos API key:

```bash
ONCALLOS_API_KEY=oc_live_your_key_here
ALLOWED_ORIGINS=http://localhost:5184,http://127.0.0.1:5184,http://localhost:5173,http://127.0.0.1:5173,capacitor://localhost
PORT=5184
```

The key is used only by the local Express server. It is not shipped to the browser. If you open Vite directly on `5173`, the frontend automatically sends OTP requests to the local Express API on `5184`.

## Build

```bash
npm run build
```

## Deploy to Cloudflare Workers

The Worker in `worker/index.js` serves the built app and handles `/api/otp/send` and `/api/otp/verify` on the same deployed domain.

```bash
npm install
npx wrangler login
npx wrangler secret put ONCALLOS_API_KEY
npm run worker:deploy
```

Use the Oncallos key as the secret value when Wrangler asks for it. The key is stored in Cloudflare and is not bundled into the browser app.

## Production release

Android release packaging is configured with Capacitor. Native builds require a deployed HTTPS backend URL via `VITE_API_BASE_URL`, plus Android upload signing credentials. See `RELEASE.md` for the full store submission checklist and exact build commands.
