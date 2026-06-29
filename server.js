import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
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
const liveDataPath = path.join(__dirname, ".data", "live-admin.json");
const adminSessionTtlMs = 12 * 60 * 60 * 1000;
const emailOtpTtlMs = 10 * 60 * 1000;
const otpRateLimitFallbackSeconds = 60 * 60;
const devEmailOtpSecret = crypto.randomBytes(32).toString("hex");
const publicMediaMaxLength = 650000;
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

app.use(express.json({ limit: "2mb" }));

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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
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

app.get("/api/live", async (_req, res) => {
  const data = await readLiveData();
  res.setHeader("Cache-Control", "no-store");
  return res.json({ success: true, storageConfigured: true, live: publicLivePayload(data) });
});

app.post("/api/live/sync", async (req, res) => {
  const current = await readLiveData();
  const incomingUsers = [
    ...ensureArray(req.body.users),
    ...(req.body.currentUser ? [req.body.currentUser] : [])
  ].map(normalizeLiveUser).filter(Boolean);
  const incomingShrines = ensureArray(req.body.people || req.body.shrines).map(normalizeLiveShrine).filter(Boolean);
  const next = await writeLiveData({
    ...current,
    users: mergeById(current.users, incomingUsers, current.removedUserIds),
    shrines: mergeById(current.shrines, incomingShrines),
    comments: mergeById(current.comments, incomingShrines.flatMap((shrine) => ensureArray(shrine.messages)), current.removedCommentIds)
  });
  res.setHeader("Cache-Control", "no-store");
  return res.json({ success: true, storageConfigured: true, live: publicLivePayload(next) });
});

app.post("/api/contact", async (req, res) => {
  const message = normalizeContactMessage(req.body);
  if (!message) {
    return res.status(400).json({ success: false, error: "Message is required." });
  }

  const current = await readLiveData();
  await writeLiveData({
    ...current,
    contactMessages: [message, ...current.contactMessages]
  });
  return res.json({ success: true, message });
});

app.post("/api/admin/login", async (req, res) => {
  const secret = adminSecret();
  const identifier = adminIdentifierInput(req.body);
  const accessKey = String(firstText(req.body.accessKey, req.body.password, req.body.token) || "").trim();

  if (!secret) {
    return res.status(503).json({ success: false, error: "Admin token is not configured." });
  }

  if (accessKey && !safeEqual(accessKey, secret)) {
    return res.status(401).json({ success: false, error: "Invalid admin key." });
  }

  const data = await readLiveData();

  if (!(await adminIdentifierAllowed(identifier, data))) {
    return res.status(403).json({ success: false, error: "This admin identifier is not allowed." });
  }

  if (!findAdminAccount(data, identifier)) {
    return res.status(404).json({ success: false, error: "This admin must have an existing user account first." });
  }

  return res.json({
    success: true,
    sessionToken: createAdminSession(identifier),
    identifier: normalizeAdminIdentifier(identifier),
    expiresInSeconds: adminSessionTtlMs / 1000
  });
});

app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
  const data = await readLiveData();
  res.setHeader("Cache-Control", "no-store");
  return res.json({ success: true, dashboard: liveDashboardPayload(data) });
});

app.patch("/api/admin/terms", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const terms = normalizeTermsSections(req.body?.terms || req.body);
  await writeLiveData({ ...data, terms });
  return res.json({ success: true, terms });
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const id = String(req.params.id || "").trim();
  await writeLiveData({
    ...data,
    removedUserIds: uniqueStrings([...data.removedUserIds, id]),
    users: data.users.filter((user) => user.id !== id)
  });
  return res.json({ success: true });
});

