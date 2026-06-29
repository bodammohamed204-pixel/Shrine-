const ONCALLOS_BASE_URL = "https://public.oncallos.com";
const PRODUCTION_APP_URL = "https://app.shrine-app.com";
const DEFAULT_META_DESCRIPTION = "Create and share memorial shrines.";
const SHARE_META_START = "<!-- Shrine share preview meta:start -->";
const SHARE_META_END = "<!-- Shrine share preview meta:end -->";
const SHRINE_API_PATH_PREFIX = "/api/shrines/";
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RATE_LIMIT_FALLBACK_SECONDS = 60 * 60;
const COUNTRY_HEADER_NAMES = [
  "CF-IPCountry",
  "X-Vercel-IP-Country",
  "X-Country-Code",
  "X-Country",
  "CloudFront-Viewer-Country"
];
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
    if (host.endsWith(".bodammohamed204.workers.dev")) return true;
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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Remaining-Hour, X-RateLimit-Remaining-Day",
    Vary: "Origin"
  };
}

function publicGeoCorsHeaders(request, env) {
  const trustedHeaders = corsHeaders(request, env);
  if (trustedHeaders["Access-Control-Allow-Origin"]) return trustedHeaders;
  if (!request.headers.get("Origin")) return {};

  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
  };
}

function normalizeCountryCode(value) {
  const text = String(value || "")
    .split(",")[0]
    .trim()
    .toUpperCase();

  return /^[A-Z]{2}$/.test(text) ? text : "";
}

function requestCountryCode(request) {
  const cfCountry = normalizeCountryCode(request.cf?.country);
  if (cfCountry) return cfCountry;

  for (const headerName of COUNTRY_HEADER_NAMES) {
    const countryCode = normalizeCountryCode(request.headers.get(headerName));
    if (countryCode) return countryCode;
  }

  return "";
}

