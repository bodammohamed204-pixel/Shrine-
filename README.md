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
ALLOWED_ORIGINS=http://localhost,capacitor://localhost
PORT=5184
```

The key is used only by the local Express server. It is not shipped to the browser.

## Build

```bash
npm run build
```

## Production release

Android release packaging is configured with Capacitor. Native builds require a deployed HTTPS backend URL via `VITE_API_BASE_URL`, plus Android upload signing credentials. See `RELEASE.md` for the full store submission checklist and exact build commands.