app.post("/api/admin/admins", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const identifier = adminIdentifierInput(req.body);
  const account = findAdminAccount(data, identifier);
  if (!account) {
    return res.status(404).json({ success: false, error: "This admin must have an existing user account first." });
  }

  const admin = normalizeLiveAdmin({
    identifier,
    label: firstText(req.body?.label, req.body?.name, account.name, `${account.firstName || ""} ${account.surname || ""}`, account.email, account.otpPhone),
    createdBy: req.body?.createdBy
  });
  if (!admin) {
    return res.status(400).json({ success: false, error: "A valid admin email or phone is required." });
  }

  const existing = dashboardAdmins(data).some((item) =>
    adminIdentifierVariants(item.identifier).some((variant) => adminIdentifierVariants(admin.identifier).includes(variant))
  );
  if (existing) {
    return res.status(409).json({ success: false, error: "This admin already exists." });
  }

  await writeLiveData({
    ...data,
    admins: mergeById(data.admins, [admin])
  });
  return res.json({ success: true, admin });
});

app.delete("/api/admin/admins/:id", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const identifier = normalizeAdminIdentifier(req.params.id);
  const configured = configuredAdminIdentifierSet();
  const deleteVariants = new Set(adminIdentifierVariants(identifier));
  if (Array.from(deleteVariants).some((variant) => configured.has(variant))) {
    return res.status(400).json({ success: false, error: "Configured admin identifiers cannot be removed from the dashboard." });
  }

  await writeLiveData({
    ...data,
    admins: data.admins.filter((admin) => !adminIdentifierVariants(admin.identifier).some((variant) => deleteVariants.has(variant)))
  });
  return res.json({ success: true });
});

app.delete("/api/admin/comments/:id", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const id = String(req.params.id || "").trim();
  await writeLiveData({
    ...data,
    removedCommentIds: uniqueStrings([...data.removedCommentIds, id]),
    comments: data.comments.filter((comment) => comment.id !== id),
    shrines: data.shrines.map((shrine) => ({
      ...shrine,
      messages: ensureArray(shrine.messages).filter((message) => message.id !== id)
    }))
  });
  return res.json({ success: true });
});

app.patch("/api/admin/contact/:id", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const id = String(req.params.id || "").trim();
  const status = req.body?.status === "done" ? "done" : "new";
  await writeLiveData({
    ...data,
    contactMessages: data.contactMessages.map((message) =>
      message.id === id ? { ...message, status, updatedAt: nowIso() } : message
    )
  });
  return res.json({ success: true });
});

app.delete("/api/admin/contact/:id", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const id = String(req.params.id || "").trim();
  await writeLiveData({
    ...data,
    contactMessages: data.contactMessages.filter((message) => message.id !== id)
  });
  return res.json({ success: true });
});

app.post("/api/admin/blocked", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const personId = stableId(firstText(req.body?.personId, req.body?.id));
  if (!personId) {
    return res.status(400).json({ success: false, error: "personId is required." });
  }

  const shrine = data.shrines.find((item) => item.id === personId || item.publicId === personId);
  const blocked = {
    personId: shrine?.id || personId,
    publicId: shrine?.publicId || "",
    fullName: shrine?.fullName || limitText(req.body?.fullName, 180),
    blockedAt: nowIso()
  };
  const blockedPeople = mergeById(
    data.blockedPeople.map((person) => ({ ...person, id: person.personId || person.publicId })),
    [{ ...blocked, id: blocked.personId || blocked.publicId }]
  ).map(({ id: _id, ...person }) => person);

  await writeLiveData({ ...data, blockedPeople });
  return res.json({ success: true, blocked });
});

app.delete("/api/admin/blocked/:id", requireAdmin, async (req, res) => {
  const data = await readLiveData();
  const id = String(req.params.id || "").trim();
  await writeLiveData({
    ...data,
    blockedPeople: data.blockedPeople.filter((person) => person.personId !== id && person.publicId !== id)
  });
  return res.json({ success: true });
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

function nowIso() {
  return new Date().toISOString();
}

function limitText(value, maxLength = 500) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function cleanId(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9@.+:_-]/g, "").slice(0, 120);
}

