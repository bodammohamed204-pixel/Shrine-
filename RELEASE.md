# Shrine Production Release Guide

## Release Status

- App version: `1.0.1`
- Android versionCode: `2`
- Android package id: `com.bodammohamed.shrine`
- Android project: prepared
- Android AAB: dry-run unsigned build was generated locally at `android/app/build/outputs/bundle/release/app-release.aab`
- iOS: not generated or built in this Windows workspace. Requires macOS, Xcode, Apple Developer account, and Apple signing certificates.

The current AAB is **not ready for store upload** because it is unsigned and no production backend URL was provided.

## Required Before Store Upload

1. Deploy the Express backend in `server.js` to a public HTTPS host.
2. Configure the backend environment:
   - `ONCALLOS_API_KEY`
   - `ALLOWED_ORIGINS`
   - `PORT`
   - `NODE_ENV`
3. Configure the mobile/web build environment:
   - `VITE_API_BASE_URL`
4. Provide Android upload signing credentials:
   - `ANDROID_KEYSTORE_PATH`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
5. Host a privacy policy at a public HTTPS URL.
6. Replace the privacy policy placeholder in store metadata.

## Environment Variables

### Backend

`ONCALLOS_API_KEY`
: Oncallos API key with `otp:send` and `otp:verify` scopes. Keep server-side only.

`PORT`
: Server port. Local default is `5184`.

`ALLOWED_ORIGINS`
: Comma-separated list of allowed browser/WebView origins for OTP API calls. Use exact hosted web origins in production; Android/iOS Capacitor commonly needs `capacitor://localhost`. Local development allows localhost ports automatically.

`NODE_ENV`
: Use `production` on the hosted backend so the server serves the built app and skips Vite development middleware.

### Frontend / Native App

`VITE_API_BASE_URL`
: Public HTTPS URL for the deployed Shrine backend. Required for native Android and iOS because `/api/otp/*` cannot run inside the WebView.

### Android Signing

`ANDROID_KEYSTORE_PATH`
: Absolute path to the Play upload keystore file.

`ANDROID_KEYSTORE_PASSWORD`
: Password for the keystore.

`ANDROID_KEY_ALIAS`
: Alias for the upload key.

`ANDROID_KEY_PASSWORD`
: Password for the key alias.

## Android Signing

The Gradle release build is configured to sign the bundle only when all Android signing environment variables are present.

If you do not already have a Play upload key, create one and keep it backed up securely:

```powershell
keytool -genkeypair `
  -v `
  -storetype PKCS12 `
  -keystore C:\secure\shrine-upload-key.p12 `
  -alias shrine-upload `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -dname "CN=Shrine, OU=Mobile, O=Shrine, L=Cairo, ST=Cairo, C=EG"
```

Then set the environment variables:

```powershell
$env:VITE_API_BASE_URL="https://your-production-api.example.com"
$env:ANDROID_KEYSTORE_PATH="C:\secure\shrine-upload-key.p12"
$env:ANDROID_KEYSTORE_PASSWORD="your-keystore-password"
$env:ANDROID_KEY_ALIAS="shrine-upload"
$env:ANDROID_KEY_PASSWORD="your-key-password"
```

## Exact Android Release Commands

```powershell
npm install
$env:VITE_API_BASE_URL="https://book-of-heaven.onholding.workers.dev"
$env:ANDROID_KEYSTORE_PATH="C:\secure\shrine-upload-key.p12"
$env:ANDROID_KEYSTORE_PASSWORD="your-keystore-password"
$env:ANDROID_KEY_ALIAS="shrine-upload"
$env:ANDROID_KEY_PASSWORD="your-key-password"
npm run android:bundle
```

Signed AAB output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Verify signing:

```powershell
jarsigner -verify -verbose -certs android\app\build\outputs\bundle\release\app-release.aab
```

## Cloudflare Worker Deploy

The Cloudflare Worker serves the static app from `dist` and handles the OTP API on the same domain.

```powershell
npm install
npx wrangler login
npx wrangler secret put ONCALLOS_API_KEY
npx wrangler secret put OTP_EMAIL_SECRET
npx wrangler secret put CLOUDFLARE_EMAIL_API_TOKEN
npm run worker:deploy
```

Use API keys and OTP secrets only in Wrangler's secret prompt. Do not put them in `wrangler.jsonc`. `CLOUDFLARE_EMAIL_ACCOUNT_ID` can stay in `wrangler.jsonc` because it is not secret and tells the Worker which Cloudflare account owns the email sender domain.

## iOS Release

iOS cannot be built on this Windows machine. To add and build iOS on macOS:

```bash
npm install
npm install @capacitor/ios --save-dev
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Set bundle id, team, version `1.0.1`, and build number `2`.
2. Configure signing with an Apple Developer team.
3. Create an Archive.
4. Validate and upload to App Store Connect.

