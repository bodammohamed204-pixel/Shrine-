const ONCALLOS_BASE_URL = "https://public.oncallos.com";
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function allowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function isTrustedPreviewOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    const host = hostname.toLowerCase();

    if (protocol !== "https:") return false;
    if (host === "book-of-heaven.onholding.workers.dev") return true;
    if (host === "book-of-heaven.bodammohamed204.workers.dev") return true;
    if (host === "bodammohamed204.workers.dev") return true;
    return host.endsWith(".pages.dev") && host.includes("shrine");
  } catch {
    return false;
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const origins = allowedOrigins(env);
  if (!origin || (!origins.has("*") && !origins.has(origin) && !isTrustedPreviewOrigin(origin))) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin"
  };
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  const compact = raw.replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return decoder.decode(bytes);
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function getEmailOtpSecret(env) {
  return String(env.OTP_EMAIL_SECRET || env.ONCALLOS_API_KEY || "").trim();
}

async function signEmailOtp(value, env) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getEmailOtpSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function generateNumericCode(codeLength) {
  const length = Math.min(8, Math.max(4, Number(codeLength || 6)));
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 10)).join("");
}

async function createEmailOtpChallenge(email, code, expiresAt, env) {
  const nonce = crypto.randomUUID();
  const payload = {
    email,
    expiresAt,
    nonce,
    codeMac: await signEmailOtp(`${email}:${code}:${nonce}`, env)
  };
  const payloadToken = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  return `${payloadToken}.${await signEmailOtp(payloadToken, env)}`;
}

async function verifyEmailOtpChallenge(email, code, challenge, env) {
  if (!getEmailOtpSecret(env) || !challenge) return false;

  const [payloadToken, signature] = String(challenge).split(".");
  if (!payloadToken || !signature || !safeEqual(signature, await signEmailOtp(payloadToken, env))) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadToken));
    if (payload.email !== email || Date.parse(payload.expiresAt) < Date.now()) return false;
    const expectedCodeMac = await signEmailOtp(`${email}:${code}:${payload.nonce}`, env);
    return safeEqual(payload.codeMac, expectedCodeMac);
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

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function forwardOtpRequest(pathname, payload, env) {
  const apiKey = String(env.ONCALLOS_API_KEY || "").trim();
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

  const response = await fetch(`${ONCALLOS_BASE_URL}${pathname}`, {
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

  const headers = {};
  for (const key of ["Retry-After", "X-RateLimit-Remaining-Hour", "X-RateLimit-Remaining-Day"]) {
    const value = response.headers.get(key);
    if (value) headers[key] = value;
  }

  return { status: response.status, body, headers };
}

async function sendOtp(request, env) {
  const body = await parseJson(request);
  if (!body) {
    return jsonResponse({ success: false, error: "Invalid JSON body." }, 400, corsHeaders(request, env));
  }

  const phone = normalizePhone(body.phone);
  const codeLength = Number(body.codeLength || 6);

  if (!/^\+\d{7,15}$/.test(phone)) {
    return jsonResponse(
      { success: false, error: "Phone must be in E.164 format, for example +201234567890." },
      400,
      corsHeaders(request, env)
    );
  }

  const result = await forwardOtpRequest(
    "/api/v1/otp/send",
    { phone, codeLength: Math.min(8, Math.max(4, codeLength)) },
    env
  );

  return jsonResponse(result.body, result.status, { ...corsHeaders(request, env), ...result.headers });
}

async function verifyOtp(request, env) {
  const body = await parseJson(request);
  if (!body) {
    return jsonResponse({ valid: false, error: "Invalid JSON body." }, 400, corsHeaders(request, env));
  }

  const phone = normalizePhone(body.phone);
  const code = String(body.code || "").trim();

  if (!/^\+\d{7,15}$/.test(phone) || !code) {
    return jsonResponse({ valid: false, error: "Phone and code are required." }, 400, corsHeaders(request, env));
  }

  const result = await forwardOtpRequest("/api/v1/otp/verify", { phone, code }, env);
  return jsonResponse(result.body, result.status, { ...corsHeaders(request, env), ...result.headers });
}

async function deliverEmailOtp(email, code, expiresAt, env) {
  const from = String(env.OTP_EMAIL_FROM || "").trim();
  const fromName = String(env.OTP_EMAIL_FROM_NAME || "Shrine").trim();

  if (!env.EMAIL || !from) {
    throw new Error("Email OTP is not configured on this server.");
  }

  await env.EMAIL.send({
    to: email,
    from: { email: from, name: fromName },
    subject: "Your Shrine activation code",
    html: `<p>Your Shrine activation code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires at ${escapeHtml(expiresAt)}.</p>`,
    text: `Your Shrine activation code is ${code}. It expires at ${expiresAt}.`
  });
}

async function sendEmailOtp(request, env) {
  const body = await parseJson(request);
  if (!body) {
    return jsonResponse({ success: false, error: "Invalid JSON body." }, 400, corsHeaders(request, env));
  }

  const email = normalizeEmail(body.email);
  const codeLength = Number(body.codeLength || 6);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return jsonResponse({ success: false, error: "A valid email address is required." }, 400, corsHeaders(request, env));
  }

  if (!getEmailOtpSecret(env)) {
    return jsonResponse(
      { success: false, error: "Email OTP is not configured on this server." },
      500,
      corsHeaders(request, env)
    );
  }

  try {
    const code = generateNumericCode(codeLength);
    const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS).toISOString();
    await deliverEmailOtp(email, code, expiresAt, env);
    const challenge = await createEmailOtpChallenge(email, code, expiresAt, env);

    return jsonResponse(
      {
        success: true,
        message: "Email activation code sent.",
        expiresAt,
        challenge
      },
      200,
      corsHeaders(request, env)
    );
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not send email OTP."
      },
      502,
      corsHeaders(request, env)
    );
  }
}