function stableId(value, fallback = "") {
  return cleanId(firstText(value, fallback));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIsoDate(value, fallback = nowIso()) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function defaultLiveData() {
  return {
    version: 1,
    updatedAt: "",
    terms: {},
    users: [],
    shrines: [],
    comments: [],
    contactMessages: [],
    admins: [],
    blockedPeople: [],
    removedUserIds: [],
    removedCommentIds: []
  };
}

function normalizeTermsSections(value) {
  const terms = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalizeLanguageTerms = (sections) =>
    ensureArray(sections)
      .map((section, index) => ({
        title: limitText(section?.title || `${index + 1}. Terms`, 120),
        body: limitText(section?.body || section?.text || "", 3000)
      }))
      .filter((section) => section.title || section.body);

  return {
    EN: normalizeLanguageTerms(terms.EN || terms.en),
    AR: normalizeLanguageTerms(terms.AR || terms.ar)
  };
}

function normalizeLiveUser(user) {
  if (!user || typeof user !== "object" || Array.isArray(user)) return null;
  const id = stableId(firstText(user.id, user.userId, user.email, user.phone, user.otpPhone));
  if (!id) return null;

  return {
    id,
    firstName: limitText(user.firstName, 80),
    surname: limitText(user.surname, 80),
    name: limitText(firstText(user.name, `${user.firstName || ""} ${user.surname || ""}`), 140),
    email: normalizeEmail(user.email),
    phone: limitText(user.phone, 32),
    phoneCode: limitText(user.phoneCode, 12),
    otpPhone: limitText(user.otpPhone, 32),
    country: limitText(user.country || user.phoneCountry, 80),
    gender: limitText(user.gender, 24),
    photo: limitText(firstText(user.photo, user.avatar, user.photoUrl, user.avatarUrl), publicMediaMaxLength),
    createdAt: normalizeIsoDate(user.createdAt, ""),
    updatedAt: normalizeIsoDate(firstText(user.updatedAt, user.createdAt), nowIso())
  };
}

function normalizeLiveComment(message, shrine = {}, index = 0) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const shrineId = stableId(firstText(message.shrineId, shrine.id, shrine.publicId));
  const id = stableId(firstText(message.id, message.commentId, message.messageId), `${shrineId}-comment-${index}`);
  const text = limitText(firstText(message.text, message.body, message.content, message.message), 2000);
  const attachment = limitText(firstText(message.attachment, message.attachmentUrl, message.image, message.imageUrl), publicMediaMaxLength);
  if (!id || (!text && !attachment)) return null;

  return {
    id,
    shrineId,
    shrinePublicId: stableId(firstText(message.shrinePublicId, shrine.publicId)),
    shrineName: limitText(firstText(message.shrineName, shrine.fullName, shrine.name), 180),
    userId: stableId(message.userId),
    userName: limitText(firstText(message.userName, message.user_name, message.authorName), 140),
    userPhoto: limitText(firstText(message.userPhoto, message.userPhotoUrl, message.avatar, message.avatarUrl), publicMediaMaxLength),
    text,
    attachment,
    attachmentName: limitText(message.attachmentName, 160),
    createdAt: normalizeIsoDate(message.createdAt, nowIso())
  };
}

function normalizeLiveFlower(flower) {
  if (!flower || typeof flower !== "object" || Array.isArray(flower)) return null;
  const userId = stableId(flower.userId);
  const givenAt = normalizeIsoDate(flower.givenAt, "");
  if (!userId || !givenAt) return null;

  return {
    id: stableId(flower.id, `${userId}-${givenAt}`),
    userId,
    userName: limitText(flower.userName, 140),
    flowerType: limitText(firstText(flower.flowerType, flower.flowerId, flower.flower_id, flower.type), 40),
    givenAt,
    dayKey: limitText(flower.dayKey, 24)
  };
}