function geoCountry(request, env) {
  return jsonResponse(
    {
      countryCode: requestCountryCode(request)
    },
    200,
    publicGeoCorsHeaders(request, env)
  );
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

function emailOtpPublicError(message, code = "EMAIL_OTP_SEND_FAILED", status = 502) {
  const error = new Error(message);
  error.publicMessage = message;
  error.publicCode = code;
  error.status = status;
  return error;
}

function isEmailSenderConfigurationError(error) {
  const code = String(error?.code || error?.publicCode || "");
  const message = String(error?.message || error || "");

  return (
    code === "E_SENDER_NOT_VERIFIED" ||
    code === "E_SENDER_DOMAIN_NOT_AVAILABLE" ||
    /domain is not owned by the same account/i.test(message) ||
    /sender.*not.*verified/i.test(message) ||
    /sender.*domain.*not.*available/i.test(message)
  );
}

function normalizeEmailOtpError(error) {
  if (error?.publicMessage) {
    return {
      status: error.status || 502,
      errorCode: error.publicCode || "EMAIL_OTP_SEND_FAILED",
      error: error.publicMessage
    };
  }

  if (isEmailSenderConfigurationError(error)) {
    return {
      status: 503,
      errorCode: "EMAIL_OTP_SENDER_UNAVAILABLE",
      error: "Email OTP is temporarily unavailable. Please use WhatsApp or try again later."
    };
  }

  return {
    status: 502,
    errorCode: "EMAIL_OTP_SEND_FAILED",
    error: error instanceof Error ? error.message : "Could not send email OTP."
  };
}

function normalizeBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/$/, "");
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function requestBaseUrl(request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

function appBaseUrl(env, request) {
  const configuredBase = normalizeBaseUrl(env.VITE_APP_URL || env.APP_URL || env.VITE_SHARE_BASE_URL);
  return configuredBase || requestBaseUrl(request) || PRODUCTION_APP_URL;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanShareId(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function isLongGeneratedShrineId(value) {
  return /^\d{10,}-[a-zA-Z0-9_-]+$/.test(String(value || "").trim());
}

function isShortPublicIdCandidate(value) {
  const text = cleanShareId(value);
  if (!text) return false;
  if (/^\d+$/.test(text)) return true;
  return text.length <= 24 && !isLongGeneratedShrineId(text);
}

function shrineInfoPath(personId) {
  return `/shrines/${encodeURIComponent(personId)}/info`;
}

function shrineCommentPath(personId, commentId) {
  return `/shrines/${encodeURIComponent(personId)}/comments/${encodeURIComponent(commentId)}`;
}

function shrineApiPath(personId) {
  return `${SHRINE_API_PATH_PREFIX}${encodeURIComponent(personId)}`;
}

function shrineCommentApiPath(personId, commentId) {
  return `${shrineApiPath(personId)}/comments/${encodeURIComponent(commentId)}`;
}

function shrineInfoMatch(pathname) {
  return String(pathname || "").match(/^\/shrines\/([^/]+)\/(?:info|comments\/info)\/?$/i);
}

function shrineCommentMatch(pathname) {
  const match = String(pathname || "").match(/^\/shrines\/([^/]+)\/comments\/([^/]+)\/?$/i);
  return match && String(match[2] || "").toLowerCase() !== "info" ? match : null;
}

function shrineApiMatch(pathname) {
  return String(pathname || "").match(/^\/api\/shrines\/([^/]+)\/?$/i);
}

function shrineCommentApiMatch(pathname) {
  return String(pathname || "").match(/^\/api\/shrines\/([^/]+)\/comments\/([^/]+)\/?$/i);
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function shrinePreviewDescription(name, birthDate, deathDate) {
  const previewName = name || "this shrine";
  const dateText = [birthDate, deathDate].filter(Boolean).join(" - ");
  return `In loving memory of ${previewName}.${dateText ? ` ${dateText}` : ""}`;
}

function previewText(value, maxLength = 100) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function defaultAvatarUrl(env, request) {
  return `${appBaseUrl(env, request)}/share/default-avatar.svg`;
}

function httpsImageUrl(value, env) {
  const text = String(value || "").trim();
  if (!text || text.startsWith("data:")) return "";

  try {
    const url = text.startsWith("//")
      ? new URL(`https:${text}`)
      : /^https?:\/\//i.test(text)
        ? new URL(text)
        : new URL(text, `${PRODUCTION_APP_URL}/`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
}

function publicShrineIdFromSource(source, fallbackId) {
  const explicitId = firstText(
    source.publicId,
    source.public_id,
    source.shareId,
    source.share_id,
    source.shortId,
    source.short_id,
    source.shortSlug,
    source.short_slug,
    source.slug,
    source.numericId,
    source.numeric_id,
    source.shrineNumber,
    source.shrine_number
  );
  const cleanExplicitId = cleanShareId(explicitId);
  if (cleanExplicitId) return cleanExplicitId;

  const sourceId = firstText(source.id);
  if (
    sourceId &&
    cleanShareId(sourceId) !== cleanShareId(fallbackId) &&
    isShortPublicIdCandidate(sourceId)
  ) {
    return cleanShareId(sourceId);
  }

  return "";
}

function normalizeShrineApiData(data, fallbackId) {
  const source = data?.shrine || data?.person || data?.data || data;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;

  const fullName = firstText(source.fullName, source.full_name, source.name, source.title);
  if (!fullName) return null;

  return {
    id: firstText(source.id, source._id, source.shrineId, source.shrine_id, fallbackId),
    publicId: publicShrineIdFromSource(source, fallbackId),
    fullName,
    photo: firstText(
      source.photo,
      source.photoUrl,
      source.photo_url,
      source.photoPath,
      source.photo_path,
      source.image,
      source.imageUrl,
      source.image_url,
      source.imagePath,
      source.image_path,
      source.avatar,
      source.avatarUrl,
      source.avatar_url,
      source.avatarPath,
      source.avatar_path,
      source.profilePhoto,
      source.profile_photo,
      source.profilePhotoPath,
      source.profile_photo_path
    ),
    birthDate: firstText(source.birthDate, source.birth_date, source.birth),
    deathDate: firstText(source.deathDate, source.death_date, source.death),
    info: firstText(source.info, source.description, source.bio),
    createdByName: firstText(source.createdByName, source.created_by_name, source.creatorName, source.creator_name),
    messages: Array.isArray(source.messages) ? source.messages : Array.isArray(source.comments) ? source.comments : []
  };
}

function normalizeCommentApiData(data, fallbackId) {
  const source = data?.comment || data?.message || data?.data || data;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;

  const text = firstText(source.text, source.body, source.content, source.message, source.description);
  const attachment = firstText(
    source.attachment,
    source.attachmentUrl,
    source.attachment_url,
    source.attachmentPath,
    source.attachment_path,
    source.image,
    source.imageUrl,
    source.image_url,
    source.imagePath,
    source.image_path,
    source.media,
    source.mediaUrl,
    source.media_url,
    source.mediaPath,
    source.media_path
  );
  if (!text && !attachment) return null;

  const user = source.user && typeof source.user === "object" ? source.user : {};
  const author = source.author && typeof source.author === "object" ? source.author : {};
  const commenter = source.commenter && typeof source.commenter === "object" ? source.commenter : {};

  return {
    id: firstText(source.id, source._id, source.commentId, source.comment_id, source.messageId, source.message_id, fallbackId),
    text,
    attachment,
    userName: firstText(
      source.userName,
      source.user_name,
      source.commenterName,
      source.commenter_name,
      source.authorName,
      source.author_name,
      user.name,
      author.name,
      commenter.name
    ),
    userPhoto: firstText(
      source.userPhoto,
      source.userPhotoUrl,
      source.user_photo_url,
      source.userPhotoPath,
      source.user_photo_path,
      source.avatar,
      source.avatarUrl,
      source.avatar_url,
      source.avatarPath,
      source.avatar_path,
      source.profilePhoto,
      source.profile_photo,
      source.profilePhotoPath,
      source.profile_photo_path,
      user.photo,
      user.photoUrl,
      user.photo_url,
      user.photoPath,
      user.photo_path,
      user.avatar,
      user.avatarUrl,
      user.avatar_url,
      user.avatarPath,
      user.avatar_path,
      user.profilePhoto,
      user.profile_photo,
      user.profilePhotoPath,
      user.profile_photo_path,
      author.photo,
      author.photoUrl,
      author.photo_url,
      author.photoPath,
      author.photo_path,
      author.avatar,
      author.avatarUrl,
      author.avatar_url,
      author.avatarPath,
      author.avatar_path,
      commenter.photo,
      commenter.photoUrl,
      commenter.photo_url,
      commenter.photoPath,
      commenter.photo_path,
      commenter.avatar,
      commenter.avatarUrl,
      commenter.avatar_url,
      commenter.avatarPath,
      commenter.avatar_path
    )
  };
}

function configuredShrineApiBaseUrl(env) {
  return normalizeBaseUrl(env.SHRINE_API_BASE_URL || env.API_BASE_URL || env.VITE_API_BASE_URL);
}

function sameOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchShrineFromApi(personId, request, env, { allowSameOrigin = true } = {}) {
  const configuredBase = configuredShrineApiBaseUrl(env);
  const requestOrigin = new URL(request.url).origin;
  const baseUrl = configuredBase || (allowSameOrigin ? requestOrigin : "");
  if (!baseUrl || (!allowSameOrigin && sameOrigin(baseUrl, request.url))) return null;

  try {
    const response = await fetch(`${baseUrl}${shrineApiPath(personId)}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;

    return normalizeShrineApiData(await readJsonResponse(response), personId);
  } catch {
    return null;
  }
}

function findCommentInShrine(shrine, commentId) {
  if (commentId === "info" && (shrine?.info || shrine?.photo)) {
    return {
      id: "info",
      text: shrine.info || shrine.fullName || "",
      attachment: shrine.photo || "",
      userName: shrine.createdByName || "Shrine",
      userPhoto: ""
    };
  }

  const messages = Array.isArray(shrine?.messages) ? shrine.messages : [];
  const found = messages.find((message) => String(message?.id || message?.commentId || message?.messageId || "") === String(commentId));
  return found ? normalizeCommentApiData(found, commentId) : null;
}

async function fetchCommentFromApi(personId, commentId, request, env, { allowSameOrigin = true } = {}) {
  const configuredBase = configuredShrineApiBaseUrl(env);
  const requestOrigin = new URL(request.url).origin;
  const baseUrl = configuredBase || (allowSameOrigin ? requestOrigin : "");
  if (!baseUrl || (!allowSameOrigin && sameOrigin(baseUrl, request.url))) return null;

  try {
    const response = await fetch(`${baseUrl}${shrineCommentApiPath(personId, commentId)}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (response.ok) {
      const comment = normalizeCommentApiData(await readJsonResponse(response), commentId);
      if (comment) return comment;
    }
  } catch {
    // Fall through to the shrine-level payload fallback below.
  }

  const shrine = await fetchShrineFromApi(personId, request, env, { allowSameOrigin });
  return findCommentInShrine(shrine, commentId);
}

async function shrineApiResponse(request, env, personId) {
  const shrine = await fetchShrineFromApi(personId, request, env, { allowSameOrigin: false });
  if (!shrine) {
    return jsonResponse({ success: false, error: "Shrine not found." }, 404, corsHeaders(request, env));
  }

  return jsonResponse({ success: true, shrine }, 200, corsHeaders(request, env));
}

async function shrineCommentApiResponse(request, env, personId, commentId) {
  const comment = await fetchCommentFromApi(personId, commentId, request, env, { allowSameOrigin: false });
  if (!comment) {
    return jsonResponse({ success: false, error: "Comment not found." }, 404, corsHeaders(request, env));
  }

  return jsonResponse({ success: true, comment }, 200, corsHeaders(request, env));
}

function shrinePreviewMeta(personId, shrine, env, request) {
  const sharePersonId = firstText(shrine?.publicId, personId);
  const baseUrl = appBaseUrl(env, request);
  const fallbackImage = httpsImageUrl(env.SHARE_IMAGE_URL, env) || defaultAvatarUrl(env, request);
  const image = httpsImageUrl(shrine?.photo, env) || fallbackImage;
  const title = shrine?.fullName || "Shrine";
  console.log("[share-preview] shrine og:image", image || "(none)");

  return {
    title,
    description: shrine
      ? shrinePreviewDescription(shrine.fullName, shrine.birthDate, shrine.deathDate)
      : DEFAULT_META_DESCRIPTION,
    url: sharePersonId ? `${baseUrl}${shrineInfoPath(sharePersonId)}` : baseUrl,
    image
  };
}

function shrineCommentPreviewMeta(personId, commentId, shrine, comment, env, request) {
  const sharePersonId = firstText(shrine?.publicId, personId);
  const baseUrl = appBaseUrl(env, request);
  const fallbackImage = httpsImageUrl(env.SHARE_IMAGE_URL, env) || defaultAvatarUrl(env, request);
  const titleParts = [shrine?.fullName || "Shrine", comment?.userName || "Guest"].filter(Boolean);
  const image =
    httpsImageUrl(comment?.userPhoto, env) ||
    httpsImageUrl(comment?.attachment, env) ||
    httpsImageUrl(shrine?.photo, env) ||
    fallbackImage;
  console.log("[share-preview] shrine comment og:image", image || "(none)");

  return {
    title: titleParts.join(" - "),
    description: previewText(comment?.text || shrine?.info || DEFAULT_META_DESCRIPTION),
    url: sharePersonId ? `${baseUrl}${shrineCommentPath(sharePersonId, commentId || "info")}` : baseUrl,
    image
  };
}

function openGraphTags(meta) {
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Shrine" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`
  ];

  if (meta.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}" />`);
    tags.push(`<meta property="og:image:width" content="300" />`);
    tags.push(`<meta property="og:image:height" content="300" />`);
  }

  return tags.map((tag) => `    ${tag}`).join("\n");
}

function replaceOrAppend(html, pattern, replacement, beforeNeedle) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace(beforeNeedle, `${replacement}\n    ${beforeNeedle}`);
}

function injectSharePreviewMeta(html, meta) {
  const metaBlock = `${SHARE_META_START}\n${openGraphTags(meta)}\n    ${SHARE_META_END}`;
  const escapedStart = SHARE_META_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = SHARE_META_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const metaBlockPattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "i");

  let nextHtml = metaBlockPattern.test(html) ? html.replace(metaBlockPattern, metaBlock) : html.replace("</head>", `${metaBlock}\n    </head>`);
  nextHtml = replaceOrAppend(
    nextHtml,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(meta.title)}</title>`,
    "</head>"
  );
  nextHtml = replaceOrAppend(
    nextHtml,
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    "</head>"
  );
  nextHtml = replaceOrAppend(
    nextHtml,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    "</head>"
  );

  return nextHtml;
}

async function shrineInfoPage(request, env, url) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = "/";
  assetUrl.search = "";

  const assetResponse = await env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: "GET",
      headers: request.headers
    })
  );
  const contentType = assetResponse.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return assetResponse;

  const html = await assetResponse.text();
  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.delete("Content-Length");

  const match = shrineInfoMatch(url.pathname);
  const personId = match ? safeDecodeURIComponent(match[1]) : "";
  const shrine = personId ? await fetchShrineFromApi(personId, request, env) : null;

  return new Response(injectSharePreviewMeta(html, shrinePreviewMeta(personId, shrine, env, request)), {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
}

async function shrineCommentPage(request, env, url) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = "/";
  assetUrl.search = "";

  const assetResponse = await env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: "GET",
      headers: request.headers
    })
  );
  const contentType = assetResponse.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return assetResponse;

  const html = await assetResponse.text();
  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.delete("Content-Length");

  const match = shrineCommentMatch(url.pathname);
  const personId = match ? safeDecodeURIComponent(match[1]) : "";
  const commentId = match ? safeDecodeURIComponent(match[2]) : "";
  const [shrine, comment] = personId && commentId
    ? await Promise.all([
        fetchShrineFromApi(personId, request, env),
        fetchCommentFromApi(personId, commentId, request, env)
      ])
    : [null, null];

  return new Response(injectSharePreviewMeta(html, shrineCommentPreviewMeta(personId, commentId, shrine, comment, env, request)), {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
}

function defaultAvatarImage() {
  const headers = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400"
  };

  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#dff5ff"/>
      <circle cx="600" cy="245" r="112" fill="#ffffff"/>
      <path d="M352 536c38-120 130-186 248-186s210 66 248 186" fill="#ffffff"/>
      <text x="600" y="590" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#1f8edc">Shrine</text>
    </svg>`,
    { headers }
  );
}

function defaultAvatarHead() {
  return new Response(null, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400"
    }
  });
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
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
    OTP_RATE_LIMIT_FALLBACK_SECONDS;

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

  return rateLimitedOtpResult({ status: response.status, body, headers });
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

async function sendEmailOtpWithRestApi({ email, from, fromName, subject, html, text }, env) {
  const accountId = String(env.CLOUDFLARE_EMAIL_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const apiToken = String(env.CLOUDFLARE_EMAIL_API_TOKEN || "").trim();

  if (!accountId || !apiToken) return false;

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

  if (response.ok) return true;

  const responseText = await response.text();
  let message = responseText || "Could not send email OTP.";
  try {
    const body = JSON.parse(responseText);
    const messages = Array.isArray(body.errors) ? body.errors.map((item) => item.message).filter(Boolean) : [];
    message = messages.join("; ") || body.message || message;
  } catch {
    // Keep the raw response text when Cloudflare does not return JSON.
  }

  throw emailOtpPublicError(
    isEmailSenderConfigurationError(message)
      ? "Email OTP is temporarily unavailable. Please use WhatsApp or try again later."
      : "Could not send email OTP.",
    isEmailSenderConfigurationError(message) ? "EMAIL_OTP_SENDER_UNAVAILABLE" : "EMAIL_OTP_SEND_FAILED",
    isEmailSenderConfigurationError(message) ? 503 : 502
  );
}

async function deliverEmailOtp(email, code, expiresAt, env) {
  const from = String(env.OTP_EMAIL_FROM || "").trim();
  const fromName = String(env.OTP_EMAIL_FROM_NAME || "Shrine").trim();
  const subject = "Your Shrine activation code";
  const html = `<p>Your Shrine activation code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires at ${escapeHtml(expiresAt)}.</p>`;
  const text = `Your Shrine activation code is ${code}. It expires at ${expiresAt}.`;

  if (!from) {
    throw emailOtpPublicError("Email OTP is not configured on this server.", "EMAIL_OTP_NOT_CONFIGURED", 500);
  }

  const sentWithRestApi = await sendEmailOtpWithRestApi({ email, from, fromName, subject, html, text }, env);
  if (sentWithRestApi) return;

  if (!env.EMAIL) {
    throw emailOtpPublicError("Email OTP is not configured on this server.", "EMAIL_OTP_NOT_CONFIGURED", 500);
  }

  await env.EMAIL.send({
    to: email,
    from: { email: from, name: fromName },
    subject,
    html,
    text
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
    const publicError = normalizeEmailOtpError(error);
    return jsonResponse(
      {
        success: false,
        error: publicError.error,
        errorCode: publicError.errorCode
      },
      publicError.status,
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

function assetsNotConfigured(request, env) {
  return jsonResponse(
    {
      success: false,
      error: "App assets are not configured for share pages."
    },
    500,
    corsHeaders(request, env)
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/share/default-avatar.svg") {
      if (request.method === "HEAD") return defaultAvatarHead();
      if (request.method === "GET") return defaultAvatarImage();
    }

    if (request.method === "GET" && shrineCommentMatch(url.pathname)) {
      if (!env.ASSETS) return assetsNotConfigured(request, env);
      return shrineCommentPage(request, env, url);
    }

    if (request.method === "GET" && shrineInfoMatch(url.pathname)) {
      if (!env.ASSETS) return assetsNotConfigured(request, env);
      return shrineInfoPage(request, env, url);
    }

    if (request.method === "OPTIONS" && url.pathname === "/api/geo/country") {
      return new Response(null, { status: 204, headers: publicGeoCorsHeaders(request, env) });
    }

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/otp/")) {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method === "OPTIONS" && shrineApiMatch(url.pathname)) {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method === "OPTIONS" && shrineCommentApiMatch(url.pathname)) {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (url.pathname === "/api/geo/country") {
      if (request.method !== "GET") {
        return methodNotAllowed(request, env, "Use GET /api/geo/country.");
      }
      return geoCountry(request, env);
    }

    const shrineApi = shrineApiMatch(url.pathname);
    if (shrineApi) {
      if (request.method !== "GET") {
        return methodNotAllowed(request, env, "Use GET /api/shrines/:id.");
      }
      return shrineApiResponse(request, env, safeDecodeURIComponent(shrineApi[1]));
    }

    const shrineCommentApi = shrineCommentApiMatch(url.pathname);
    if (shrineCommentApi) {
      if (request.method !== "GET") {
        return methodNotAllowed(request, env, "Use GET /api/shrines/:id/comments/:commentId.");
      }
      return shrineCommentApiResponse(
        request,
        env,
        safeDecodeURIComponent(shrineCommentApi[1]),
        safeDecodeURIComponent(shrineCommentApi[2])
      );
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

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse({ success: false, error: "Not found." }, 404, corsHeaders(request, env));
  }
};
