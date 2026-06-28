import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env.local"), override: false });

const app = express();
const port = Number(process.env.PORT || 5184);
const oncallosBaseUrl = "https://public.oncallos.com";
const emailOtpTtlMs = 10 * 60 * 1000;
const otpRateLimitFallbackSeconds = 60 * 60;
const devEmailOtpSecret = crypto.randomBytes(32).toString("hex");
const defaultAllowedOrigins =
  process.env.NODE_ENV === "production"
    ? "http://localhost,capacitor://localhost"
    : "http://localhost,http://127.0.0.1,capacitor://localhost";
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || defaultAllowedOrigins)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const countryHeaderNames = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
  "x-country",
  "cloudfront-viewer-country"
];

app.use(express.json({ limit: "32kb" }));

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;

  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origin);
      return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
    } catch {
      return false;
    }
  }

  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Retry-After, X-RateLimit-Remaining-Hour, X-RateLimit-Remaining-Day");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON body."
    });
  }
  return next(error);
});

function normalizeCountryCode(value) {
  const text = String(Array.isArray(value) ? value[0] : value || "")
    .split(",")[0]
    .trim()
    .toUpperCase();

  return /^[A-Z]{2}$/.test(text) ? text : "";
}

function requestCountryCode(req) {
  for (const headerName of countryHeaderNames) {
    const countryCode = normalizeCountryCode(req.headers[headerName]);
    if (countryCode) return countryCode;
  }

  return "";
}

app.get("/api/geo/country", (req, res) => {
  res.json({ countryCode: requestCountryCode(req) });
});

function getApiKey() {
  return process.env.ONCALLOS_API_KEY?.trim();
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  const compact = raw.replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getEmailOtpSecret() {
  const configured = process.env.OTP_EMAIL_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return devEmailOtpSecret;
  return "";
}

function signEmailOtp(value, secret = getEmailOtpSecret()) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function generateNumericCode(codeLength) {
  const length = Math.min(8, Math.max(4, Number(codeLength || 6)));
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(crypto.randomInt(min, max));
}

function createEmailOtpChallenge(email, code, expiresAt) {
  const secret = getEmailOtpSecret();
  const nonce = crypto.randomUUID();
  const payload = {
    email,
    expiresAt,
    nonce,
    codeMac: signEmailOtp(`${email}:${code}:${nonce}`, secret)
  };
  const payloadText = JSON.stringify(payload);
  const payloadToken = Buffer.from(payloadText, "utf8").toString("base64url");
  return `${payloadToken}.${signEmailOtp(payloadToken, secret)}`;
}

function verifyEmailOtpChallenge(email, code, challenge) {
  const secret = getEmailOtpSecret();
  if (!secret || !challenge) return false;

  const [payloadToken, signature] = String(challenge).split(".");
  if (!payloadToken || !signature || !safeEqual(signature, signEmailOtp(payloadToken, secret))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadToken, "base64url").toString("utf8"));
    if (payload.email !== email || Date.parse(payload.expiresAt) < Date.now()) return false;
    return safeEqual(payload.codeMac, signEmailOtp(`${email}:${code}:${payload.nonce}`, secret));
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function positiveSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

function parseRetryAfterSeconds(value) {
  const text = String(value || "").trim();
  if (!text) return 0;

  const directSeconds = positiveSeconds(text);
  if (directSeconds) return directSeconds;

  const retryAt = Date.parse(text);
  if (!Number.isFinite(retryAt)) return 0;
  return positiveSeconds((retryAt - Date.now()) / 1000);
}

function rateLimitedOtpResult(result) {
  if (result.status !== 429) return result;

  const body = result.body && typeof result.body === "object" && !Array.isArray(result.body) ? result.body : {};
  const retryAfterSeconds =
    positiveSeconds(body.retryAfterSeconds) ||
    positiveSeconds(body.retryAfter) ||
    positiveSeconds(body.retry_after) ||
    parseRetryAfterSeconds(result.headers["Retry-After"]) ||
    otpRateLimitFallbackSeconds;

  return {
    ...result,
    headers: {
      ...result.headers,
      "Retry-After": result.headers["Retry-After"] || String(retryAfterSeconds)
    },
    body: {
      ...body,
      success: false,
      error: body.error || body.message || "Too many activation code requests. Please wait before requesting another code.",
      retryAfterSeconds
    }
  };
}

async function deliverEmailOtp(email, code, expiresAt) {
  const from = process.env.OTP_EMAIL_FROM?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_EMAIL_API_TOKEN?.trim();
  const fromName = process.env.OTP_EMAIL_FROM_NAME?.trim() || "Shrine";
  const subject = "Your Shrine activation code";
  const text = `Your Shrine activation code is ${code}. It expires at ${expiresAt}.`;
  const html = `<p>Your Shrine activation code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires at ${escapeHtml(expiresAt)}.</p>`;

  if (from && accountId && apiToken) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: email,
        from: { address: from, name: fromName },
        subject,
        html,
        text
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || "Could not send email OTP.");
    }

    return { delivered: true };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[Shrine email OTP] ${email}: ${code}`);
    return { delivered: false, debugCode: code };
  }

  throw new Error("Email OTP is not configured on this server.");
}

async function forwardOtpRequest(pathname, payload) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      status: 500,
      body: {
        success: false,
        error: "OTP is not configured on this server."
      },
      headers: {}
    };
  }

  const response = await fetch(`${oncallosBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { success: false, error: text || response.statusText };
  }

  return rateLimitedOtpResult({
    status: response.status,
    body,
    headers: {
      "Retry-After": response.headers.get("Retry-After"),
      "X-RateLimit-Remaining-Hour": response.headers.get("X-RateLimit-Remaining-Hour"),
      "X-RateLimit-Remaining-Day": response.headers.get("X-RateLimit-Remaining-Day")
    }
  });
}