function normalizeLiveShrine(person) {
  if (!person || typeof person !== "object" || Array.isArray(person)) return null;
  const id = stableId(firstText(person.id, person.publicId, person.shareId));
  const fullName = limitText(firstText(person.fullName, person.name, person.title), 180);
  if (!id || !fullName) return null;

  const shrine = {
    id,
    publicId: stableId(firstText(person.publicId, person.shareId, person.shortId, person.slug)),
    fullName,
    surnameCheck: limitText(person.surnameCheck, 120),
    photo: limitText(firstText(person.photo, person.photoUrl, person.image, person.imageUrl), publicMediaMaxLength),
    birthDate: limitText(person.birthDate, 24),
    deathDate: limitText(person.deathDate, 24),
    age: limitText(person.age, 8),
    gender: limitText(person.gender, 24),
    country: limitText(person.country, 80),
    info: limitText(firstText(person.info, person.description, person.bio), 3000),
    createdBy: stableId(person.createdBy),
    createdByName: limitText(person.createdByName, 140),
    createdAt: normalizeIsoDate(person.createdAt, ""),
    updatedAt: normalizeIsoDate(firstText(person.updatedAt, person.createdAt), nowIso())
  };
  shrine.messages = ensureArray(person.messages).map((message, index) => normalizeLiveComment(message, shrine, index)).filter(Boolean);
  shrine.flowers = ensureArray(person.flowers).map(normalizeLiveFlower).filter(Boolean);
  return shrine;
}

function normalizeContactMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const text = limitText(firstText(message.message, message.text, message.body), 3000);
  if (!text) return null;
  return {
    id: stableId(message.id, crypto.randomUUID()),
    email: normalizeEmail(message.email),
    name: limitText(message.name, 140),
    message: text,
    status: ["new", "done"].includes(message.status) ? message.status : "new",
    createdAt: normalizeIsoDate(message.createdAt, nowIso()),
    updatedAt: normalizeIsoDate(message.updatedAt, "")
  };
}

function normalizeAdminIdentifier(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.includes("@")) return normalizeEmail(text);
  return normalizePhone(text).replace(/[^\d+]/g, "");
}

function adminIdentifierVariants(value) {
  const normalized = normalizeAdminIdentifier(value);
  if (!normalized) return [];
  if (normalized.includes("@")) return [normalized];

  const variants = new Set([normalized]);
  const digits = normalized.replace(/\D/g, "");
  if (/^01\d{9}$/.test(digits)) variants.add(`+2${digits}`);
  if (/^201\d{9}$/.test(digits)) variants.add(`0${digits.slice(2)}`);
  if (/^\+201\d{9}$/.test(normalized)) variants.add(`0${digits.slice(2)}`);
  return Array.from(variants);
}

function addAdminIdentifierVariants(set, value) {
  for (const variant of adminIdentifierVariants(value)) set.add(variant);
}

function normalizeLiveAdmin(admin) {
  const source = admin && typeof admin === "object" && !Array.isArray(admin) ? admin : { identifier: admin };
  const identifier = normalizeAdminIdentifier(firstText(source.identifier, source.email, source.phone, source.id));
  if (!identifier) return null;

  return {
    id: identifier,
    identifier,
    label: limitText(firstText(source.label, source.name, source.identifier, source.email, source.phone), 140),
    createdAt: normalizeIsoDate(source.createdAt, nowIso()),
    createdBy: normalizeAdminIdentifier(source.createdBy)
  };
}

function adminIdentifierInput(source) {
  const identifier = firstText(source?.identifier, source?.email, source?.phone);
  if (!identifier || identifier.includes("@")) return identifier;

  const countryCode = firstText(source?.countryCode, source?.phoneCode);
  if (String(identifier).trim().startsWith("+")) return identifier;

  const rawDigits = String(identifier).replace(/\D/g, "");
  const countryDigits = String(countryCode || "").replace(/\D/g, "");
  if (countryDigits && rawDigits.startsWith(countryDigits)) return `+${rawDigits}`;
  if (!countryCode) return identifier;

  const digits = rawDigits.replace(/^0+/, "");
  return digits ? `${countryCode}${digits}` : identifier;
}

