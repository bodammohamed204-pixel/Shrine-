import "dotenv/config";
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
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
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

function getApiKey() {
  return process.env.ONCALLOS_API_KEY?.trim();
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  const compact = raw.replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

async function forwardOtpRequest(pathname, payload) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      status: 500,
      body: {
        success: false,
        error: "OTP is not configured on this server."
      }
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

  return {
    status: response.status,
    body,
    headers: {
      "Retry-After": response.headers.get("Retry-After"),
      "X-RateLimit-Remaining-Hour": response.headers.get("X-RateLimit-Remaining-Hour"),
      "X-RateLimit-Remaining-Day": response.headers.get("X-RateLimit-Remaining-Day")
    }
  };
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

    for (const [key, value] of Object.entries(result.headers)) {
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