app.post("/api/otp/send", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const codeLength = Number(req.body.codeLength || 6);

    if (!/^\+\d{7,15}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: "Phone must be in E.164 format, for example +201234567890."
      });
    }

    const result = await forwardOtpRequest("/api/v1/otp/send", {
      phone,
      codeLength: Math.min(8, Math.max(4, codeLength))
    });

    for (const [key, value] of Object.entries(result.headers || {})) {
      if (value) res.setHeader(key, value);
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : "Could not send OTP."
    });
  }
});

app.all("/api/otp/send", (_req, res) => {
  return res.status(405).json({
    success: false,
    error: "Use POST /api/otp/send with a JSON body."
  });
});

app.post("/api/otp/verify", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = String(req.body.code || "").trim();

    if (!/^\+\d{7,15}$/.test(phone) || !code) {
      return res.status(400).json({
        valid: false,
        error: "Phone and code are required."
      });
    }

    const result = await forwardOtpRequest("/api/v1/otp/verify", { phone, code });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(502).json({
      valid: false,
      error: error instanceof Error ? error.message : "Could not verify OTP."
    });
  }
});

app.all("/api/otp/verify", (_req, res) => {
  return res.status(405).json({
    valid: false,
    error: "Use POST /api/otp/verify with a JSON body."
  });
});

app.post("/api/otp/email/send", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const codeLength = Number(req.body.codeLength || 6);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: "A valid email address is required."
      });
    }

    if (!getEmailOtpSecret()) {
      return res.status(500).json({
        success: false,
        error: "Email OTP is not configured on this server."
      });
    }

    const code = generateNumericCode(codeLength);
    const expiresAt = new Date(Date.now() + emailOtpTtlMs).toISOString();
    const delivery = await deliverEmailOtp(email, code, expiresAt);
    const challenge = createEmailOtpChallenge(email, code, expiresAt);

    return res.json({
      success: true,
      message: "Email activation code sent.",
      expiresAt,
      challenge,
      ...(delivery.debugCode ? { debugCode: delivery.debugCode } : {})
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : "Could not send email OTP."
    });
  }
});

app.all("/api/otp/email/send", (_req, res) => {
  return res.status(405).json({
    success: false,
    error: "Use POST /api/otp/email/send with a JSON body."
  });
});

app.post("/api/otp/email/verify", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || "").trim();
    const challenge = String(req.body.challenge || "").trim();

    if (!/^\S+@\S+\.\S+$/.test(email) || !code || !challenge) {
      return res.status(400).json({
        valid: false,
        error: "Email, code, and challenge are required."
      });
    }

    if (!verifyEmailOtpChallenge(email, code, challenge)) {
      return res.status(400).json({
        valid: false,
        error: "The code is incorrect or expired."
      });
    }

    return res.json({ valid: true });
  } catch (error) {
    return res.status(502).json({
      valid: false,
      error: error instanceof Error ? error.message : "Could not verify email OTP."
    });
  }
});

app.all("/api/otp/email/verify", (_req, res) => {
  return res.status(405).json({
    valid: false,
    error: "Use POST /api/otp/email/verify with a JSON body."
  });
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*splat", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Shrine app running on http://127.0.0.1:${port}`);
});