function liveUserAdminIdentifiers(user) {
  const identifiers = new Set();
  addAdminIdentifierVariants(identifiers, user?.email);
  addAdminIdentifierVariants(identifiers, user?.otpPhone);
  addAdminIdentifierVariants(identifiers, user?.phone);

  const phoneDigits = String(user?.phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (user?.phoneCode && phoneDigits) addAdminIdentifierVariants(identifiers, `${user.phoneCode}${phoneDigits}`);

  return identifiers;
}

function findAdminAccount(data, identifier) {
  const requested = new Set(adminIdentifierVariants(identifier));
  if (!requested.size) return null;

  return ensureArray(data?.users).find((user) => {
    const userIdentifiers = liveUserAdminIdentifiers(user);
    return Array.from(requested).some((variant) => userIdentifiers.has(variant));
  }) || null;
}

function uniqueStrings(values) {
  return Array.from(new Set(ensureArray(values).map((value) => String(value || "").trim()).filter(Boolean)));
}

function mergeById(existing, incoming, removedIds = []) {
  const removed = new Set(uniqueStrings(removedIds));
  const merged = new Map();
  for (const item of ensureArray(existing)) {
    if (item?.id && !removed.has(item.id)) merged.set(item.id, item);
  }
  for (const item of ensureArray(incoming)) {
    if (item?.id && !removed.has(item.id)) merged.set(item.id, { ...merged.get(item.id), ...item });
  }
  return Array.from(merged.values());
}

function normalizeLiveData(data) {
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const next = {
    ...defaultLiveData(),
    ...source,
    terms: normalizeTermsSections(source.terms),
    users: ensureArray(source.users).map(normalizeLiveUser).filter(Boolean),
    shrines: ensureArray(source.shrines).map(normalizeLiveShrine).filter(Boolean),
    contactMessages: ensureArray(source.contactMessages).map(normalizeContactMessage).filter(Boolean),
    admins: mergeById([], ensureArray(source.admins).map(normalizeLiveAdmin).filter(Boolean)),
    blockedPeople: ensureArray(source.blockedPeople)
      .map((person) => ({
        personId: stableId(firstText(person?.personId, person?.id, person)),
        publicId: stableId(person?.publicId),
        fullName: limitText(person?.fullName || person?.name, 180),
        blockedAt: normalizeIsoDate(person?.blockedAt, nowIso())
      }))
      .filter((person) => person.personId || person.publicId),
    removedUserIds: uniqueStrings(source.removedUserIds),
    removedCommentIds: uniqueStrings(source.removedCommentIds)
  };
  next.comments = mergeById(
    ensureArray(source.comments).map((comment, index) => normalizeLiveComment(comment, { id: comment?.shrineId }, index)).filter(Boolean),
    next.shrines.flatMap((shrine) => ensureArray(shrine.messages)),
    next.removedCommentIds
  );
  next.updatedAt = normalizeIsoDate(source.updatedAt, "");
  return next;
}

async function readLiveData() {
  try {
    const text = await fs.readFile(liveDataPath, "utf8");
    return normalizeLiveData(JSON.parse(text));
  } catch {
    return defaultLiveData();
  }
}

async function writeLiveData(data) {
  const next = normalizeLiveData({ ...data, updatedAt: nowIso() });
  await fs.mkdir(path.dirname(liveDataPath), { recursive: true });
  await fs.writeFile(liveDataPath, JSON.stringify(next, null, 2));
  return next;
}

function publicLivePayload(data) {
  return {
    updatedAt: data.updatedAt,
    terms: data.terms,
    shrines: ensureArray(data.shrines).map(normalizeLiveShrine).filter(Boolean),
    blockedPeople: data.blockedPeople,
    removedUserIds: data.removedUserIds,
    removedCommentIds: data.removedCommentIds
  };
}

function configuredAdminIdentifierSet() {
  const configured = adminIdentifiers();
  const variants = new Set();
  for (const value of configured) addAdminIdentifierVariants(variants, value);
  return variants;
}

function liveAdminIdentifierSet(data) {
  const variants = new Set();
  for (const admin of ensureArray(data?.admins)) addAdminIdentifierVariants(variants, admin.identifier);
  return variants;
}

function dashboardAdmins(data) {
  const admins = new Map();

  for (const identifier of adminIdentifiers()) {
    const displayIdentifier = normalizeAdminIdentifier(identifier);
    if (!displayIdentifier) continue;
    admins.set(displayIdentifier, {
      id: displayIdentifier,
      identifier: displayIdentifier,
      label: displayIdentifier,
      source: "secret",
      removable: false
    });
  }

  for (const admin of ensureArray(data?.admins).map(normalizeLiveAdmin).filter(Boolean)) {
    if (admins.has(admin.identifier)) continue;
    admins.set(admin.identifier, {
      ...admin,
      source: "live",
      removable: true
    });
  }

  return Array.from(admins.values()).sort((left, right) => left.identifier.localeCompare(right.identifier));
}

function liveDashboardPayload(data) {
  const admins = dashboardAdmins(data);
  return {
    ...data,
    admins,
    stats: {
      users: data.users.length,
      shrines: data.shrines.length,
      comments: data.comments.length,
      contactMessages: data.contactMessages.length,
      admins: admins.length,
      blockedPeople: data.blockedPeople.length
    }
  };
}

function adminSecret() {
  return String(process.env.ADMIN_DASHBOARD_TOKEN || process.env.ADMIN_SESSION_SECRET || "").trim();
}

function adminIdentifiers() {
  const raw = [
    process.env.ADMIN_IDENTIFIERS,
    process.env.ADMIN_EMAILS,
    process.env.ADMIN_PHONES
  ].filter(Boolean).join(",");

  return new Set(raw.split(/[,;\n]/).map(normalizeAdminIdentifier).filter(Boolean));
}

async function adminIdentifierAllowed(identifier, data = null) {
  const normalizedVariants = adminIdentifierVariants(identifier);
  if (!normalizedVariants.length) return false;

  const configured = configuredAdminIdentifierSet();
  if (normalizedVariants.some((variant) => configured.has(variant))) return true;

  const liveData = data || await readLiveData();
  const liveAdmins = liveAdminIdentifierSet(liveData);
  if (normalizedVariants.some((variant) => liveAdmins.has(variant))) return true;

  return !configured.size && !liveAdmins.size;
}

function signAdminValue(value) {
  const secret = adminSecret();
  return secret ? crypto.createHmac("sha256", secret).update(value).digest("base64url") : "";
}

function createAdminSession(identifier) {
  const payload = {
    identifier: normalizeAdminIdentifier(identifier) || "admin",
    expiresAt: new Date(Date.now() + adminSessionTtlMs).toISOString(),
    nonce: crypto.randomUUID()
  };
  const payloadToken = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadToken}.${signAdminValue(payloadToken)}`;
}

async function verifyAdminSession(token) {
  const secret = adminSecret();
  if (!secret || !token) return false;
  if (safeEqual(token, secret)) return true;

  const [payloadToken, signature] = String(token).split(".");
  if (!payloadToken || !signature || !safeEqual(signature, signAdminValue(payloadToken))) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadToken, "base64url").toString("utf8"));
    return Date.parse(payload.expiresAt) >= Date.now() && (await adminIdentifierAllowed(payload.identifier));
  } catch {
    return false;
  }
}

function adminTokenFromRequest(req) {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  return (bearer || req.headers["x-admin-token"] || "").trim();
}

async function requireAdmin(req, res, next) {
  if (await verifyAdminSession(adminTokenFromRequest(req))) return next();
  return res.status(401).json({ success: false, error: "Admin access is required." });
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

function isEmailSenderConfigurationError(error) {
  const message = String(error?.message || error || "");

  return (
    /domain is not owned by the same account/i.test(message) ||
    /sender.*not.*verified/i.test(message) ||
    /sender.*domain.*not.*available/i.test(message)
  );
}

function normalizeEmailOtpError(error) {
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
  const accountId = process.env.CLOUDFLARE_EMAIL_ACCOUNT_ID?.trim() || process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
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
    const publicError = normalizeEmailOtpError(error);
    return res.status(publicError.status).json({
      success: false,
      error: publicError.error,
      errorCode: publicError.errorCode
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
