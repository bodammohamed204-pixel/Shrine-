# Shrine Mobile Web

A mobile-first Shrine-style React app with local account registration, memorial creation, search, settings, profile, blocked users, contact, and custom terms screens.

## Run locally

```bash
npm install
npm run dev
```

The app stores accounts and memorial entries in browser `localStorage`, so the data you enter stays on the same browser/device until storage is cleared.

## Activation OTP

Create `.env.local` from `.env.example` and add your Oncallos API key for WhatsApp OTP. Email OTP uses a signed challenge; in local development the code is printed in the server console unless Cloudflare Email Sending REST credentials are provided:

```bash
ONCALLOS_API_KEY=oc_live_your_key_here
OTP_EMAIL_SECRET=replace-with-a-long-random-secret
OTP_EMAIL_FROM=noreply@yourdomain.com
OTP_EMAIL_FROM_NAME=Shrine
# Optional for real local email sends through Cloudflare Email Sending REST:
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_EMAIL_API_TOKEN=your-email-sending-api-token
ALLOWED_ORIGINS=http://localhost:5184,http://127.0.0.1:5184,http://localhost:5173,http://127.0.0.1:5173,capacitor://localhost
PORT=5184
```

The key is used only by the local Express server. It is not shipped to the browser. If you open Vite directly on `5173`, the frontend automatically sends OTP requests to the local Express API on `5184`.

## Build

```bash
npm run build
```

## Deploy to Cloudflare Workers

The Worker in `worker/index.js` serves the built app and handles `/api/otp/send`, `/api/otp/verify`, `/api/otp/email/send`, and `/api/otp/email/verify` on the same deployed domain.

```bash
npm install
npx wrangler login
npx wrangler secret put ONCALLOS_API_KEY
npx wrangler secret put OTP_EMAIL_SECRET
npm run worker:deploy
```

Use the Oncallos key and email OTP secret as secret values when Wrangler asks for them. For real email delivery, enable Cloudflare Email Sending on your sender domain and replace `OTP_EMAIL_FROM` in `wrangler.jsonc` with an address from that domain. Secrets are stored in Cloudflare and are not bundled into the browser app.

## Production release

Android release packaging is configured with Capacitor. Native builds require a deployed HTTPS backend URL via `VITE_API_BASE_URL`, plus Android upload signing credentials. See `RELEASE.md` for the full store submission checklist and exact build commands.