## Store Listing

Use `store-assets/listing.md` for:

- App name
- Short description
- Full description
- Asset paths
- Privacy policy status

## Store Assets

Generated assets:

- `store-assets/app-icon-512.png`
- `store-assets/app-store-icon-1024.png`
- `store-assets/feature-graphic-1024x500.png`
- `store-assets/screenshots/phone/01-home.png`
- `store-assets/screenshots/phone/02-add.png`
- `store-assets/screenshots/phone/03-search.png`
- `store-assets/screenshots/phone/04-settings.png`
- `store-assets/privacy-policy-draft.md`

Reference:

- Google Play graphic asset requirements: https://support.google.com/googleplay/android-developer/answer/9866151
- Apple screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications
- Oncallos OTP API documentation: https://oncallos.com/docs/otp

Google Play requirements to check before upload:

- App icon: 512 x 512 PNG, no transparency, max 1 MB.
- Feature graphic: 1024 x 500 PNG or JPEG, max 15 MB.
- Screenshots: 2 to 8 phone screenshots; each side 320 px to 3840 px; max side cannot be more than twice the min side.

Apple App Store requirements to check before upload:

- App icon: 1024 x 1024 PNG or JPEG, no alpha.
- Screenshots: capture required device classes in App Store Connect, commonly 6.9-inch or 6.7-inch iPhone and any additional required sizes shown in your account.

## Debug / Development Configuration Check

Verified:

- `npm run build` succeeds.
- `npm audit --omit=dev` reports zero vulnerabilities.
- Full `npm audit --audit-level=moderate` reports zero vulnerabilities after removing the vulnerable asset generator package.
- Android release build type is used for the AAB dry run.
- Android release builds explicitly set `debuggable false`.
- Android cleartext traffic is disabled.
- Android app-data backup is disabled.
- Oncallos secret is not committed; `.env.local` is ignored.
- OTP API secrets stay server-side and are not bundled into the native app.
- Native OTP calls use `VITE_API_BASE_URL`; no local-only API URL is hardcoded in the app bundle.

Remaining release blockers:

- No hosted production API URL is configured.
- Android upload signing key was not provided, so the generated dry-run AAB is unsigned.
- Privacy policy URL is missing.
- iOS release requires macOS/Xcode and Apple signing credentials.

## Publication Checklist

- [ ] Deploy Cloudflare Worker over HTTPS.
- [ ] Configure `ONCALLOS_API_KEY` with `npx wrangler secret put ONCALLOS_API_KEY`.
- [ ] Set `VITE_API_BASE_URL` to `https://book-of-heaven.onholding.workers.dev` for native builds.
- [ ] Host privacy policy.
- [ ] Add privacy policy URL in Google Play Console.
- [ ] Configure Android upload signing env vars.
- [ ] Run `npm run android:bundle`.
- [ ] Verify AAB signing.
- [ ] Upload signed AAB to Google Play Console.
- [ ] Complete Data Safety form.
- [ ] Upload screenshots and graphics.
- [ ] Fill store listing text.
- [ ] Set content rating and target audience.
- [ ] Run internal testing track before production rollout.