async function verifyEmailOtp(request, env) {
  const body = await parseJson(request);
  if (!body) {
    return jsonResponse({ valid: false, error: "Invalid JSON body." }, 400, corsHeaders(request, env));
  }

  const email = normalizeEmail(body.email);
  const code = String(body.code || "").trim();
  const challenge = String(body.challenge || "").trim();

  if (!/^\S+@\S+\.\S+$/.test(email) || !code || !challenge) {
    return jsonResponse({ valid: false, error: "Email, code, and challenge are required." }, 400, corsHeaders(request, env));
  }

  if (!(await verifyEmailOtpChallenge(email, code, challenge, env))) {
    return jsonResponse({ valid: false, error: "The code is incorrect or expired." }, 400, corsHeaders(request, env));
  }

  return jsonResponse({ valid: true }, 200, corsHeaders(request, env));
}

function methodNotAllowed(request, env, message) {
  return jsonResponse({ success: false, error: message }, 405, corsHeaders(request, env));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/otp/")) {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (url.pathname === "/api/otp/email/send") {
      if (request.method !== "POST") {
        return methodNotAllowed(request, env, "Use POST /api/otp/email/send with a JSON body.");
      }
      return sendEmailOtp(request, env);
    }

    if (url.pathname === "/api/otp/email/verify") {
      if (request.method !== "POST") {
        return methodNotAllowed(request, env, "Use POST /api/otp/email/verify with a JSON body.");
      }
      return verifyEmailOtp(request, env);
    }

    if (url.pathname === "/api/otp/send") {
      if (request.method !== "POST") {
        return methodNotAllowed(request, env, "Use POST /api/otp/send with a JSON body.");
      }
      return sendOtp(request, env);
    }

    if (url.pathname === "/api/otp/verify") {
      if (request.method !== "POST") {
        return methodNotAllowed(request, env, "Use POST /api/otp/verify with a JSON body.");
      }
      return verifyOtp(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
