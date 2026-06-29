import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowUp,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleUserRound,
  Eye,
  EyeOff,
  FileText,
  Headset,
  Home,
  Image as ImageIcon,
  ImageUp,
  LayoutGrid,
  LayoutList,
  LogIn,
  LockKeyhole,
  LogOut,
  Mail,
  MessageSquare,
  MoreVertical,
  Navigation,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  UserRoundPen,
  UserRoundPlus,
  X
} from "lucide-react";
import lilyRed from "../assets/flowers/lily-red.png";
import lilyWhite from "../assets/flowers/lily-white.png";
import lilyYellow from "../assets/flowers/lily-yellow.png";
import roseRed from "../assets/flowers/rose-red.png";
import roseYellow from "../assets/flowers/rose-yellow.png";
import tulipCreamRed from "../assets/flowers/tulip-cream-red.png";
import tulipPink from "../assets/flowers/tulip-pink.png";
import defaultAvatar from "../assets/images/default-avatar.png";
import countries from "./countries.js";
import "./styles.css";

const STORAGE_KEY = "shrine_mobile_state_v1";
const ADMIN_SESSION_STORAGE_KEY = "shrine_admin_session_v1";
const PRODUCTION_API_BASE_URL = "https://shrine-the-book-of-heaven.bodammohamed204.workers.dev";
const PRODUCTION_APP_URL = "https://app.shrine-app.com";
const SAME_ORIGIN_API_HOSTS = new Set([
  "book-of-heaven.onholding.workers.dev",
  "shrine-the-book-of-heaven.bodammohamed204.workers.dev"
]);
const DEFAULT_META_DESCRIPTION = "Create and share memorial shrines.";
const SHRINE_API_PATH_PREFIX = "/api/shrines/";
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const FLOWER_LIFETIME_DAYS = 7;
const FLOWER_LIFETIME_MS = FLOWER_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
const FLOWER_FADE_CHECK_INTERVAL_MS = 60 * 1000;
const LIVE_SYNC_DEBOUNCE_MS = 900;
const LIVE_POLL_INTERVAL_MS = 60 * 1000;
const AGE_OPTIONS = Array.from({ length: 120 }, (_, index) => String(index + 1));
const FLOWER_CHOICES = [
  { id: "tulip-cream-red", label: "Cream red tulip", src: tulipCreamRed },
  { id: "tulip-pink", label: "Pink tulip", src: tulipPink },
  { id: "lily-yellow", label: "Yellow lily", src: lilyYellow },
  { id: "lily-white", label: "White lily", src: lilyWhite },
  { id: "lily-red", label: "Red lily", src: lilyRed },
  { id: "rose-yellow", label: "Yellow rose", src: roseYellow },
  { id: "rose-red", label: "Red rose", src: roseRed }
];
const INITIAL_FLOWER_TYPE = FLOWER_CHOICES[0].id;
const DEFAULT_FLOWER_TYPE = "rose-red";
const PROFILE_PHOTO_MAX_SIZE = 720;
const PROFILE_PHOTO_QUALITY = 0.84;

function normalizeFlowerType(value) {
  const text = String(value || "").trim();
  return FLOWER_CHOICES.some((flower) => flower.id === text) ? text : DEFAULT_FLOWER_TYPE;
}

function flowerAssetByType(value) {
  const flowerType = normalizeFlowerType(value);
  return FLOWER_CHOICES.find((flower) => flower.id === flowerType) || FLOWER_CHOICES[0];
}

function defaultApiBaseUrl() {
  if (typeof window === "undefined") return "";
  const { hostname, port, protocol } = window.location;
  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

  if (import.meta.env.DEV && (protocol === "http:" || protocol === "https:") && localHosts.has(hostname) && port !== "5184") {
    return `http://${hostname === "localhost" ? "localhost" : "127.0.0.1"}:5184`;
  }

  if (!import.meta.env.DEV && !SAME_ORIGIN_API_HOSTS.has(hostname)) {
    return PRODUCTION_API_BASE_URL;
  }

  return "";
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl()).replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function normalizeBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/$/, "");
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function appBaseUrl() {
  const configuredBase = normalizeBaseUrl(import.meta.env.VITE_APP_URL || import.meta.env.VITE_SHARE_BASE_URL);
  if (configuredBase) return configuredBase;

  if (typeof window !== "undefined" && /^https?:$/i.test(window.location.protocol)) {
    return window.location.origin;
  }

  return PRODUCTION_APP_URL;
}

function shrineInfoPath(personId) {
  return `/shrines/${encodeURIComponent(personId)}/info`;
}

function shrineCommentPath(personId, commentId) {
  return `/shrines/${encodeURIComponent(personId)}/comments/${encodeURIComponent(commentId)}`;
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

function compactShrineId(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const timestampMatch = text.match(/^(\d{10,})-([a-zA-Z0-9]+)/);
  if (timestampMatch) {
    const timestamp = Number(timestampMatch[1]);
    const prefix = Number.isFinite(timestamp) ? timestamp.toString(36) : timestampMatch[1].slice(-8);
    return cleanShareId(`${prefix}-${timestampMatch[2].slice(0, 6)}`);
  }

  if (text.length <= 24) return "";
  const compact = cleanShareId(text).slice(0, 14);
  return compact && compact.length < text.length ? compact : "";
}

function createShrinePublicId() {
  return cleanShareId(`s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
}

function publicShrineIdFromSource(source, fallbackId = "") {
  const explicitId = firstText(
    source?.publicId,
    source?.public_id,
    source?.shareId,
    source?.share_id,
    source?.shortId,
    source?.short_id,
    source?.shortSlug,
    source?.short_slug,
    source?.slug,
    source?.numericId,
    source?.numeric_id,
    source?.shrineNumber,
    source?.shrine_number
  );
  const cleanExplicitId = cleanShareId(explicitId);
  if (cleanExplicitId) return cleanExplicitId;

  const sourceId = firstText(source?.id);
  if (
    sourceId &&
    cleanShareId(sourceId) !== cleanShareId(fallbackId) &&
    isShortPublicIdCandidate(sourceId)
  ) {
    return cleanShareId(sourceId);
  }

  return compactShrineId(firstText(source?.id, fallbackId)) || cleanShareId(firstText(source?.id, fallbackId));
}

function personShareId(personOrId) {
  const person = personOrId && typeof personOrId === "object" ? personOrId : null;
  return person ? publicShrineIdFromSource(person, person.id) : compactShrineId(personOrId) || cleanShareId(personOrId);
}

function personMatchesShareId(person, shareId) {
  const target = cleanShareId(shareId);
  if (!person || !target) return false;

  return [
    person.id,
    person.publicId,
    person.public_id,
    person.shareId,
    person.share_id,
    person.shortId,
    person.short_id,
    person.shortSlug,
    person.short_slug,
    person.slug,
    person.numericId,
    person.numeric_id,
    person.shrineNumber,
    person.shrine_number,
    compactShrineId(person.id)
  ].some((value) => cleanShareId(value) === target);
}

function findPersonByShareId(people, shareId) {
  return Array.isArray(people) ? people.find((person) => personMatchesShareId(person, shareId)) || null : null;
}

function shrineApiPath(personId) {
  return `${SHRINE_API_PATH_PREFIX}${encodeURIComponent(personId)}`;
}

function shrineCommentApiPath(personId, commentId) {
  return `${shrineApiPath(personId)}/comments/${encodeURIComponent(commentId)}`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function shrinePreviewDescription(person) {
  const name = person?.fullName || "this shrine";
  const birthDate = String(person?.birthDate || "").trim();
  const deathDate = String(person?.deathDate || "").trim();
  const dateText = [birthDate, deathDate].filter(Boolean).join(" - ");
  return `In loving memory of ${name}.${dateText ? ` ${dateText}` : ""}`;
}

function previewText(value, maxLength = 100) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function shrinePreviewMeta(personOrId) {
  const person = personOrId && typeof personOrId === "object" ? personOrId : null;
  const personId = person ? personShareId(person) : String(personOrId || "");
  const url = personId ? `${appBaseUrl()}${shrineInfoPath(personId)}` : appBaseUrl();
  const image = isHttpUrl(person?.photo) ? person.photo : "";

  return {
    title: person?.fullName || "Shrine",
    description: person ? shrinePreviewDescription(person) : DEFAULT_META_DESCRIPTION,
    url,
    image
  };
}

function setMetaContent(attribute, key, content) {
  if (typeof document === "undefined") return;

  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

function removeMetaContent(attribute, key) {
  if (typeof document === "undefined") return;
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove();
}

function setCanonicalUrl(url) {
  if (typeof document === "undefined") return;

  let tag = document.head.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }

  tag.setAttribute("href", url);
}

function updateDocumentPreviewMeta(person) {
  if (typeof document === "undefined") return;

  const meta = shrinePreviewMeta(person || "");
  document.title = meta.title;
  setMetaContent("name", "description", meta.description);
  setMetaContent("property", "og:type", "website");
  setMetaContent("property", "og:site_name", "Shrine");
  setMetaContent("property", "og:title", meta.title);
  setMetaContent("property", "og:description", meta.description);
  setMetaContent("property", "og:url", meta.url);
  setCanonicalUrl(meta.url);

  if (meta.image) {
    setMetaContent("property", "og:image", meta.image);
    setMetaContent("property", "og:image:width", "300");
    setMetaContent("property", "og:image:height", "300");
  } else {
    removeMetaContent("property", "og:image");
    removeMetaContent("property", "og:image:width");
    removeMetaContent("property", "og:image:height");
  }
}

function shareContent({ title, text, url }) {
  if (typeof navigator === "undefined") return;

  const payload = {};
  if (title) payload.title = title;
  if (text) payload.text = text;
  if (url) payload.url = url;

  if (navigator.share) {
    navigator.share(payload).catch(() => {});
    return;
  }

  const fallbackText = [title, text, url].filter(Boolean).join("\n");
  if (fallbackText) {
    navigator.clipboard?.writeText?.(fallbackText).catch(() => {});
  }
}

function shareBaseUrl() {
  return appBaseUrl();
}

function buildShareUrl(personOrId, options = {}) {
  const person = personOrId && typeof personOrId === "object" ? personOrId : null;
  const personId = person ? personShareId(person) : String(personOrId || "");
  if (!personId) return "";

  const shareOptions = options && typeof options === "object" ? options : { view: options };
  const commentId = String(shareOptions.commentId || "").trim();
  const isCommentShare = shareOptions.view === "comment" || shareOptions.type === "comment" || Boolean(commentId);
  const path = isCommentShare ? shrineCommentPath(personId, commentId || "info") : shrineInfoPath(personId);

  return new URL(`${shareBaseUrl()}${path}`).toString();
}

function getSharedTargetFromLocation() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const pathEntryInfoMatch = window.location.pathname.match(/^\/shrines\/([^/]+)\/comments\/info\/?$/i);
  const pathCommentMatch = pathEntryInfoMatch ? null : window.location.pathname.match(/^\/shrines\/([^/]+)\/comments\/([^/]+)\/?$/i);
  const pathShrineMatch = window.location.pathname.match(/^\/shrines\/([^/]+)\/info\/?$/i);
  const pathEntryInfoShrineId = pathEntryInfoMatch ? safeDecodeURIComponent(pathEntryInfoMatch[1]) : "";
  const pathCommentShrineId = pathCommentMatch ? safeDecodeURIComponent(pathCommentMatch[1]) : "";
  const pathCommentId = pathCommentMatch ? safeDecodeURIComponent(pathCommentMatch[2]) : "";
  const pathShrineId = pathShrineMatch ? safeDecodeURIComponent(pathShrineMatch[1]) : "";
  const shrineId = params.get("shrine") || params.get("person") || pathEntryInfoShrineId || pathCommentShrineId || pathShrineId;
  const directCommentId = params.get("comment") || params.get("message") || "";
  const view = String(params.get("view") || "").toLowerCase();
  const hash = window.location.hash.replace(/^#/, "").toLowerCase();

  if (pathEntryInfoShrineId) {
    return { type: "comment", personId: pathEntryInfoShrineId, commentId: "info" };
  }

  if (pathCommentShrineId) {
    return { type: "comment", personId: pathCommentShrineId, commentId: pathCommentId };
  }

  if (directCommentId) {
    const commentFlag = ["1", "true", "comment", "message", "info"].includes(directCommentId);
    const personId = shrineId || (commentFlag ? "" : directCommentId);
    const commentId = commentFlag ? "info" : shrineId ? directCommentId : "";
    return personId ? { type: "comment", personId, commentId } : null;
  }

  if (shrineId && (view === "comment" || view === "message" || hash === "comment" || hash === "message")) {
    return { type: "comment", personId: shrineId, commentId: "info" };
  }

  if (shrineId) return { type: "shrine", personId: shrineId };
  return null;
}

function loadInitialApp() {
  const loadedState = loadState();
  const sharedTarget = getSharedTargetFromLocation();

  if (!sharedTarget?.personId) {
    return { state: loadedState, screen: "home", sharedTarget: null };
  }

  const sharedPerson = findPersonByShareId(loadedState.people, sharedTarget.personId);
  const selectedPersonId = sharedPerson?.id || sharedTarget.personId;
  const normalizedSharedTarget = sharedPerson ? { ...sharedTarget, personId: selectedPersonId } : sharedTarget;

  return {
    state: { ...loadedState, selectedPersonId },
    screen: "detail",
    sharedTarget: normalizedSharedTarget
  };
}

async function readApiJson(response, fallbackMessage) {
  const text = await response.text();
  if (!text) {
    return {
      success: false,
      error: response.ok ? fallbackMessage : `${fallbackMessage} (${response.status})`
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: text || fallbackMessage
    };
  }
}

async function apiJson(path, options = {}, fallbackMessage = "Request failed.") {
  const response = await fetch(apiUrl(path), {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  const data = await readApiJson(response, fallbackMessage);
  return { response, data };
}

function normalizeLiveData(data) {
  const live = data?.live && typeof data.live === "object" ? data.live : data && typeof data === "object" ? data : {};
  const normalizeTerms = (terms) => {
    const source = terms && typeof terms === "object" ? terms : {};
    return {
      EN: Array.isArray(source.EN) ? source.EN : [],
      AR: Array.isArray(source.AR) ? source.AR : []
    };
  };

  return {
    terms: normalizeTerms(live.terms),
    blockedPeople: Array.isArray(live.blockedPeople) ? live.blockedPeople : [],
    removedUserIds: Array.isArray(live.removedUserIds) ? live.removedUserIds.map(String) : [],
    removedCommentIds: Array.isArray(live.removedCommentIds) ? live.removedCommentIds.map(String) : [],
    updatedAt: live.updatedAt || ""
  };
}

async function fetchLiveData(signal) {
  try {
    const { response, data } = await apiJson("/api/live", { method: "GET", signal }, "Could not load live data.");
    if (!response.ok || !data?.success) return null;
    return normalizeLiveData(data);
  } catch {
    return null;
  }
}

function compactMediaValue(value) {
  const text = String(value || "").trim();
  if (!text || text.startsWith("data:")) return "";
  return text;
}

function userForLiveSync(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    surname: user.surname,
    email: user.email,
    phone: user.phone,
    phoneCode: user.phoneCode,
    otpPhone: user.otpPhone,
    country: user.country,
    gender: user.gender,
    photo: compactMediaValue(user.photo || user.avatar || user.photoUrl || user.avatarUrl),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function personForLiveSync(person) {
  if (!person || person.id === "sample-ronald-reagan") return null;
  return {
    id: person.id,
    publicId: person.publicId,
    fullName: person.fullName,
    surnameCheck: person.surnameCheck,
    photo: compactMediaValue(person.photo),
    birthDate: person.birthDate,
    deathDate: person.deathDate,
    age: person.age,
    gender: person.gender,
    country: person.country,
    info: person.info,
    createdBy: person.createdBy,
    createdByName: person.createdByName,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    messages: normalizePersonMessages(person.messages).map((message) => ({
      id: message.id,
      text: message.text,
      attachment: compactMediaValue(message.attachment),
      attachmentName: message.attachmentName,
      userId: message.userId,
      userName: message.userName,
      userPhoto: compactMediaValue(message.userPhoto),
      createdAt: message.createdAt
    }))
  };
}

function createLiveSyncPayload(state) {
  return {
    currentUser: userForLiveSync(state.currentUser),
    users: (state.users || []).map(userForLiveSync).filter(Boolean),
    people: (state.people || []).map(personForLiveSync).filter(Boolean)
  };
}

async function syncLiveState(state) {
  const payload = createLiveSyncPayload(state);
  try {
    const { response, data } = await apiJson(
      "/api/live/sync",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "Could not sync live data."
    );
    if (!response.ok || !data?.success) return null;
    return normalizeLiveData(data);
  } catch {
    return null;
  }
}

function savedAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function saveAdminSession(session) {
  try {
    if (!session?.sessionToken) {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Admin login can still continue for the current render.
  }
}

function adminAuthHeaders(session) {
  return session?.sessionToken ? { Authorization: `Bearer ${session.sessionToken}` } : {};
}

async function adminApi(path, session, options = {}, fallbackMessage = "Admin request failed.") {
  return apiJson(path, {
    ...options,
    headers: {
      ...adminAuthHeaders(session),
      ...(options.headers || {})
    }
  }, fallbackMessage);
}

function isEmailOtpSenderUnavailable(data, selectedChannel) {
  const message = String(data?.error || data?.message || "");
  return (
    selectedChannel?.id === "email" &&
    (data?.errorCode === "EMAIL_OTP_SENDER_UNAVAILABLE" ||
      data?.errorCode === "EMAIL_OTP_NOT_CONFIGURED" ||
      /domain is not owned by the same account/i.test(message) ||
      /sender.*not.*verified/i.test(message) ||
      /sender.*domain.*not.*available/i.test(message))
  );
}

function otpSendErrorMessage(data, selectedChannel, t) {
  if (isEmailOtpSenderUnavailable(data, selectedChannel)) {
    return t("emailOtpUnavailable");
  }

  return data.error || data.message || t("couldNotSend");
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

function retryAfterSecondsForResponse(response, data) {
  return (
    positiveSeconds(data?.retryAfterSeconds) ||
    positiveSeconds(data?.retryAfter) ||
    positiveSeconds(data?.retry_after) ||
    parseRetryAfterSeconds(response.headers.get("Retry-After"))
  );
}

function formatWaitTime(seconds) {
  const totalSeconds = positiveSeconds(seconds);
  if (totalSeconds >= 60) return `${Math.ceil(totalSeconds / 60)}m`;
  return `${totalSeconds}s`;
}

function formatText(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? ""));
}

const LEGACY_DEFAULT_COUNTRY_NAME = "United States";
const FALLBACK_COUNTRY_NAME = "Egypt";
const COUNTRY_FILTER_IDS = new Set(["Sponsor", "Follow"]);

const regionCountryNames = countries.reduce((names, country) => {
  names[country.iso.toUpperCase()] = country.name;
  return names;
}, { UK: "United Kingdom" });

const timeZoneCountryNames = {
  "Africa/Cairo": "Egypt",
  "America/Anchorage": "United States",
  "America/Chicago": "United States",
  "America/Denver": "United States",
  "America/Detroit": "United States",
  "America/Indiana/Indianapolis": "United States",
  "America/Los_Angeles": "United States",
  "America/New_York": "United States",
  "America/Phoenix": "United States",
  "Pacific/Honolulu": "United States",
  "Asia/Riyadh": "Saudi Arabia",
  "Asia/Dubai": "United Arab Emirates",
  "Asia/Kuwait": "Kuwait",
  "Asia/Qatar": "Qatar",
  "Asia/Amman": "Jordan",
  "Africa/Casablanca": "Morocco",
  "Africa/Algiers": "Algeria",
  "Africa/Tunis": "Tunisia",
  "Europe/Berlin": "Germany",
  "Europe/Paris": "France",
  "Europe/London": "United Kingdom",
  "America/Toronto": "Canada",
  "America/Vancouver": "Canada",
  "America/Edmonton": "Canada",
  "America/Winnipeg": "Canada",
  "America/Halifax": "Canada",
  "America/St_Johns": "Canada",
  "Australia/Sydney": "Australia",
  "Australia/Melbourne": "Australia",
  "Australia/Brisbane": "Australia",
  "Australia/Adelaide": "Australia",
  "Australia/Perth": "Australia",
  "Australia/Darwin": "Australia",
  "Australia/Hobart": "Australia",
  "Europe/Istanbul": "Turkey",
  "Europe/Rome": "Italy",
  "Europe/Madrid": "Spain",
  "Atlantic/Canary": "Spain",
  "Asia/Kuala_Lumpur": "Malaysia",
  "Asia/Kuching": "Malaysia",
  "Asia/Jakarta": "Indonesia",
  "Asia/Makassar": "Indonesia",
  "Asia/Jayapura": "Indonesia"
};

function findCountryExact(name) {
  return countries.find((country) => country.name === name || country.ar === name) || null;
}

function countryFromRegion(region) {
  const countryName = regionCountryNames[String(region || "").toUpperCase()];
  return countryName ? findCountryExact(countryName) : null;
}

function countryFromNetworkData(data) {
  return countryFromRegion(data?.countryCode || data?.country || data?.region) || findCountryExact(data?.countryName || data?.name);
}

function getLocaleRegion(locale) {
  const text = String(locale || "").trim();
  if (!text) return "";

  try {
    if (typeof Intl !== "undefined" && Intl.Locale) {
      return new Intl.Locale(text).region || "";
    }
  } catch {
    // Fall back to the lightweight parser below.
  }

  const match = text.match(/[-_]([A-Za-z]{2})(?:[-_]|$)/);
  return match ? match[1].toUpperCase() : "";
}

function detectDeviceCountry() {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZoneCountry = findCountryExact(timeZoneCountryNames[timeZone]);
    if (timeZoneCountry) return timeZoneCountry;
  } catch {
    // Time zone detection is best effort.
  }

  if (typeof navigator !== "undefined") {
    const locales = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language];

    for (const locale of locales) {
      const localeCountry = countryFromRegion(getLocaleRegion(locale));
      if (localeCountry) return localeCountry;
    }
  }

  return findCountryExact(FALLBACK_COUNTRY_NAME) || countries[0];
}

async function detectNetworkCountry(signal) {
  if (typeof fetch !== "function") return null;

  try {
    const response = await fetch(apiUrl("/api/geo/country"), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal
    });
    if (!response.ok) return null;

    return countryFromNetworkData(await response.json());
  } catch {
    return null;
  }
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function normalizeShrineApiPerson(data, fallbackId) {
  const source = data?.shrine || data?.person || data?.data || data;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;

  const fullName = firstText(source.fullName, source.full_name, source.name, source.title);
  if (!fullName) return null;

  return normalizePersonFlowers({
    ...source,
    id: firstText(source.id, source._id, source.shrineId, source.shrine_id, fallbackId),
    publicId: publicShrineIdFromSource(source, fallbackId),
    importedFromShare: true,
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
    fatherName: firstText(source.fatherName, source.father_name),
    info: firstText(source.info, source.description, source.bio),
    createdByName: firstText(source.createdByName, source.created_by_name, source.creatorName, source.creator_name),
    gallery: firstArray(source.gallery, source.photos, source.photoGallery, source.photo_gallery, source.images, source.media),
    messages: Array.isArray(source.messages) ? source.messages : Array.isArray(source.comments) ? source.comments : []
  });
}

function normalizeShrineApiMessage(data, fallbackId) {
  const source = data?.comment || data?.message || data?.data || data;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;

  return normalizePersonMessages([
    {
      ...source,
      id: firstText(source.id, source._id, source.commentId, source.comment_id, source.messageId, source.message_id, fallbackId)
    }
  ])[0] || null;
}

async function fetchShrineById(personId, signal) {
  if (!personId || typeof fetch !== "function") return null;

  try {
    const response = await fetch(apiUrl(shrineApiPath(personId)), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal
    });
    if (!response.ok) return null;

    return normalizeShrineApiPerson(await readApiJson(response, "Could not load shrine."), personId);
  } catch {
    return null;
  }
}

async function fetchShrineCommentById(personId, commentId, signal) {
  if (!personId || !commentId || typeof fetch !== "function") return null;

  try {
    const response = await fetch(apiUrl(shrineCommentApiPath(personId, commentId)), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal
    });
    if (!response.ok) return null;

    return normalizeShrineApiMessage(await readApiJson(response, "Could not load comment."), commentId);
  } catch {
    return null;
  }
}

function getDefaultCountryName() {
  return detectDeviceCountry().name;
}

function normalizeCountryName(name, fallbackName = getDefaultCountryName()) {
  return (findCountryExact(name) || findCountryExact(fallbackName) || countries[0]).name;
}

function normalizeCountryFilter(value, fallbackName = getDefaultCountryName()) {
  if (!value) return fallbackName;
  if (COUNTRY_FILTER_IDS.has(value)) return value;
  return normalizeCountryName(value, fallbackName);
}

const initialCountryName = getDefaultCountryName();

const defaultPeople = [
  {
    id: "sample-ronald-reagan",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Ronald_Reagan_1981_presidential_portrait.jpg/500px-Ronald_Reagan_1981_presidential_portrait.jpg",
    fullName: "Ronald Wilson Reagan",
    surnameCheck: "Reagan",
    deathDate: "2004-06-05",
    birthDate: "1911-02-06",
    age: "93",
    gender: "Male",
    country: "United States",
    info: "40th President of the United States.",
    createdBy: "sample"
  }
];

const initialState = {
  currentUser: null,
  users: [],
  people: defaultPeople,
  following: [],
  blocked: [],
  language: "EN",
  currentCountry: initialCountryName,
  homeFilter: initialCountryName,
  countryPreferenceTouched: false,
  live: {
    terms: {},
    blockedPeople: [],
    removedUserIds: [],
    removedCommentIds: []
  },
  flowerFadeNotices: [],
  guest: true
};

const copy = {
  EN: {
    shrine: "Shrines",
    registerTitle: "Start Your Shrine",
    registerIntro: "Create a private account and keep every memorial under your own name.",
    firstName: "First Name",
    surname: "Surname",
    mobileNumber: "Mobile Number",
    emailAddress: "Email Address",
    gender: "Gender",
    country: "Country",
    password: "Password",
    confirmPassword: "Confirm Password",
    continue: "Continue",
    alreadyHaveAccount: "Already Have An Account?",
    login: "Login",
    continueBrowsing: "Continue browsing",
    selectCallingCode: "Select calling code",
    required: "Required",
    startRequired: "Complete the required fields",
    errFirstName: "First name is required",
    errSurname: "Surname is required",
    errPhone: "Enter a valid mobile number",
    errEmail: "Enter a valid email",
    errEmailOrPhone: "Enter a valid mobile number",
    phoneAlreadyExists: "This mobile number is already used. Try logging in or use another number.",
    emailAlreadyExists: "This email address is already used. Try logging in or use another email.",
    errGender: "Gender is required",
    errPassword: "Password is required",
    errPasswordLength: "Use at least 8 characters",
    errPasswordMatch: "Passwords do not match",
    welcomeBack: "Welcome Back",
    loginIntro: "Sign in with an account you created on this browser.",
    loginTitle: "Let's Sign you in.",
    forgotPassword: "Forgot Password ?",
    resetPasswordTitle: "Reset Password",
    resetPasswordIntro: "Enter your mobile number or email address to receive a 6-digit code to reset your password.",
    resetPasswordPhoneIntro: "Enter your mobile number to receive a 6-digit code to reset your password.",
    resetPasswordEmailIntro: "Enter your email address to receive a 6-digit code to reset your password.",
    sendResetCode: "Send Reset Code",
    resetAccountNotFound: "No account was found with this mobile number.",
    resetEmailAccountNotFound: "No account was found with this email address.",
    resetRecoveryHelp: "Use the same phone or email linked to your account.",
    newPasswordTitle: "Create New Password",
    newPasswordIntro: "Choose a new password for your account.",
    newPassword: "New Password",
    passwordResetSuccess: "Password updated. Sign in with your new password.",
    dontHaveAccount: "Don't Have An Account?",
    createNew: "Create New",
    phoneRequired: "Phone is Required",
    identifierRequired: "Mobile number is required",
    passwordRequired: "Password is Required",
    back: "Back",
    newHere: "New here?",
    createAccount: "Create account",
    badLogin: "Check your mobile number and password",
    success: "Success",
    congrats: "Congrats!",
    successBody: "Your account is ready. Start adding memorials and manage everything from your profile.",
    letsStart: "Let's Start",
    sponsor: "Sponsor",
    follow: "Follow",
    sponsorTab: "Sponsor",
    followersTab: "Follow",
    noMemorials: "No memorials yet",
    noMemorialsBody: "Use the add button to create the first real entry from your own data.",
    browseCountry: "Browse country",
    add: "Add",
    selected: "Selected",
    fatherName: "Father's Name",
    fullName: "Full Name (including Surname)",
    verifySurname: "Verify Surname",
    dateOfDeath: "Date of Death",
    dateOfBirth: "Date of Birth",
    age: "Age",
    years: "Years",
    information: "Information",
    words: "words",
    create: "Create",
    update: "Update",
    memorialCreated: "Memorial created",
    memorialUpdated: "Memorial updated",
    errFullName: "Full name is required",
    errDeathDate: "Date of death is required",
    errAgeMismatch: "Age must be {age}",
    errCountry: "Country is required",
    errInfo: "Use 250 words or less",
    search: "Search",
    startTyping: "Start typing to search",
    noResults: "No results found",
    noResultsBody: "Try a name, country, or story word.",
    settings: "Settings",
    profile: "Profile",
    language: "Language",
    arabic: "Arabic",
    english: "English",
    userDashboard: "User Dashboard",
    dashboardIntro: "Edit or delete saved users on this device.",
    adminDashboard: "Admin Dashboard",
    adminIntro: "Live moderation and content controls.",
    adminSignIn: "Admin sign in",
    adminIdentifier: "Admin email or phone",
    adminAccessKey: "Admin access key",
    adminKeyHelp: "Use the admin key configured on the server.",
    adminUsers: "Users",
    adminTerms: "Terms",
    adminContact: "Contact",
    adminComments: "Comments",
    adminBlocked: "Blocked",
    adminStats: "Stats",
    adminLiveOffline: "Live storage is not configured yet.",
    adminRefresh: "Refresh",
    adminSignedIn: "Admin signed in",
    adminSaved: "Admin changes saved",
    adminDeleted: "Deleted",
    adminBlockedPerson: "Person blocked",
    adminUnblockedPerson: "Person unblocked",
    adminNoData: "No live data yet",
    adminMarkDone: "Mark done",
    adminMarkNew: "Mark new",
    adminBlockPerson: "Block person",
    adminLogout: "Exit admin",
    noUsers: "No users yet",
    noUsersBody: "Accounts you create on this device will appear here.",
    editUser: "Edit user",
    deleteUser: "Delete user",
    deleteItem: "Delete",
    deleteUserConfirm: "Delete this user from this device?",
    userSaved: "User saved",
    userDeleted: "User deleted",
    cancel: "Cancel",
    blockedUsers: "Blocked Users",
    contactUs: "Contact Us",
    terms: "Terms & Conditions",
    logout: "Logout",
    logoutConfirmMessage: "Are you sure?",
    logoutSuccess: "Successfully logged out",
    done: "Done",
    myAccount: "My Account",
    editProfile: "Edit Profile",
    myInformation: "My Information",
    guestAccount: "Guest account",
    notSelected: "Not selected",
    save: "Save",
    profileUpdated: "Profile updated",
    memorial: "Memorial",
    entryNotFound: "Entry not found",
    unknownBirth: "Unknown birth",
    following: "Following",
    block: "Block",
    unblock: "Unblock",
    noBlockedUsers: "No blocked users",
    lastUpdated: "Last updated",
    yourEmail: "Your Email",
    message: "Message",
    writeMessage: "Write your message",
    noMessages: "No messages yet",
    attachPhoto: "Attach photo",
    removeAttachment: "Remove attachment",
    send: "Send",
    messageSaved: "Message saved locally",
    postAdded: "Post Added Successfully",
    home: "Home",
    hidePassword: "Hide password",
    showPassword: "Show password",
    male: "Male",
    female: "Female",
    searchCountry: "Search country",
    receiveActivationCode: "How to receive the activation code",
    whatsappCode: "WhatsApp activation code",
    mobileWhatsapp: "Mobile (WhatsApp)",
    emailCode: "E-Mail",
    activationCode: "Activation Code",
    sixDigitCode: "6-digit code",
    codeSent: "Activation code sent.",
    emailCodeSent: "Email code sent.",
    rateLimited: "Too many activation code requests. Try again in {time}.",
    enterCode: "Enter the activation code first.",
    couldNotSend: "Could not send activation code.",
    emailOtpUnavailable: "Email codes are temporarily unavailable. Choose WhatsApp or try again later.",
    couldNotVerify: "Could not verify activation code.",
    codeWrong: "The code is incorrect or expired.",
    registrationCancelled: "Registration cancelled. Start again with the correct details.",
    devCode: "Development code",
    expiresAt: "Expires at",
    pleaseWait: "Please wait...",
    verifyProceed: "Verify & Proceed",
    sendWhatsappCode: "Send WhatsApp Code",
    resendCode: "Resend code",
    resendIn: "Resend in {time}",
    resendCodeIn: "Resend Code in {time} seconds",
    codeSentToEmail: "We sent an activation code to your email:",
    codeSentToMobile: "We sent an activation code to your mobile:",
    emailOrPhone: "Mobile number",
    emailOrPhonePlaceholder: "Mobile number",
    accountPromptTitle: "Create an account to save your follows",
    accountPromptBody: "Your following list belongs to your account, so it stays separate from guest browsing.",
    accountPromptAddTitle: "Create an account to add a shrine",
    accountPromptAddBody: "Add a shrine, preserve details, and manage it safely from your own account.",
    accountPromptFlowerTitle: "Create an account to give a flower",
    accountPromptFlowerBody: "Each user can give one flower per day, so your daily flower needs to belong to your account.",
    accountPromptMessageTitle: "Create an account to write",
    accountPromptMessageBody: "Guest browsing is view-only. Create an account or sign in to write or reply.",
    signIn: "Sign in",
    gallery: "Gallery",
    giveFlower: "Give Flower",
    flower: "Flower",
    flowerAdded: "Flower added to the shrine",
    flowerUsedToday: "You have one flower per day",
    oneFlowerADay: "One Flower A Day",
    flowerAlreadySentToday: "You have already sent a flower to this shrine today",
    flowerLasts: "The flower lasts for seven days",
    flowerCount: "{count} flowers",
    noFlowersYet: "No flowers yet",
    flowerSenders: "Flower senders",
    notificationFlowerPlacedTitle: "A flower has been placed for {name}",
    notificationFlowerPlacedBody: "See who sent the flower",
    notificationMemorySharedTitle: "A new memory was shared about {name}",
    notificationMemorySharedBody: "Take a look",
    notificationFlowerFadedTitle: "Your flower for {name} has gently faded",
    notificationFlowerFadedBody: "Send another to keep the memory alive",
    notificationDeathAnniversaryTitle: "Today marks the anniversary of {name}",
    notificationDeathAnniversaryBody: "Take a moment to remember"
  },
  AR: {
    shrine: "شراين",
    registerTitle: "ابدأ حسابك",
    registerIntro: "أنشئ حسابك واحفظ كل مزار باسمك.",
    firstName: "الاسم الأول",
    surname: "اسم العائلة",
    mobileNumber: "رقم الهاتف المحمول",
    emailAddress: "البريد الإلكتروني",
    gender: "النوع",
    country: "الدولة",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    continue: "متابعة",
    alreadyHaveAccount: "عندك حساب بالفعل؟",
    login: "تسجيل الدخول",
    continueBrowsing: "متابعة التصفح",
    selectCallingCode: "اختر كود الدولة",
    required: "مطلوب",
    startRequired: "أكمل الحقول المطلوبة",
    errFirstName: "الاسم الأول مطلوب",
    errSurname: "اسم العائلة مطلوب",
    errPhone: "أدخل رقم هاتف صحيحًا",
    errEmail: "أدخل بريدًا إلكترونيًا صحيحًا",
    errEmailOrPhone: "أدخل رقم هاتف صحيحًا",
    phoneAlreadyExists: "رقم الهاتف مستخدم بالفعل. حاول تسجيل الدخول أو استخدم رقمًا آخر.",
    emailAlreadyExists: "البريد الإلكتروني مستخدم بالفعل. حاول تسجيل الدخول أو استخدم بريدًا آخر.",
    errGender: "النوع مطلوب",
    errPassword: "كلمة المرور مطلوبة",
    errPasswordLength: "استخدم 8 أحرف على الأقل",
    errPasswordMatch: "كلمتا المرور غير متطابقتين",
    welcomeBack: "أهلًا بعودتك",
    loginIntro: "سجّل الدخول بالحساب الذي أنشأته على هذا الجهاز.",
    loginTitle: "دعنا نقوم بتسجيل دخولك.",
    forgotPassword: "نسيت كلمة المرور؟",
    resetPasswordTitle: "إعادة تعيين كلمة المرور",
    resetPasswordIntro: "أدخل رقم الهاتف أو البريد الإلكتروني لاستلام كود من 6 أرقام لإعادة تعيين كلمة المرور.",
    resetPasswordPhoneIntro: "أدخل رقم هاتفك لاستلام كود من 6 أرقام لإعادة تعيين كلمة المرور.",
    resetPasswordEmailIntro: "أدخل بريدك الإلكتروني لاستلام كود من 6 أرقام لإعادة تعيين كلمة المرور.",
    sendResetCode: "إرسال كود الاسترجاع",
    resetAccountNotFound: "لم يتم العثور على حساب بهذا الرقم.",
    resetEmailAccountNotFound: "لم يتم العثور على حساب بهذا البريد الإلكتروني.",
    resetRecoveryHelp: "استخدم نفس الهاتف أو البريد الإلكتروني المرتبط بحسابك.",
    newPasswordTitle: "إنشاء كلمة مرور جديدة",
    newPasswordIntro: "اختر كلمة مرور جديدة لحسابك.",
    newPassword: "كلمة المرور الجديدة",
    passwordResetSuccess: "تم تحديث كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.",
    dontHaveAccount: "ليس لديك حساب؟",
    createNew: "إنشاء حساب جديد",
    phoneRequired: "رقم الهاتف مطلوب",
    identifierRequired: "رقم الهاتف مطلوب",
    passwordRequired: "كلمة المرور مطلوبة",
    back: "رجوع",
    newHere: "مستخدم جديد؟",
    createAccount: "إنشاء حساب",
    badLogin: "تحقق من رقم الهاتف وكلمة المرور",
    success: "تم بنجاح",
    congrats: "مبروك!",
    successBody: "حسابك جاهز. ابدأ بإضافة الشراين وإدارتها من ملفك.",
    letsStart: "ابدأ",
    sponsor: "الداعمون",
    follow: "متابعة",
    sponsorTab: "الرعاية",
    followersTab: "متابعون",
    noMemorials: "لا توجد مزارات حتى الآن",
    noMemorialsBody: "اضغط على زر الإضافة لإضافة مزارك الأول.",
    browseCountry: "تصفح حسب الدولة",
    add: "إضافة",
    selected: "تم الاختيار",
    fatherName: "اسم الأب",
    fullName: "الاسم الكامل (مع اسم العائلة)",
    verifySurname: "تأكيد اسم العائلة",
    dateOfDeath: "تاريخ الوفاة",
    dateOfBirth: "تاريخ الميلاد",
    age: "العمر",
    years: "سنة",
    information: "معلومات",
    words: "كلمة",
    create: "إنشاء",
    update: "تحديث",
    memorialCreated: "تم إنشاء المزار",
    memorialUpdated: "تم تحديث المزار",
    errFullName: "الاسم الكامل مطلوب",
    errDeathDate: "تاريخ الوفاة مطلوب",
    errAgeMismatch: "العمر لازم يكون {age}",
    errCountry: "الدولة مطلوبة",
    errInfo: "استخدم 250 كلمة أو أقل",
    search: "بحث",
    startTyping: "ابدأ الكتابة للبحث",
    noResults: "لا توجد نتائج",
    noResultsBody: "جرّب البحث باسم أو دولة أو كلمة من الوصف.",
    settings: "الإعدادات",
    profile: "الملف الشخصي",
    language: "اللغة",
    arabic: "العربية",
    english: "الإنجليزية",
    userDashboard: "لوحة المستخدمين",
    dashboardIntro: "عدّل أو احذف المستخدمين المحفوظين على هذا الجهاز.",
    adminDashboard: "لوحة الأدمن",
    adminIntro: "تحكم حي في المحتوى والإشراف.",
    adminSignIn: "دخول الأدمن",
    adminIdentifier: "إيميل أو هاتف الأدمن",
    adminAccessKey: "مفتاح دخول الأدمن",
    adminKeyHelp: "استخدم مفتاح الأدمن المحفوظ على السيرفر.",
    adminUsers: "المستخدمون",
    adminTerms: "الشروط",
    adminContact: "تواصل معنا",
    adminComments: "الكومنتات",
    adminBlocked: "المحظورون",
    adminStats: "الإحصائيات",
    adminLiveOffline: "التخزين الحي غير مفعّل بعد.",
    adminRefresh: "تحديث",
    adminSignedIn: "تم دخول الأدمن",
    adminSaved: "تم حفظ تعديلات الأدمن",
    adminDeleted: "تم الحذف",
    adminBlockedPerson: "تم حظر الشخص",
    adminUnblockedPerson: "تم إلغاء الحظر",
    adminNoData: "لا توجد بيانات حية بعد",
    adminMarkDone: "تم التعامل",
    adminMarkNew: "جديد",
    adminBlockPerson: "حظر الشخص",
    adminLogout: "خروج الأدمن",
    noUsers: "لا يوجد مستخدمون حتى الآن",
    noUsersBody: "ستظهر هنا الحسابات التي يتم إنشاؤها على هذا الجهاز.",
    editUser: "تعديل المستخدم",
    deleteUser: "حذف المستخدم",
    deleteItem: "حذف",
    deleteUserConfirm: "هل تريد حذف هذا المستخدم من هذا الجهاز؟",
    userSaved: "تم حفظ المستخدم",
    userDeleted: "تم حذف المستخدم",
    cancel: "إلغاء",
    blockedUsers: "المستخدمون المحظورون",
    contactUs: "تواصل معنا",
    terms: "الشروط والأحكام",
    logout: "تسجيل الخروج",
    logoutConfirmMessage: "هل أنت متأكد؟",
    logoutSuccess: "تم تسجيل الخروج بنجاح",
    done: "تم",
    myAccount: "حسابي",
    editProfile: "تعديل الملف",
    myInformation: "معلوماتي",
    guestAccount: "حساب زائر",
    notSelected: "غير محدد",
    save: "حفظ",
    profileUpdated: "تم تحديث الملف",
    memorial: "المزار",
    entryNotFound: "المزار غير موجود",
    unknownBirth: "تاريخ الميلاد غير معروف",
    following: "تتم المتابعة",
    block: "حظر",
    unblock: "إلغاء الحظر",
    noBlockedUsers: "لا يوجد مستخدمون محظورون",
    lastUpdated: "آخر تحديث",
    yourEmail: "بريدك الإلكتروني",
    message: "الرسالة",
    writeMessage: "اكتب رسالتك",
    noMessages: "لا توجد رسائل بعد",
    attachPhoto: "إرفاق صورة",
    removeAttachment: "إزالة المرفق",
    send: "إرسال",
    messageSaved: "تم حفظ الرسالة محليًا",
    postAdded: "تمت إضافة المنشور بنجاح",
    home: "الرئيسية",
    hidePassword: "إخفاء كلمة المرور",
    showPassword: "إظهار كلمة المرور",
    male: "ذكر",
    female: "أنثى",
    searchCountry: "ابحث عن دولة",
    receiveActivationCode: "طريقة استلام كود التفعيل",
    whatsappCode: "كود تفعيل واتساب",
    mobileWhatsapp: "الهاتف (واتساب)",
    emailCode: "البريد الإلكتروني",
    activationCode: "كود التفعيل",
    sixDigitCode: "كود من 6 أرقام",
    codeSent: "تم إرسال كود التفعيل.",
    emailCodeSent: "تم إرسال كود البريد الإلكتروني.",
    rateLimited: "طلبات كود التفعيل كثيرة. حاول مرة أخرى بعد {time}.",
    enterCode: "أدخل كود التفعيل أولًا.",
    couldNotSend: "تعذر إرسال كود التفعيل.",
    emailOtpUnavailable: "أكواد البريد الإلكتروني غير متاحة مؤقتًا. اختر واتساب أو حاول لاحقًا.",
    couldNotVerify: "تعذر التحقق من كود التفعيل.",
    codeWrong: "الكود غير صحيح أو انتهت صلاحيته.",
    registrationCancelled: "تم إلغاء التسجيل. ابدأ من جديد بالبيانات الصحيحة.",
    devCode: "كود التطوير",
    expiresAt: "ينتهي في",
    pleaseWait: "يرجى الانتظار...",
    verifyProceed: "تحقق وتابع",
    sendWhatsappCode: "إرسال كود واتساب",
    resendCode: "إعادة إرسال الكود",
    resendIn: "إعادة الإرسال بعد {time}",
    resendCodeIn: "إعادة إرسال الكود بعد {time} ثانية",
    codeSentToEmail: "أرسلنا كود التفعيل إلى بريدك الإلكتروني:",
    codeSentToMobile: "أرسلنا كود التفعيل إلى هاتفك:",
    emailOrPhone: "رقم الهاتف",
    emailOrPhonePlaceholder: "رقم الهاتف",
    accountPromptTitle: "أنشئ حسابًا لحفظ المتابعات",
    accountPromptBody: "قائمة المتابعة مرتبطة بحسابك، وتظل منفصلة عن تصفح الزائر.",
    accountPromptAddTitle: "أنشئ حسابًا لإضافة راحل",
    accountPromptAddBody: "أضف راحلًا، احفظ التفاصيل، وادر الصفحة بأمان من حسابك.",
    accountPromptFlowerTitle: "أنشئ حسابًا لإهداء وردة",
    accountPromptFlowerBody: "لكل مستخدم وردة واحدة يوميًا، لذلك يجب حفظها على حسابك.",
    accountPromptMessageTitle: "أنشئ حسابًا للكتابة",
    accountPromptMessageBody: "حساب الزائر للمشاهدة فقط. أنشئ حسابًا أو سجل الدخول للكتابة أو الرد.",
    signIn: "تسجيل الدخول",
    gallery: "المعرض",
    giveFlower: "إهداء وردة",
    flower: "وردة",
    flowerAdded: "تمت إضافة الوردة إلى المزار",
    flowerUsedToday: "لديك وردة واحدة فقط يوميًا",
    oneFlowerADay: "وردة واحدة يوميًا",
    flowerAlreadySentToday: "لقد أرسلت وردة لهذا المزار اليوم بالفعل",
    flowerLasts: "الوردة تستمر سبعة أيام",
    flowerCount: "{count} وردة",
    noFlowersYet: "لا توجد ورود حتى الآن",
    flowerSenders: "مرسلو الورود",
    notificationFlowerPlacedTitle: "تم إهداء وردة لـ {name}",
    notificationFlowerPlacedBody: "شاهد من اهدى الورده له",
    notificationMemorySharedTitle: "تمت إضافة ذكرى جديدة عن {name}",
    notificationMemorySharedBody: "اطّلع عليها",
    notificationFlowerFadedTitle: "ذبلت وردتك لـ {name}",
    notificationFlowerFadedBody: "أهدِ وردة جديدة لإبقاء الذكرى حيّة",
    notificationDeathAnniversaryTitle: "اليوم ذكرى وفاة {name}",
    notificationDeathAnniversaryBody: "خذ لحظة لاستحضار ذكراه"
  }
};

const termsSections = {
  EN: [
    {
      title: "1. Account Ownership",
      body:
        "Your account keeps the memorials, profile details, saved follows, and settings you add while using this application. Keep your login details private and update incorrect information when you notice it."
    },
    {
      title: "2. Memorial Entries",
      body:
        "Only add names, photos, dates, and stories that you are allowed to share. You can edit or remove your own entries at any time from this device."
    },
    {
      title: "3. Respectful Use",
      body:
        "Do not add harmful, misleading, hateful, or private material about another person. Blocking and reporting tools should be used to protect your experience."
    },
    {
      title: "4. Local Data",
      body:
        "This demo stores data in your browser storage. Clearing browser data or using another device can remove saved accounts and memorials unless a backend is later connected."
    },
    {
      title: "5. Support",
      body:
        "For account help, content corrections, or feature requests, contact the project owner through the support screen."
    }
  ],
  AR: [
    {
      title: "1. ملكية الحساب",
      body:
        "يحفظ حسابك المزارات وبيانات الملف الشخصي والمتابعات والإعدادات التي تضيفها داخل التطبيق. حافظ على بيانات الدخول الخاصة بك وحدث أي معلومات غير صحيحة."
    },
    {
      title: "2. المزارات",
      body:
        "أضف فقط الأسماء والصور والتواريخ والقصص التي تملك حق مشاركتها. يمكنك تعديل أو حذف المزارات التي تضيفها من هذا الجهاز في أي وقت."
    },
    {
      title: "3. الاستخدام باحترام",
      body:
        "لا تضف محتوى ضارًا أو مضللًا أو مسيئًا أو خاصًا عن أي شخص. استخدم أدوات الحظر والإبلاغ لحماية تجربتك."
    },
    {
      title: "4. البيانات المحلية",
      body:
        "يحفظ هذا الإصدار البيانات في مساحة تخزين المتصفح أو التطبيق على جهازك. مسح بيانات التطبيق أو استخدام جهاز آخر قد يزيل الحسابات والمزارات المحفوظة."
    },
    {
      title: "5. الدعم",
      body:
        "للمساعدة في الحساب أو تصحيح المحتوى أو طلب مزايا جديدة، تواصل مع مالك المشروع من شاشة الدعم."
    }
  ]
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const merged = saved ? { ...initialState, ...saved } : initialState;
    const detectedCountry = detectDeviceCountry();
    const savedCountry = findCountryExact(saved?.currentCountry);
    const shouldUseDetectedCountry =
      !saved ||
      (!saved.countryPreferenceTouched &&
        (!savedCountry ||
          (savedCountry.name === LEGACY_DEFAULT_COUNTRY_NAME &&
            detectedCountry.name !== LEGACY_DEFAULT_COUNTRY_NAME)));
    const currentCountry = shouldUseDetectedCountry
      ? detectedCountry.name
      : normalizeCountryName(merged.currentCountry, initialState.currentCountry);
    const rawHomeFilter = merged.homeFilter || currentCountry;
    const homeFilter =
      shouldUseDetectedCountry ||
      (!saved?.countryPreferenceTouched && rawHomeFilter === LEGACY_DEFAULT_COUNTRY_NAME)
        ? currentCountry
        : normalizeCountryFilter(rawHomeFilter, currentCountry);
    const savedPeople = Array.isArray(merged.people) ? merged.people : [];
    const people = [
      ...defaultPeople,
      ...savedPeople.filter((person) => !defaultPeople.some((sample) => sample.id === person.id))
    ].map(normalizePersonFlowers);
    const flowerFadeNotices = Array.isArray(merged.flowerFadeNotices)
      ? merged.flowerFadeNotices.map((noticeId) => String(noticeId || "").trim()).filter(Boolean)
      : [];

    return {
      ...merged,
      people,
      flowerFadeNotices,
      guest: merged.currentUser ? false : true,
      language: normalizeLanguage(merged.language),
      currentCountry,
      homeFilter,
      live: normalizeLiveData(merged.live),
      countryPreferenceTouched: Boolean(merged.countryPreferenceTouched)
    };
  } catch {
    return initialState;
  }
}

function saveState(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return true;
  } catch {
    return false;
  }
}

function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Image could not be read."));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

async function compressImageFile(file, maxSize = PROFILE_PHOTO_MAX_SIZE, quality = PROFILE_PHOTO_QUALITY) {
  if (!file) return "";

  if (typeof window === "undefined" || typeof document === "undefined" || !file.type?.startsWith("image/")) {
    return readImageFileAsDataUrl(file);
  }

  const objectUrl = window.URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const largestSide = Math.max(sourceWidth, sourceHeight);

    if (!sourceWidth || !sourceHeight || !largestSide) {
      return readImageFileAsDataUrl(file);
    }

    const scale = Math.min(1, maxSize / largestSide);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return readImageFileAsDataUrl(file);

    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return readImageFileAsDataUrl(file);
  } finally {
    window.URL.revokeObjectURL(objectUrl);
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatStoredDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const localTime = date.getTime() - date.getTimezoneOffset() * 60 * 1000;
  return new Date(localTime).toISOString().slice(0, 10);
}

function activeFlowerGifts(flowers, now = Date.now()) {
  if (!Array.isArray(flowers)) return [];

  return flowers.filter((flower) => {
    const givenTime = Date.parse(flower?.givenAt);
    return Number.isFinite(givenTime) && now - givenTime < FLOWER_LIFETIME_MS;
  });
}

function normalizeFlowerGifts(flowers) {
  if (!Array.isArray(flowers)) return [];

  return flowers
    .map((flower) => {
      const givenAt = flower?.givenAt ? new Date(flower.givenAt) : null;
      if (!givenAt || !Number.isFinite(givenAt.getTime()) || !flower?.userId) return null;
      const isoGivenAt = givenAt.toISOString();
      const dayKey = flower.dayKey || localDateKey(givenAt);

      return {
        id: flower.id || `${flower.userId}-${dayKey}-${givenAt.getTime()}`,
        userId: String(flower.userId),
        userName: flower.userName || "",
        flowerType: normalizeFlowerType(firstText(flower.flowerType, flower.flowerId, flower.flower_id, flower.type)),
        givenAt: isoGivenAt,
        dayKey
      };
    })
    .filter(Boolean);
}

function flowerFadeNoticeId(personId, flower) {
  const flowerId = String(flower?.id || `${flower?.userId || ""}-${flower?.dayKey || ""}-${flower?.givenAt || ""}`).trim();
  return `${personId}:${flowerId}`;
}

function expiredUserFlowerNotices(people, userId, notifiedIds = [], now = Date.now()) {
  if (!userId || !Array.isArray(people)) return [];

  const notified = new Set((Array.isArray(notifiedIds) ? notifiedIds : []).map((noticeId) => String(noticeId || "")));
  return people.flatMap((person) =>
    (Array.isArray(person?.flowers) ? person.flowers : [])
      .map((flower) => {
        if (String(flower?.userId || "") !== String(userId)) return null;

        const givenTime = Date.parse(flower?.givenAt);
        if (!Number.isFinite(givenTime) || now - givenTime < FLOWER_LIFETIME_MS) return null;

        const id = flowerFadeNoticeId(person.id, flower);
        if (notified.has(id)) return null;

        return {
          id,
          personId: person.id,
          personName: person.fullName || ""
        };
      })
      .filter(Boolean)
  );
}

function normalizePersonMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => {
      const user = message?.user && typeof message.user === "object" ? message.user : {};
      const author = message?.author && typeof message.author === "object" ? message.author : {};
      const commenter = message?.commenter && typeof message.commenter === "object" ? message.commenter : {};
      const text = firstText(message?.text, message?.body, message?.content, message?.message, message?.description);
      const attachment = firstText(
        message?.attachment,
        message?.attachmentUrl,
        message?.attachment_url,
        message?.attachmentPath,
        message?.attachment_path,
        message?.image,
        message?.imageUrl,
        message?.image_url,
        message?.imagePath,
        message?.image_path,
        message?.media,
        message?.mediaUrl,
        message?.media_url,
        message?.mediaPath,
        message?.media_path
      );
      if (!text && !attachment) return null;

      const rawCreatedAt = firstText(message?.createdAt, message?.created_at, message?.date);
      const createdAt = rawCreatedAt ? new Date(rawCreatedAt) : new Date();
      const isoCreatedAt = Number.isFinite(createdAt.getTime()) ? createdAt.toISOString() : new Date().toISOString();

      return {
        id: firstText(message?.id, message?._id, message?.commentId, message?.comment_id, message?.messageId, message?.message_id) || uid(),
        text,
        attachment,
        attachmentName: firstText(message?.attachmentName, message?.attachment_name),
        userId: firstText(message?.userId, message?.user_id, user.id, author.id, commenter.id, "guest"),
        userName: firstText(message?.userName, message?.user_name, message?.commenterName, message?.commenter_name, user.name, author.name, commenter.name),
        userPhoto: firstText(
          message?.userPhoto,
          message?.userPhotoUrl,
          message?.user_photo_url,
          message?.userPhotoPath,
          message?.user_photo_path,
          message?.avatar,
          message?.avatarUrl,
          message?.avatar_url,
          message?.avatarPath,
          message?.avatar_path,
          message?.profilePhoto,
          message?.profile_photo,
          message?.profilePhotoPath,
          message?.profile_photo_path,
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
        ),
        createdAt: isoCreatedAt
      };
    })
    .filter(Boolean);
}

function normalizeGalleryItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const itemObject = item && typeof item === "object" ? item : {};
      const src =
        typeof item === "string"
          ? item
          : firstText(
              itemObject.src,
              itemObject.url,
              itemObject.href,
              itemObject.photo,
              itemObject.photoUrl,
              itemObject.photo_url,
              itemObject.image,
              itemObject.imageUrl,
              itemObject.image_url,
              itemObject.attachment,
              itemObject.attachmentUrl,
              itemObject.attachment_url,
              itemObject.media,
              itemObject.mediaUrl,
              itemObject.media_url,
              itemObject.path
            );
      if (!src) return null;

      return {
        id: firstText(itemObject.id, itemObject._id, itemObject.galleryId, itemObject.gallery_id, itemObject.photoId, itemObject.photo_id, src),
        src,
        alt: firstText(itemObject.alt, itemObject.title, itemObject.name, itemObject.caption)
      };
    })
    .filter(Boolean);
}

function uniqueGalleryItems(items) {
  const seen = new Set();

  return items.filter((item) => {
    const src = String(item?.src || "").trim();
    if (!src || seen.has(src)) return false;
    seen.add(src);
    return true;
  });
}

function personGalleryItems(person) {
  if (!person) return [];

  const savedItems = normalizeGalleryItems(person.gallery);
  const commentItems = normalizePersonMessages(person.messages)
    .filter((message) => message.attachment)
    .map((message) => ({
      id: `comment-${message.id}`,
      src: message.attachment,
      alt: message.attachmentName || message.text || person.fullName || ""
    }));

  return uniqueGalleryItems([...savedItems, ...commentItems]);
}

function normalizePersonFlowers(person) {
  return {
    ...person,
    publicId: publicShrineIdFromSource(person, person?.id),
    flowers: normalizeFlowerGifts(person?.flowers),
    gallery: normalizeGalleryItems(person?.gallery),
    messages: normalizePersonMessages(person?.messages)
  };
}

function liveBlockedPersonIds(state) {
  return new Set(
    (state.live?.blockedPeople || [])
      .flatMap((person) => [person.personId, person.publicId, person.id])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
}

function removedLiveCommentIds(state) {
  return new Set((state.live?.removedCommentIds || []).map((value) => String(value || "").trim()).filter(Boolean));
}

function isPersonLiveBlocked(person, state) {
  const blockedIds = liveBlockedPersonIds(state);
  return blockedIds.has(String(person?.id || "")) || blockedIds.has(String(person?.publicId || ""));
}

function visiblePeopleForState(state) {
  const localBlocked = new Set((state.blocked || []).map(String));
  return (state.people || []).filter((person) => !localBlocked.has(String(person.id)) && !isPersonLiveBlocked(person, state));
}

function findVisiblePersonByShareId(state, personId) {
  return findPersonByShareId(visiblePeopleForState(state), personId);
}

function visiblePersonMessages(person, state) {
  const removed = removedLiveCommentIds(state);
  return normalizePersonMessages(person?.messages).filter((message) => !removed.has(String(message.id || "")));
}

function liveTermsForLanguage(state, language) {
  const lang = normalizeLanguage(language);
  const liveTerms = state.live?.terms?.[lang];
  return Array.isArray(liveTerms) && liveTerms.length ? liveTerms : termsSections[lang];
}

function userHasGivenFlowerToday(people, userId, dayKey = localDateKey()) {
  if (!userId) return false;

  return people.some((person) =>
    (person.flowers || []).some((flower) => flower.userId === userId && (flower.dayKey || localDateKey(flower.givenAt)) === dayKey)
  );
}

function yearFromDate(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? match[0] : "";
}

function ageFromBirthAndDeathYears(birthDate, deathDate) {
  const birthYearText = yearFromDate(birthDate);
  const deathYearText = yearFromDate(deathDate);
  if (!birthYearText || !deathYearText) return "";

  const birthYear = Number(birthYearText);
  const deathYear = Number(deathYearText);
  if (Number.isFinite(birthYear) && Number.isFinite(deathYear) && deathYear >= birthYear) {
    return String(deathYear - birthYear);
  }

  return "";
}

function personLifeYears(person, t) {
  const birthYear = yearFromDate(person?.birthDate);
  const deathYear = yearFromDate(person?.deathDate);
  return `(${birthYear || t("unknownBirth")} - ${deathYear || ""})`;
}

function personDisplayAge(person) {
  if (person?.age) return person.age;

  return ageFromBirthAndDeathYears(person?.birthDate, person?.deathDate);
}

function personCreatedDate(person) {
  if (person?.createdAt) return formatStoredDate(person.createdAt);

  const idTimestamp = Number(String(person?.id || "").split("-")[0]);
  if (Number.isFinite(idTimestamp) && idTimestamp > 0) {
    return formatStoredDate(idTimestamp);
  }

  return "";
}

function isDefaultPerson(person) {
  return defaultPeople.some((sample) => sample.id === person?.id) || person?.createdBy === "sample";
}

function canEditPersonShrine(person) {
  if (!person || isDefaultPerson(person)) return false;
  // Memorial edits are stored locally in this app, so stale creator ids from
  // shared/imported records should not lock the saved local copy.
  return true;
}

function canViewFlowerSenders(person, currentUser) {
  if (!person || defaultPeople.some((sample) => sample.id === person.id) || person.createdBy === "sample") return false;

  const creatorId = String(person.createdBy || "").trim();
  if (!person.importedFromShare) return true;
  if (!creatorId) return false;

  return creatorId === String(currentUser?.id || "");
}

function getUserName(user) {
  if (!user) return "Guest";
  return `${user.firstName || ""} ${user.surname || ""}`.trim() || user.email;
}

function userAvatarSource(user) {
  return firstText(
    user?.photo,
    user?.photoUrl,
    user?.photo_url,
    user?.photoPath,
    user?.photo_path,
    user?.avatar,
    user?.avatarUrl,
    user?.avatar_url,
    user?.avatarPath,
    user?.avatar_path,
    user?.profilePhoto,
    user?.profile_photo,
    user?.profilePhotoPath,
    user?.profile_photo_path
  );
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeAccountEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function canonicalAccountPhone(user) {
  const localDigits = normalizePhoneDigits(user?.phone).replace(/^0+/, "");
  const countryDigits = normalizePhoneDigits(user?.phoneCode);
  const otpDigits = normalizePhoneDigits(user?.otpPhone);

  if (countryDigits && localDigits) return `${countryDigits}${localDigits}`;
  return otpDigits;
}

function findUserByAccountPhone(users, user, ignoredUserId = "") {
  const targetPhone = canonicalAccountPhone(user);
  if (!targetPhone) return null;

  return users.find((item) => item.id !== ignoredUserId && canonicalAccountPhone(item) === targetPhone) || null;
}

function findUserByAccountEmail(users, email, ignoredUserId = "") {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!normalizedEmail) return null;

  return users.find((user) => user.id !== ignoredUserId && normalizeAccountEmail(user?.email) === normalizedEmail) || null;
}

function accountConflictKey(users, user, ignoredUserId = "") {
  if (findUserByAccountPhone(users, user, ignoredUserId)) return "phoneAlreadyExists";
  if (findUserByAccountEmail(users, user.email, ignoredUserId)) return "emailAlreadyExists";
  return "";
}

function resetPhoneCandidates(countryCode, phone) {
  const localDigits = normalizePhoneDigits(phone).replace(/^0+/, "");
  const countryDigits = normalizePhoneDigits(countryCode);
  return [...new Set([countryDigits && localDigits ? `${countryDigits}${localDigits}` : "", localDigits].filter(Boolean))];
}

function phoneLengthRange(country) {
  const codeDigits = normalizePhoneDigits(country?.code);
  const sample = countries.find((item) => normalizePhoneDigits(item.code) === codeDigits) || country;
  const iso = String(sample?.iso || "").toLowerCase();
  const exactLengths = {
    ae: [9],
    au: [9],
    ca: [10],
    eg: [10],
    gb: [10],
    kw: [8],
    qa: [8],
    sa: [9],
    us: [10]
  };
  const lengths = exactLengths[iso];
  if (lengths) return { min: Math.min(...lengths), max: Math.max(...lengths) };
  return { min: 7, max: 14 };
}

function localPhoneDigitsForCountry(phone, country) {
  const digits = normalizePhoneDigits(phone);
  const countryDigits = normalizePhoneDigits(country?.code);
  const withoutCountryCode = countryDigits && digits.startsWith(countryDigits) ? digits.slice(countryDigits.length) : digits;
  return withoutCountryCode.replace(/^0+/, "");
}

function isValidPhoneForCountry(phone, country) {
  const digits = localPhoneDigitsForCountry(phone, country);
  const { min, max } = phoneLengthRange(country);
  return digits.length >= min && digits.length <= max;
}

function userPhoneCandidates(user) {
  const localDigits = normalizePhoneDigits(user?.phone).replace(/^0+/, "");
  const countryDigits = normalizePhoneDigits(user?.phoneCode);
  const otpDigits = normalizePhoneDigits(user?.otpPhone);
  return [
    ...new Set([
      otpDigits,
      countryDigits && localDigits ? `${countryDigits}${localDigits}` : "",
      localDigits
    ].filter(Boolean))
  ];
}

function findUserByResetPhone(users, countryCode, phone) {
  const inputCandidates = resetPhoneCandidates(countryCode, phone);
  if (!inputCandidates.length) return null;

  return users.find((user) => {
    const savedCandidates = userPhoneCandidates(user);
    return savedCandidates.some((savedDigits) =>
      inputCandidates.some((inputDigits) => savedDigits === inputDigits || savedDigits.endsWith(inputDigits) || inputDigits.endsWith(savedDigits))
    );
  }) || null;
}

function findUserByResetEmail(users, email) {
  return findUserByAccountEmail(users, email);
}

function findCountry(name) {
  return findCountryExact(name) || countries[0];
}

function normalizeLanguage(language) {
  return language === "AR" ? "AR" : "EN";
}

function getPlatformFontClass() {
  if (typeof navigator === "undefined") return "android-font";

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIos =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && Number(navigator.maxTouchPoints) > 1);

  return isIos ? "ios-font" : "android-font";
}

function getNextLanguage(language) {
  return normalizeLanguage(language) === "AR" ? "EN" : "AR";
}

function translator(language) {
  const lang = normalizeLanguage(language);
  return (key) => copy[lang][key] || copy.EN[key] || key;
}

function inlineCopy(language, english, arabic) {
  return normalizeLanguage(language) === "AR" ? arabic : english;
}

const notificationTemplateKeys = {
  flowerPlaced: ["notificationFlowerPlacedTitle", "notificationFlowerPlacedBody"],
  memoryShared: ["notificationMemorySharedTitle", "notificationMemorySharedBody"],
  flowerFaded: ["notificationFlowerFadedTitle", "notificationFlowerFadedBody"],
  deathAnniversary: ["notificationDeathAnniversaryTitle", "notificationDeathAnniversaryBody"]
};

function notificationToastText(t, type, name) {
  const [titleKey, bodyKey] = notificationTemplateKeys[type] || [];
  if (!titleKey || !bodyKey) return "";

  const values = { name: name || "" };
  const title = formatText(t(titleKey), values).trim();
  const body = formatText(t(bodyKey), values).trim();
  return [title, body].filter(Boolean).join("\n");
}

function countryLabel(countryOrName, language) {
  const country = typeof countryOrName === "string" ? findCountry(countryOrName) : countryOrName;
  return normalizeLanguage(language) === "AR" ? country?.ar || country?.name || "" : country?.name || "";
}

function genderLabel(value, t) {
  if (value === "Male") return t("male");
  if (value === "Female") return t("female");
  return value || "";
}

function App() {
  const initialAppRef = useRef(null);
  if (!initialAppRef.current) {
    initialAppRef.current = loadInitialApp();
  }

  const [state, setState] = useState(initialAppRef.current.state);
  const language = normalizeLanguage(state.language);
  const t = translator(language);
  const isArabic = language === "AR";
  const platformFontClass = getPlatformFontClass();
  const [screen, setScreenState] = useState(initialAppRef.current.screen);
  const [opening, setOpening] = useState(true);
  const [homeIntroLoading, setHomeIntroLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [toastKind, setToastKind] = useState("");
  const [registerResetKey, setRegisterResetKey] = useState(0);
  const [sharedTarget, setSharedTarget] = useState(initialAppRef.current.sharedTarget);
  const [flowerScreenMode, setFlowerScreenMode] = useState("");
  const screenRef = useRef(screen);
  const screenHistoryRef = useRef([]);
  const apiShrineFetchRef = useRef(new Set());
  const apiCommentFetchRef = useRef(new Set());
  const liveSyncSignatureRef = useRef("");

  useEffect(() => {
    const splashTimer = setTimeout(() => setOpening(false), 2600);
    const loaderTimer = setTimeout(() => setHomeIntroLoading(false), 3600);
    return () => {
      clearTimeout(splashTimer);
      clearTimeout(loaderTimer);
    };
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadLiveData = async () => {
      const live = await fetchLiveData(controller.signal);
      if (!mounted || !live) return;
      setState((current) => ({ ...current, live }));
    };

    loadLiveData();
    const interval = setInterval(loadLiveData, LIVE_POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const payload = createLiveSyncPayload(state);
    const signature = JSON.stringify(payload);
    if (signature === liveSyncSignatureRef.current) return undefined;

    const timer = setTimeout(async () => {
      liveSyncSignatureRef.current = signature;
      const live = await syncLiveState(state);
      if (live) {
        setState((current) => ({ ...current, live }));
      }
    }, LIVE_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.currentUser, state.people, state.users]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    const selectedPerson = screen === "detail" ? findVisiblePersonByShareId(state, state.selectedPersonId) : null;
    updateDocumentPreviewMeta(selectedPerson);
  }, [screen, state.people, state.selectedPersonId]);

  useEffect(() => {
    const personId = state.selectedPersonId;
    const existingPerson = findVisiblePersonByShareId(state, personId);
    const shouldLoadSharedShrine =
      personId &&
      sharedTarget?.personId === personId &&
      !existingPerson &&
      !apiShrineFetchRef.current.has(personId);

    if (!shouldLoadSharedShrine) return undefined;

    apiShrineFetchRef.current.add(personId);
    const controller = new AbortController();

    fetchShrineById(personId, controller.signal).then((person) => {
      if (!person) return;

      setState((current) => {
        if (findPersonByShareId(current.people, person.id) || findPersonByShareId(current.people, person.publicId)) return current;
        return {
          ...current,
          selectedPersonId: person.id,
          people: [person, ...current.people]
        };
      });
    });

    return () => controller.abort();
  }, [sharedTarget, state.people, state.selectedPersonId]);

  useEffect(() => {
    const personId = state.selectedPersonId;
    const commentId = sharedTarget?.type === "comment" ? sharedTarget.commentId || "" : "";
    const person = findVisiblePersonByShareId(state, personId);
    const fetchKey = `${person?.id || personId}:${commentId}`;
    const shouldLoadSharedComment =
      personId &&
      commentId &&
      commentId !== "info" &&
      person &&
      !normalizePersonMessages(person.messages).some((message) => message.id === commentId) &&
      !apiCommentFetchRef.current.has(fetchKey);

    if (!shouldLoadSharedComment) return undefined;

    apiCommentFetchRef.current.add(fetchKey);
    const controller = new AbortController();

    fetchShrineCommentById(personId, commentId, controller.signal).then((message) => {
      if (!message) return;

      setState((current) => ({
        ...current,
        people: current.people.map((item) => {
          if (!personMatchesShareId(item, personId)) return item;
          const messages = normalizePersonMessages(item.messages);
          if (messages.some((existing) => existing.id === message.id)) return item;
          return normalizePersonFlowers({
            ...item,
            messages: [...messages, message]
          });
        })
      }));
    });

    return () => controller.abort();
  }, [sharedTarget, state.people, state.selectedPersonId]);

  const setScreen = (nextScreen, options = {}) => {
    const targetScreen = typeof nextScreen === "function" ? nextScreen(screenRef.current) : nextScreen;
    if (!targetScreen || targetScreen === screenRef.current) return;

    setSharedTarget(null);
    if (targetScreen !== "flowers") {
      setFlowerScreenMode("");
    }
    const currentScreen = screenRef.current;
    screenRef.current = targetScreen;
    if (options.reset) {
      screenHistoryRef.current = [];
    } else if (!options.replace) {
      screenHistoryRef.current = [...screenHistoryRef.current, currentScreen].slice(-30);
    }
    setScreenState(targetScreen);
  };

  const goBack = (fallbackScreen = "home") => {
    const safeFallbackScreen = typeof fallbackScreen === "string" ? fallbackScreen : "home";
    const nextHistory = [...screenHistoryRef.current];
    let previousScreen = nextHistory.pop();
    while (previousScreen === screenRef.current && nextHistory.length) {
      previousScreen = nextHistory.pop();
    }

    const targetScreen = previousScreen || safeFallbackScreen;
    screenHistoryRef.current = nextHistory;

    if (targetScreen && targetScreen !== screenRef.current) {
      screenRef.current = targetScreen;
      setScreenState(targetScreen);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    detectNetworkCountry(controller.signal).then((networkCountry) => {
      if (!networkCountry) return;

      setState((current) => {
        if (current.countryPreferenceTouched || current.currentUser) return current;

        const nextCountryName = networkCountry.name;
        const currentCountryName = normalizeCountryName(current.currentCountry, initialState.currentCountry);
        const nextHomeFilter =
          !current.homeFilter || current.homeFilter === currentCountryName || current.homeFilter === LEGACY_DEFAULT_COUNTRY_NAME
            ? nextCountryName
            : current.homeFilter;

        if (current.currentCountry === nextCountryName && current.homeFilter === nextHomeFilter) {
          return current;
        }

        return {
          ...current,
          currentCountry: nextCountryName,
          homeFilter: nextHomeFilter
        };
      });
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => {
      setToast("");
      setToastKind("");
    }, 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  const showToast = (message, kind = "") => {
    setToastKind(kind);
    setToast(message);
  };

  useEffect(() => {
    const userId = state.currentUser?.id;
    if (!userId || typeof window === "undefined") return undefined;

    const notifyFadedFlowers = () => {
      const notices = expiredUserFlowerNotices(state.people, userId, state.flowerFadeNotices);
      if (!notices.length) return;

      const firstNotice = notices[0];
      showToast(notificationToastText(t, "flowerFaded", firstNotice.personName) || t("notificationFlowerFadedBody"));

      setState((current) => {
        const currentUserId = current.currentUser?.id;
        if (!currentUserId) return current;

        const existingNotices = Array.isArray(current.flowerFadeNotices) ? current.flowerFadeNotices : [];
        const nextNotices = expiredUserFlowerNotices(current.people, currentUserId, existingNotices);
        if (!nextNotices.length) return current;

        return {
          ...current,
          flowerFadeNotices: [...existingNotices, ...nextNotices.map((notice) => notice.id)].slice(-500)
        };
      });
    };

    notifyFadedFlowers();
    const intervalId = window.setInterval(notifyFadedFlowers, FLOWER_FADE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [language, state.currentUser?.id, state.flowerFadeNotices, state.people]);

  const updateState = (patch) => {
    setState((current) => {
      const normalizedPatch = { ...patch };
      if (Object.prototype.hasOwnProperty.call(normalizedPatch, "language")) {
        normalizedPatch.language = normalizeLanguage(normalizedPatch.language);
      }
      if (Object.prototype.hasOwnProperty.call(normalizedPatch, "currentCountry")) {
        normalizedPatch.currentCountry = normalizeCountryName(
          normalizedPatch.currentCountry,
          current.currentCountry || initialState.currentCountry
        );
        normalizedPatch.countryPreferenceTouched = true;
      }
      if (Object.prototype.hasOwnProperty.call(normalizedPatch, "homeFilter")) {
        normalizedPatch.homeFilter = normalizeCountryFilter(
          normalizedPatch.homeFilter,
          normalizedPatch.currentCountry || current.currentCountry || initialState.currentCountry
        );
      }

      const next = { ...current, ...normalizedPatch };
      if (!Object.prototype.hasOwnProperty.call(normalizedPatch, "language") || !next.currentUser) {
        return next;
      }

      const currentUser = { ...next.currentUser, language: normalizedPatch.language };
      return {
        ...next,
        currentUser,
        users: next.users.map((user) => (user.id === currentUser.id ? currentUser : user))
      };
    });
  };

  const toggleLanguage = (requestedLanguage) => {
    updateState({ language: requestedLanguage ? normalizeLanguage(requestedLanguage) : getNextLanguage(language) });
  };

  const addPerson = (person) => {
    const personId = uid();
    const publicId = createShrinePublicId();

    setState((current) => {
      const country = normalizeCountryName(person.country, current.currentCountry || initialState.currentCountry);
      const newPerson = normalizePersonFlowers({
        ...person,
        id: personId,
        publicId,
        fullName: person.fullName.trim(),
        surnameCheck: person.surnameCheck.trim(),
        country,
        createdAt: new Date().toISOString(),
        createdLocally: true,
        createdBy: current.currentUser?.id || "guest",
        createdByName: current.currentUser ? getUserName(current.currentUser) : "",
        flowers: [],
        messages: []
      });

      return {
        ...current,
        selectedPersonId: personId,
        currentCountry: country,
        homeFilter: country,
        countryPreferenceTouched: true,
        people: [newPerson, ...current.people]
      };
    });
    showToast(t("memorialCreated"));
    setScreen("detail", { reset: true });
  };

  const updatePerson = (person) => {
    const personId = state.selectedPersonId;
    if (!personId) return;

    setState((current) => ({
      ...current,
      people: current.people.map((item) =>
        item.id === personId || personMatchesShareId(item, personId)
          ? normalizePersonFlowers({
              ...item,
              ...person,
              fullName: person.fullName.trim(),
              surnameCheck: person.surnameCheck.trim(),
              country: normalizeCountryName(person.country, item.country || current.currentCountry),
              updatedAt: new Date().toISOString()
            })
          : item
      )
    }));
    showToast(t("memorialUpdated"));
    setScreen("detail", { replace: true });
  };

  const giveFlowerToPerson = (personId, flowerType = INITIAL_FLOWER_TYPE) => {
    const user = state.currentUser;
    if (!user) {
      setModal({ type: "accountPrompt", intent: "flower" });
      return false;
    }

    const dayKey = localDateKey();
    if (userHasGivenFlowerToday(state.people, user.id, dayKey)) {
      return false;
    }

    const flower = {
      id: uid(),
      userId: user.id,
      userName: getUserName(user),
      flowerType: normalizeFlowerType(flowerType),
      givenAt: new Date().toISOString(),
      dayKey
    };

    setState((current) => ({
      ...current,
      people: current.people.map((person) => {
        const flowers = normalizeFlowerGifts(person.flowers);
        if (person.id !== personId) return { ...person, flowers };
        return { ...person, flowers: [...flowers, flower] };
      })
    }));
    const personName = state.people.find((person) => person.id === personId)?.fullName || t("memorial");
    showToast(notificationToastText(t, "flowerPlaced", personName) || t("flowerAdded"));
    return true;
  };

  const sendMessageToPerson = (personId, message) => {
    const text = String(message?.text || "").trim();
    const attachment = String(message?.attachment || "").trim();
    if (!personId || (!text && !attachment)) return false;

    const user = state.currentUser;
    if (!user) {
      setModal({ type: "accountPrompt", intent: "message" });
      return false;
    }

    const nextMessage = {
      id: uid(),
      text,
      attachment,
      attachmentName: String(message?.attachmentName || "").trim(),
      userId: user.id,
      userName: getUserName(user),
      userPhoto: user?.photo || user?.avatar || "",
      createdAt: new Date().toISOString()
    };

    setState((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.id === personId
          ? normalizePersonFlowers({
              ...person,
              messages: [...normalizePersonMessages(person.messages), nextMessage]
            })
          : person
      )
    }));
    const personName = state.people.find((person) => person.id === personId)?.fullName || t("memorial");
    showToast(notificationToastText(t, "memoryShared", personName) || t("postAdded"));
    return true;
  };

  const registerUser = (user) => {
    const accountCountry = findCountry(user.country || state.currentCountry);
    const completeUser = {
      ...user,
      email: normalizeAccountEmail(user.email),
      country: accountCountry.name,
      id: uid(),
      createdAt: new Date().toISOString()
    };
    const conflictKey = accountConflictKey(state.users, completeUser);
    if (conflictKey) {
      setModal(null);
      setScreen("register", { replace: true });
      showToast(t(conflictKey));
      return false;
    }

    setState((current) => ({
      ...current,
      currentUser: completeUser,
      users: [completeUser, ...current.users],
      guest: false,
      language: user.language,
      currentCountry: accountCountry.name,
      homeFilter: accountCountry.name,
      countryPreferenceTouched: true
    }));
    setScreen("success", { replace: true });
    return true;
  };

  const cancelRegistrationAttempt = () => {
    setModal(null);
    setRegisterResetKey((key) => key + 1);
    setScreen("register", { replace: true });
    showToast(t("registrationCancelled"));
  };

  const loginUser = (identifier, password) => {
    const identifierDigits = normalizePhoneDigits(identifier);
    const user = state.users.find((item) => {
      const mobileMatches = Boolean(
        identifierDigits &&
          userPhoneCandidates(item).some(
            (savedDigits) =>
              savedDigits === identifierDigits || savedDigits.endsWith(identifierDigits) || identifierDigits.endsWith(savedDigits)
          )
      );
      return item.password === password && mobileMatches;
    });
    if (!user) {
      showToast(t("badLogin"));
      return false;
    }
    const authenticatedUser = {
      ...user,
      otpPhone: user.otpPhone || `${user.phoneCode || ""}${String(user.phone || "").replace(/^0+/, "")}`
    };
    const accountCountry = findCountry(authenticatedUser.country || state.currentCountry);
    updateState({
      currentUser: authenticatedUser,
      guest: false,
      language: user.language || state.language,
      currentCountry: accountCountry.name,
      homeFilter: accountCountry.name
    });
    setScreen("home", { reset: true });
    return true;
  };

  const openPasswordReset = ({ phoneCountry, phone } = {}) => {
    setModal({
      type: "resetPassword",
      phoneCountry: phoneCountry || findCountry(state.currentCountry || initialState.currentCountry),
      phone: phone || ""
    });
  };

  const verifyPasswordResetUser = (user, preferredChannel = "mobile") => {
    const accountCountry = findCountry(user.phoneCountry || user.country || state.currentCountry || initialState.currentCountry);
    const phoneDigits = normalizePhoneDigits(user.phone).replace(/^0+/, "");
    const userForOtp = {
      ...user,
      phoneCountry: user.phoneCountry || accountCountry.name,
      phoneCode: user.phoneCode || accountCountry.code,
      phoneIso: user.phoneIso || accountCountry.iso,
      otpPhone: user.otpPhone || (phoneDigits ? `${accountCountry.code}${phoneDigits}` : "")
    };

    setModal({
      type: "verify",
      user: userForOtp,
      preferredChannel,
      onProceed: () => {
        setModal({ type: "newPassword", user: userForOtp });
      }
    });
  };

  const resetUserPassword = (user, password) => {
    setState((current) => {
      let updatedCurrentUser = current.currentUser;
      const users = current.users.map((item) => {
        if (item.id !== user.id) return item;
        const updatedUser = { ...item, password };
        if (current.currentUser?.id === item.id) {
          updatedCurrentUser = updatedUser;
        }
        return updatedUser;
      });

      return {
        ...current,
        users,
        currentUser: updatedCurrentUser
      };
    });
    setModal(null);
    setScreen("login", { replace: true });
    showToast(t("passwordResetSuccess"));
  };

  const logout = () => {
    setModal({ type: "logoutConfirm" });
  };

  const confirmLogout = () => {
    setModal(null);
    updateState({ currentUser: null, guest: true });
    setScreen("login", { reset: true });
    showToast(t("logoutSuccess"), "logout");
  };

  const activeUser = state.currentUser;
  const canUseAccount = Boolean(activeUser);

  const commonProps = {
    state,
    language,
    t,
    updateState,
    setScreen,
    goBack,
    setModal,
    setToast: showToast,
    activeUser,
    canUseAccount,
    onGiveFlower: giveFlowerToPerson,
    onSendMessage: sendMessageToPerson,
    toggleLanguage,
    sharedTarget,
    flowerScreenMode,
    setFlowerScreenMode,
    onSharedTargetHandled: () => setSharedTarget(null)
  };

  const selectedPerson = findVisiblePersonByShareId(state, state.selectedPersonId);
  const canEditSelectedShrine = canEditPersonShrine(selectedPerson, state.currentUser);
  const accountPromptOpen = modal?.type === "accountPrompt";

  return (
    <div className={`app-shell ${platformFontClass} ${isArabic ? "rtl" : ""}${accountPromptOpen ? " account-prompt-open" : ""}`} dir={isArabic ? "rtl" : "ltr"} lang={isArabic ? "ar" : "en"}>
      {opening && <SplashIntro />}
      {screen === "register" && (
        <RegisterScreen
          key={registerResetKey}
          state={state}
          language={language}
          t={t}
          updateState={updateState}
          onRegister={registerUser}
          onCancelRegistration={cancelRegistrationAttempt}
          onLogin={() => setScreen("login")}
          onGuest={() => {
            updateState({ guest: true });
            setScreen("home", { reset: true });
          }}
          goBack={goBack}
          setModal={setModal}
          setToast={showToast}
        />
      )}
      {screen === "login" && (
        <LoginScreen
          state={state}
          language={language}
          t={t}
          toggleLanguage={toggleLanguage}
          onLogin={loginUser}
          onForgotPassword={openPasswordReset}
          onBack={goBack}
          setScreen={setScreen}
          setModal={setModal}
        />
      )}
      {screen === "success" && (
        <SuccessScreen
          state={state}
          language={language}
          t={t}
          toggleLanguage={toggleLanguage}
          setScreen={setScreen}
          goBack={goBack}
        />
      )}
      {screen === "home" && <HomeScreen {...commonProps} bootLoading={homeIntroLoading && !opening} />}
      {screen === "add" && <AddScreen key="add" {...commonProps} onSubmit={addPerson} />}
      {screen === "editShrine" && (
        <AddScreen
          key={`edit-${state.selectedPersonId || "missing"}`}
          {...commonProps}
          mode="update"
          initialPerson={canEditSelectedShrine ? selectedPerson : null}
          onSubmit={updatePerson}
        />
      )}
      {screen === "search" && <SearchScreen {...commonProps} />}
      {screen === "settings" && <SettingsScreen {...commonProps} logout={logout} />}
      {screen === "profile" && <ProfileScreen {...commonProps} />}
      {screen === "editProfile" && <EditProfileScreen {...commonProps} />}
      {screen === "userDashboard" && <UserDashboardScreen {...commonProps} />}
      {screen === "admin" && <AdminDashboardScreen {...commonProps} />}
      {screen === "blocked" && <BlockedUsersScreen {...commonProps} />}
      {screen === "terms" && <TermsScreen {...commonProps} />}
      {screen === "contact" && <ContactScreen {...commonProps} />}
      {screen === "detail" && <DetailScreen {...commonProps} />}
      {screen === "gallery" && <GalleryScreen {...commonProps} />}
      {screen === "flowers" && <FlowerScreen {...commonProps} />}
      {screen === "message" && <MessageScreen {...commonProps} />}

      {["home", "add", "search", "settings"].includes(screen) && (
        <BottomNav active={screen === "detail" ? "home" : screen} setScreen={setScreen} setModal={setModal} canUseAccount={canUseAccount} t={t} />
      )}
      {screen === "detail" && (
        <BottomNav
          variant="detail"
          active="home"
          canEditShrine={canEditSelectedShrine}
          setScreen={setScreen}
          setModal={setModal}
          canUseAccount={canUseAccount}
          t={t}
        />
      )}

      {modal?.type === "country" && (
        <CountryModal
          title={modal.title || t("country")}
          language={language}
          t={t}
          onPick={(country) => {
            modal.onPick(country);
            setModal(null);
          }}
          onClose={() => setModal(null)}
          withCodes={modal.withCodes}
          selectedCountry={modal.selectedCountry}
        />
      )}
      {modal?.type === "gender" && (
        <Sheet onClose={() => setModal(null)}>
          <h2 className="sheet-title">{t("gender")}</h2>
          {["Male", "Female"].map((gender) => (
            <button
              key={gender}
              className="sheet-row"
              onClick={() => {
                modal.onPick(gender);
                setModal(null);
              }}
            >
              {genderLabel(gender, t)}
            </button>
          ))}
        </Sheet>
      )}
      {modal?.type === "age" && (
        <AgeModal
          value={modal.value}
          t={t}
          onCancel={() => setModal(null)}
          onSave={(value) => {
            modal.onPick(value);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "verify" && (
        <VerifyModal
          user={modal.user}
          language={language}
          t={t}
          toggleLanguage={toggleLanguage}
          initialChannel={modal.preferredChannel}
          autoSendInitial={modal.autoSend}
          requireChannelChoice={modal.requireChannelChoice}
          onCancel={() => setModal(null)}
          onBackFromCode={modal.onBackFromCode}
          onLoginFromCode={modal.onLoginFromCode}
          onProceed={() => {
            setModal(null);
            modal.onProceed();
          }}
        />
      )}
      {modal?.type === "resetPassword" && (
        <ResetPasswordModal
          state={state}
          language={language}
          t={t}
          initialPhoneCountry={modal.phoneCountry}
          initialPhone={modal.phone}
          onClose={() => setModal(null)}
          onContinue={verifyPasswordResetUser}
        />
      )}
      {modal?.type === "newPassword" && (
        <NewPasswordModal
          user={modal.user}
          t={t}
          onClose={() => setModal(null)}
          onSave={resetUserPassword}
        />
      )}
      {modal?.type === "flower" && (
        <FlowerModal
          t={t}
          onClose={() => setModal(null)}
          onGive={(flowerType) => {
            const added = giveFlowerToPerson(modal.personId, flowerType);
            if (added) {
              setModal(null);
            }
            return added;
          }}
        />
      )}
      {modal?.type === "accountPrompt" && (
        <AccountPrompt
          t={t}
          intent={modal.intent}
          onClose={() => setModal(null)}
          onCreate={() => {
            setModal(null);
            setScreen("register");
          }}
          onLogin={() => {
            setModal(null);
            setScreen("login");
          }}
          onContinueBrowsing={() => {
            setModal(null);
            updateState({ guest: true });
            setScreen("home", { reset: true });
          }}
        />
      )}
      {modal?.type === "logoutConfirm" && <LogoutConfirmModal t={t} onCancel={() => setModal(null)} onConfirm={confirmLogout} />}
      {modal?.type === "aiSoon" && <AiSoonModal onClose={() => setModal(null)} />}
      {toast && <div className={`toast ${toastKind ? `toast-${toastKind}` : ""}`}>{toast}</div>}
    </div>
  );
}

function SplashIntro() {
  return (
    <div className="splash-intro" aria-hidden="true">
      <div className="splash-rays" />
      <div className="splash-glow" />
    </div>
  );
}

function Header({ title, back, backIcon, action, compact = false, flagCountry, onFlag, language = "EN", t = translator("EN") }) {
  return (
    <header className={`top-header ${compact ? "compact" : ""}`}>
      {back && (
        <button className="header-icon left" onClick={back} aria-label={t("back")}>
          {backIcon || <ArrowLeft size={32} />}
        </button>
      )}
      <div className="rays" />
      <h1>{title}</h1>
      {flagCountry && (
        <button className="flag-button" onClick={onFlag} aria-label={t("country")}>
          <Flag country={flagCountry} large />
          <ChevronDown size={28} />
        </button>
      )}
      {action && <div className="header-action">{action}</div>}
    </header>
  );
}

function LanguageButton({ value, onClick }) {
  const language = normalizeLanguage(value);
  const ariaLabel = language === "AR" ? "تغيير اللغة" : "Change language";
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [open]);

  const selectLanguage = (nextLanguage) => {
    setOpen(false);
    if (nextLanguage !== language) {
      onClick?.(nextLanguage);
    }
  };

  return (
    <div className={`language-picker ${open ? "open" : ""}`} ref={menuRef}>
      <button
        type="button"
        className="language-mini"
        onClick={() => setOpen((value) => !value)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{language}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="language-menu" role="listbox" aria-label={ariaLabel}>
          {["EN", "AR"].map((option) => (
            <button
              type="button"
              key={option}
              className={option === language ? "selected" : ""}
              role="option"
              aria-selected={option === language}
              onClick={() => selectLanguage(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RegisterScreen({ state, language, t, updateState, onRegister, onCancelRegistration, onLogin, onGuest, goBack, setModal, setToast }) {
  const [form, setForm] = useState(() => {
    const accountCountry = findCountry(state.currentCountry || initialState.currentCountry);

    return {
      language: state.language || "EN",
      firstName: "",
      surname: "",
      phoneCountry: accountCountry,
      phone: "",
      email: "",
      gender: "",
      country: accountCountry.name,
      password: "",
      confirmPassword: ""
    };
  });
  const [countryTouched, setCountryTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (countryTouched) return;
    const accountCountry = findCountry(state.currentCountry || initialState.currentCountry);

    setForm((current) => {
      if (current.country === accountCountry.name && current.phoneCountry?.name === accountCountry.name) {
        return current;
      }

      return {
        ...current,
        phoneCountry: accountCountry,
        country: accountCountry.name
      };
    });
  }, [countryTouched, state.currentCountry]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setAccountCountry = (country) => {
    setCountryTouched(true);
    setForm((current) => ({
      ...current,
      phoneCountry: country,
      country: country.name
    }));
  };

  const setLanguage = (requestedLanguage) => {
    const nextLanguage = requestedLanguage ? normalizeLanguage(requestedLanguage) : getNextLanguage(form.language);
    setField("language", nextLanguage);
    updateState({ language: nextLanguage });
  };

  const submit = () => {
    const cleanPhone = normalizePhoneDigits(form.phone);
    const cleanEmail = normalizeAccountEmail(form.email);
    const pendingUser = {
      phone: cleanPhone,
      phoneCode: form.phoneCountry.code,
      otpPhone: `${form.phoneCountry.code}${cleanPhone.replace(/^0+/, "")}`,
      email: cleanEmail
    };
    const nextErrors = {};
    let duplicateMessage = "";
    if (!form.firstName.trim()) nextErrors.firstName = t("errFirstName");
    if (!form.surname.trim()) nextErrors.surname = t("errSurname");
    if (!/^\d{7,14}$/.test(cleanPhone)) nextErrors.phone = t("errPhone");
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) nextErrors.email = t("errEmail");
    if (!form.gender) nextErrors.gender = t("errGender");
    if (!form.password) nextErrors.password = t("errPassword");
    if (form.password.length > 0 && form.password.length < 8) {
      nextErrors.password = t("errPasswordLength");
    }
    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = t("errPasswordMatch");
    }
    if (!nextErrors.phone && findUserByAccountPhone(state.users, pendingUser)) {
      nextErrors.phone = t("phoneAlreadyExists");
      duplicateMessage = nextErrors.phone;
    }
    if (!nextErrors.email && findUserByAccountEmail(state.users, cleanEmail)) {
      nextErrors.email = t("emailAlreadyExists");
      duplicateMessage ||= nextErrors.email;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToast(duplicateMessage || t("startRequired"));
      return;
    }

    const user = {
      ...form,
      phone: cleanPhone,
      email: cleanEmail,
      phoneCountry: form.phoneCountry.name,
      phoneCode: form.phoneCountry.code,
      phoneIso: form.phoneCountry.iso,
      otpPhone: pendingUser.otpPhone
    };

    setModal({
      type: "verify",
      user,
      requireChannelChoice: true,
      onBackFromCode: onCancelRegistration,
      onLoginFromCode: () => {
        setModal(null);
        onLogin();
      },
      onProceed: () => onRegister(user)
    });
  };

  return (
    <main className="auth-screen scroll-screen">
      <div className="auth-topbar">
        <button type="button" className="auth-back-button" onClick={goBack} aria-label={t("back")}>
          <ArrowLeft size={30} />
        </button>
        <LanguageButton
          value={form.language}
          onClick={setLanguage}
        />
      </div>
      <section className="auth-intro">
        <h1>{t("registerTitle")}</h1>
        <p>{t("registerIntro")}</p>
      </section>

      <div className="two-grid">
        <Input
          label={t("firstName")}
          placeholder={t("firstName")}
          value={form.firstName}
          error={errors.firstName}
          onChange={(value) => setField("firstName", value)}
        />
        <Input
          label={t("surname")}
          placeholder={t("surname")}
          value={form.surname}
          error={errors.surname}
          onChange={(value) => setField("surname", value)}
        />
      </div>

      <label className="field-label">{t("mobileNumber")}</label>
      <div className={`phone-field ${errors.phone ? "has-error" : ""}`}>
        <button
          className="country-code-button"
          onClick={() =>
            setModal({
              type: "country",
              title: t("selectCallingCode"),
              withCodes: true,
              selectedCountry: form.phoneCountry.name,
              onPick: setAccountCountry
            })
          }
        >
          <ChevronDown size={18} />
          <Flag country={form.phoneCountry} />
          <span>{form.phoneCountry.code}</span>
        </button>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="1234567891"
          maxLength={14}
          value={form.phone}
          onChange={(event) => setField("phone", event.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="counter">{form.phone.length}/14</div>
      {errors.phone && <p className="error-text">* {errors.phone}</p>}

      <Input
        label={t("emailAddress")}
        placeholder="email@example.com"
        type="email"
        value={form.email}
        error={errors.email}
        onChange={(value) => setField("email", value)}
      />

      <SelectField
        label={t("gender")}
        placeholder={t("gender")}
        value={genderLabel(form.gender, t)}
        error={errors.gender}
        onClick={() =>
          setModal({
            type: "gender",
            onPick: (gender) => setField("gender", gender)
          })
        }
      />

      <SelectField
        label={t("country")}
        value={countryLabel(form.country, language)}
        onClick={() =>
          setModal({
            type: "country",
            title: t("country"),
            selectedCountry: form.country,
            onPick: setAccountCountry
          })
        }
      />

      <PasswordInput
        label={t("password")}
        value={form.password}
        error={errors.password}
        visible={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
        onChange={(value) => setField("password", value)}
        t={t}
      />
      <PasswordInput
        label={t("confirmPassword")}
        value={form.confirmPassword}
        error={errors.confirmPassword}
        visible={showConfirm}
        onToggle={() => setShowConfirm((value) => !value)}
        onChange={(value) => setField("confirmPassword", value)}
        t={t}
      />

      <button className="primary-button" onClick={submit}>
        {t("continue")}
      </button>
      <button className="text-link wide" onClick={onLogin}>
        {t("alreadyHaveAccount")} <span>{t("login")}</span>
      </button>
      <button className="ghost-link" onClick={onGuest}>
        {t("continueBrowsing")}
      </button>
    </main>
  );
}

function ResetPasswordModal({ state, language, t, initialPhoneCountry, initialPhone = "", onContinue, onClose }) {
  const startingCountry = findCountry(initialPhoneCountry?.name || initialPhoneCountry || state.currentCountry || initialState.currentCountry);
  const [method, setMethod] = useState("mobile");
  const [phoneCountry, setPhoneCountry] = useState(startingCountry);
  const [phone, setPhone] = useState(() => normalizePhoneDigits(initialPhone).slice(0, 14));
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const recoveryMethods = [
    { id: "mobile", label: t("mobileNumber") },
    { id: "email", label: t("emailAddress") }
  ];

  const chooseMethod = (nextMethod) => {
    setMethod(nextMethod);
    setError("");
  };

  const setPhoneValue = (value) => {
    setPhone(normalizePhoneDigits(value).slice(0, 14));
    setError("");
  };

  const setEmailValue = (value) => {
    setEmail(value);
    setError("");
  };

  const submit = (event) => {
    event.preventDefault();
    if (method === "email") {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        setError(t("errEmail"));
        return;
      }

      const user = findUserByResetEmail(state.users, cleanEmail);
      if (!user) {
        setError(t("resetEmailAccountNotFound"));
        return;
      }

      onContinue(user, "email");
      return;
    }

    const cleanPhone = normalizePhoneDigits(phone);
    if (!/^\d{7,14}$/.test(cleanPhone)) {
      setError(t("errPhone"));
      return;
    }

    const user = findUserByResetPhone(state.users, phoneCountry.code, cleanPhone);
    if (!user) {
      setError(t("resetAccountNotFound"));
      return;
    }

    onContinue(user, "mobile");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="reset-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close-button" onClick={onClose} aria-label={t("cancel")}>
          <X size={24} />
        </button>
        <h2>{t("forgotPassword")}</h2>
        <p>{method === "email" ? t("resetPasswordEmailIntro") : t("resetPasswordPhoneIntro")}</p>
        <div className="reset-method-tabs" role="group" aria-label={t("resetPasswordIntro")}>
          {recoveryMethods.map((option) => (
            <button
              key={option.id}
              type="button"
              className={method === option.id ? "active" : ""}
              aria-pressed={method === option.id}
              onClick={() => chooseMethod(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {method === "mobile" ? (
          <>
            <label className="field-label">{t("mobileNumber")}</label>
            <div className={`phone-field ${error ? "has-error" : ""}`}>
              <button type="button" className="country-code-button" onClick={() => setCountryPickerOpen(true)}>
                <ChevronDown size={18} />
                <Flag country={phoneCountry} />
                <span>{phoneCountry.code}</span>
              </button>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="1234567891"
                maxLength={14}
                value={phone}
                onChange={(event) => setPhoneValue(event.target.value)}
              />
            </div>
            <div className="counter">{phone.length}/14</div>
          </>
        ) : (
          <Input
            label={t("emailAddress")}
            placeholder="email@example.com"
            type="email"
            value={email}
            error={error}
            onChange={setEmailValue}
          />
        )}
        {method === "mobile" && error && <p className="error-text">* {error}</p>}
        <button className="primary-button" type="submit">
          {t("send")}
        </button>
        <p className="reset-recovery-help">{t("resetRecoveryHelp")}</p>
        <button type="button" className="ghost-link reset-cancel-link" onClick={onClose}>
          {t("cancel")}
        </button>
      </form>
      {countryPickerOpen && (
        <div onClick={(event) => event.stopPropagation()}>
          <CountryModal
            title={t("selectCallingCode")}
            language={language}
            t={t}
            withCodes
            selectedCountry={phoneCountry.name}
            onPick={(country) => {
              setPhoneCountry(country);
              setCountryPickerOpen(false);
              setError("");
            }}
            onClose={() => setCountryPickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function NewPasswordModal({ user, t, onSave, onClose }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!password) {
      nextErrors.password = t("errPassword");
    } else if (password.length < 8) {
      nextErrors.password = t("errPasswordLength");
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = t("errPasswordMatch");
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(user, password);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="reset-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close-button" onClick={onClose} aria-label={t("cancel")}>
          <X size={24} />
        </button>
        <h2>{t("newPasswordTitle")}</h2>
        <p>{t("newPasswordIntro")}</p>
        <PasswordInput
          label={t("newPassword")}
          value={password}
          error={errors.password}
          visible={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
          onChange={setPassword}
          t={t}
        />
        <PasswordInput
          label={t("confirmPassword")}
          value={confirmPassword}
          error={errors.confirmPassword}
          visible={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((value) => !value)}
          onChange={setConfirmPassword}
          t={t}
        />
        <button className="primary-button" type="submit">
          {t("save")}
        </button>
      </form>
    </div>
  );
}

function LoginScreen({ state, language, t, toggleLanguage, onLogin, onForgotPassword, onBack, setScreen }) {
  const [phoneCountry, setPhoneCountry] = useState(() => findCountry(state.currentCountry || initialState.currentCountry));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [errors, setErrors] = useState({
    identifier: "identifierRequired",
    password: "passwordRequired"
  });

  useEffect(() => {
    setPhoneCountry(findCountry(state.currentCountry || initialState.currentCountry));
  }, [state.currentCountry]);

  useEffect(() => {
    setErrors((current) => ({
      identifier: identifier ? current.identifier : "identifierRequired",
      password: password ? current.password : "passwordRequired"
    }));
  }, [identifier, language, password, phoneCountry]);

  const setIdentifierValue = (value) => {
    setIdentifier(value);
    setErrors((current) => ({
      ...current,
      identifier: value.trim() ? "" : "identifierRequired"
    }));
  };

  const setPasswordValue = (value) => {
    setPassword(value);
    setErrors((current) => ({
      ...current,
      password: value ? "" : "passwordRequired"
    }));
  };

  const submit = () => {
    const cleanIdentifier = identifier.trim();
    const phoneDigits = normalizePhoneDigits(cleanIdentifier);
    const localDigits = localPhoneDigitsForCountry(phoneDigits, phoneCountry);
    const phoneValid = /^[+\d\s().-]+$/.test(cleanIdentifier) && isValidPhoneForCountry(phoneDigits, phoneCountry);
    const nextErrors = {};
    if (!cleanIdentifier) {
      nextErrors.identifier = "identifierRequired";
    } else if (!phoneValid) {
      nextErrors.identifier = "errEmailOrPhone";
    }
    if (!password) nextErrors.password = "passwordRequired";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onLogin(`${phoneCountry.code}${localDigits}`, password);
  };

  const openReset = () => {
    const phoneDigits = normalizePhoneDigits(identifier);
    const phone = /^[+\d\s().-]+$/.test(identifier.trim()) ? phoneDigits.slice(0, 14) : "";
    onForgotPassword({ phoneCountry, phone });
  };

  return (
    <main className="auth-screen login-screen scroll-screen">
      <div className="auth-topbar">
        <button type="button" className="auth-back-button" onClick={onBack} aria-label={t("back")}>
          <ArrowLeft size={30} />
        </button>
        <LanguageButton value={language} onClick={toggleLanguage} />
      </div>
      <section className="auth-intro login">
        <h1>{t("loginTitle")}</h1>
      </section>
      <label className="field-label">{t("emailOrPhone")}</label>
      <div className={`phone-field identity-field ${errors.identifier ? "has-error" : ""}`}>
        <button
          type="button"
          className="country-code-button"
          onClick={() => setCountryPickerOpen(true)}
        >
          <ChevronDown size={18} />
          <Flag country={phoneCountry} />
          <span>{phoneCountry.code}</span>
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t("emailOrPhonePlaceholder")}
          value={identifier}
          onChange={(event) => setIdentifierValue(event.target.value)}
        />
      </div>
      {errors.identifier && <p className="error-text">* {t(errors.identifier)}</p>}
      <PasswordInput
        label={t("password")}
        value={password}
        error={errors.password ? t(errors.password) : ""}
        visible={visible}
        onToggle={() => setVisible((value) => !value)}
        onChange={setPasswordValue}
        t={t}
      />
      <button type="button" className="forgot-password-link" onClick={openReset}>
        {t("forgotPassword")}
      </button>
      <button className="primary-button" onClick={submit}>
        {t("continue")}
      </button>
      <button className="text-link wide" onClick={() => setScreen("register")}>
        {t("dontHaveAccount")} <span>{t("createNew")}</span>
      </button>
      {countryPickerOpen && (
        <CountryModal
          title={t("selectCallingCode")}
          language={language}
          t={t}
          withCodes
          selectedCountry={phoneCountry.name}
          onPick={(country) => {
            setPhoneCountry(country);
            setCountryPickerOpen(false);
            setErrors((current) => ({ ...current, identifier: "" }));
          }}
          onClose={() => setCountryPickerOpen(false)}
        />
      )}
    </main>
  );
}

function SuccessScreen({ state, language, t, toggleLanguage, setScreen, goBack }) {
  return (
    <main className="success-screen">
      <div className="auth-topbar">
        <button type="button" className="auth-back-button" onClick={goBack} aria-label={t("back")}>
          <ArrowLeft size={30} />
        </button>
        <LanguageButton value={language || state.language} onClick={toggleLanguage} />
      </div>
      <h1>{t("success")}</h1>
      <div className="success-mark">
        <div>
          <Check size={112} strokeWidth={4} />
        </div>
      </div>
      <h2>{t("congrats")}</h2>
      <p>{t("successBody")}</p>
      <button className="primary-button" onClick={() => setScreen("home", { reset: true })}>
        {t("letsStart")}
      </button>
    </main>
  );
}

function HomeScreen({ state, language, t, updateState, setModal, setScreen, activeUser, canUseAccount, bootLoading }) {
  const selectedCountry = findCountry(state.currentCountry || activeUser?.country || initialState.currentCountry);
  const filteredPeople = useMemo(() => {
    const people = visiblePeopleForState(state);
    if (state.homeFilter === "Follow") {
      return people.filter((person) => state.following.includes(person.id));
    }
    if (state.homeFilter !== "Sponsor") {
      return people.filter((person) => person.country === state.homeFilter);
    }
    return people;
  }, [state]);

  const tabs = [
    { id: "Sponsor", label: t("sponsorTab") },
    { id: "Follow", label: t("followersTab") },
    { id: selectedCountry.name, label: countryLabel(selectedCountry, language) }
  ];

  const setTab = (tab) => {
    if (tab === "Follow" && !canUseAccount) {
      setModal({ type: "accountPrompt" });
      return;
    }
    updateState({ homeFilter: tab });
  };

  return (
    <main className="main-screen home-screen">
      <Header
        title={t("shrine")}
        compact
        flagCountry={selectedCountry}
        language={language}
        t={t}
        onFlag={() =>
          setModal({
            type: "country",
            title: t("browseCountry"),
            selectedCountry: selectedCountry.name,
            onPick: (country) => updateState({ currentCountry: country.name, homeFilter: country.name })
          })
        }
      />
      <section className="segmented">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={state.homeFilter === tab.id ? "active" : ""}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </section>
      {bootLoading ? (
        <section className="home-boot-loader" aria-label="Loading memorials">
          <span />
        </section>
      ) : (
        <section className="people-grid">
          {filteredPeople.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              followed={state.following.includes(person.id)}
              onOpen={() => {
                updateState({ selectedPersonId: person.id });
                setScreen("detail");
              }}
            />
          ))}
        </section>
      )}
      {!bootLoading && !filteredPeople.length && (
        <EmptyState
          icon={<Home size={56} />}
          title={t("noMemorials")}
          body={t("noMemorialsBody")}
        />
      )}
    </main>
  );
}

function PersonCard({ person, onOpen }) {
  return (
    <button className="person-card" onClick={onOpen}>
      <div className="person-image">
        {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
      </div>
      <span className="person-name-lines">
        <strong>{person.fullName}</strong>
      </span>
    </button>
  );
}

function AddScreen({ state, language, t, setModal, onSubmit, activeUser, goBack, initialPerson, mode = "create" }) {
  const isUpdate = mode === "update";
  const [form, setForm] = useState(() => ({
    photo: initialPerson?.photo || "",
    fullName: initialPerson?.fullName || "",
    surnameCheck: initialPerson?.surnameCheck || "",
    deathDate: initialPerson?.deathDate || "",
    birthDate: initialPerson?.birthDate || "",
    age: initialPerson?.age || "",
    gender: initialPerson?.gender || "",
    country: initialPerson?.country || activeUser?.country || state.currentCountry || initialState.currentCountry,
    info: initialPerson?.info || ""
  }));
  const [errors, setErrors] = useState({});
  const [imageLoading, setImageLoading] = useState(false);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const ageErrorForForm = (nextForm) => {
    const expectedAge = ageFromBirthAndDeathYears(nextForm.birthDate, nextForm.deathDate);
    return nextForm.age && expectedAge && nextForm.age !== expectedAge
      ? formatText(t("errAgeMismatch"), { age: expectedAge })
      : "";
  };
  const setFieldAndValidateAge = (field, value) => {
    const nextForm = { ...form, [field]: value };
    setField(field, value);
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      const ageError = ageErrorForForm(nextForm);
      if (ageError) {
        nextErrors.age = ageError;
      } else {
        delete nextErrors.age;
      }
      return nextErrors;
    });
  };

  const pickImage = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setImageLoading(true);
    try {
      const photo = await compressImageFile(file);
      setField("photo", photo);
    } finally {
      setImageLoading(false);
      input.value = "";
    }
  };

  const submit = () => {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = t("errFullName");
    if (!form.surnameCheck.trim()) nextErrors.surnameCheck = t("errSurname");
    if (!form.deathDate) nextErrors.deathDate = t("errDeathDate");
    const ageError = ageErrorForForm(form);
    if (ageError) nextErrors.age = ageError;
    if (!form.gender) nextErrors.gender = t("errGender");
    if (!form.country) nextErrors.country = t("errCountry");
    if (form.info.trim().split(/\s+/).filter(Boolean).length > 250) {
      nextErrors.info = t("errInfo");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit(form);
  };

  const infoWords = form.info.trim().split(/\s+/).filter(Boolean).length;

  if (isUpdate && !initialPerson) {
    return (
      <main className="main-screen add-screen scroll-screen">
        <Header title={t("update")} compact back={goBack} language={language} t={t} />
        <EmptyState title={t("entryNotFound")} />
      </main>
    );
  }

  return (
    <main className="main-screen add-screen scroll-screen">
      <Header title={isUpdate ? t("update") : t("add")} compact back={goBack} language={language} t={t} />
      <section className="add-form">
        <label className="photo-picker">
          {form.photo ? <img src={form.photo} alt={t("selected")} /> : <AvatarSilhouette />}
          <span>
            <ImageUp size={24} />
          </span>
          <input type="file" accept="image/*" onChange={pickImage} />
        </label>
        <Input
          label={t("fullName")}
          required
          requiredLabel={t("required")}
          placeholder={t("fullName")}
          value={form.fullName}
          error={errors.fullName}
          onChange={(value) => setField("fullName", value)}
        />
        <Input
          label={t("verifySurname")}
          required
          requiredLabel={t("required")}
          placeholder={t("verifySurname")}
          value={form.surnameCheck}
          error={errors.surnameCheck}
          onChange={(value) => setField("surnameCheck", value)}
        />
        <DateField
          label={t("dateOfDeath")}
          required
          requiredLabel={t("required")}
          value={form.deathDate}
          error={errors.deathDate}
          onChange={(value) => setFieldAndValidateAge("deathDate", value)}
        />
        <DateField
          label={t("dateOfBirth")}
          value={form.birthDate}
          onChange={(value) => setFieldAndValidateAge("birthDate", value)}
        />
        <div className="two-grid">
          <SelectField
            label={t("age")}
            placeholder={t("age")}
            value={form.age}
            error={errors.age}
            onClick={() =>
              setModal({
                type: "age",
                value: form.age,
                onPick: (age) => setFieldAndValidateAge("age", age)
              })
            }
          />
          <SelectField
            label={t("gender")}
            required
            requiredLabel={t("required")}
            placeholder={t("gender")}
            value={genderLabel(form.gender, t)}
            error={errors.gender}
            onClick={() =>
              setModal({
                type: "gender",
                onPick: (gender) => setField("gender", gender)
              })
            }
          />
        </div>
        <SelectField
          label={t("country")}
          required
          requiredLabel={t("required")}
          value={countryLabel(form.country, language)}
          error={errors.country}
          onClick={() =>
            setModal({
              type: "country",
              title: t("country"),
              selectedCountry: form.country,
              onPick: (country) => setField("country", country.name)
            })
          }
        />
        <label className="field-label">{t("information")}</label>
        <textarea
          className={`text-area ${errors.info ? "has-error" : ""}`}
          placeholder={t("information")}
          value={form.info}
          onChange={(event) => setField("info", event.target.value)}
        />
        <div className="counter left">{infoWords}/250 {t("words")}</div>
        {errors.info && <p className="error-text">* {errors.info}</p>}
        <button className="primary-button" onClick={submit} disabled={imageLoading}>
          {imageLoading ? t("pleaseWait") : isUpdate ? t("update") : t("create")}
        </button>
      </section>
    </main>
  );
}

function SearchScreen({ state, language, t, updateState, setScreen, goBack }) {
  const [query, setQuery] = useState("");
  const results = visiblePeopleForState(state).filter((person) => {
    const value = `${person.fatherName || ""} ${person.fullName} ${person.country} ${person.info}`.toLowerCase();
    return query.trim() && value.includes(query.toLowerCase());
  });

  return (
    <main className="main-screen search-screen">
      <Header title={t("search")} compact back={goBack} language={language} t={t} />
      <section className="search-box">
        <Search size={30} />
        <input
          autoComplete="off"
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </section>
      {query && !results.length && <EmptyState title={t("noResults")} body={t("noResultsBody")} />}
      <section className="people-grid search-results">
        {results.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            onOpen={() => {
              updateState({ selectedPersonId: person.id });
              setScreen("detail");
            }}
          />
        ))}
      </section>
    </main>
  );
}

function SettingsScreen({ state, language, t, updateState, setScreen, goBack, logout, activeUser }) {
  const [languageOpen, setLanguageOpen] = useState(false);
  const currentLanguage = normalizeLanguage(language || state.language);
  const arabicLanguageFlag = countries.find((country) => country.iso === "kw");
  const englishLanguageFlag = countries.find((country) => country.iso === "gb");
  const currentLanguageFlag = currentLanguage === "AR" ? arabicLanguageFlag : englishLanguageFlag;

  return (
    <main className="main-screen settings-screen scroll-screen">
      <button type="button" className="header-icon settings-back-button" onClick={goBack} aria-label={t("back")}>
        <ArrowLeft size={32} />
      </button>
      <h1 className="plain-title">{t("settings")}</h1>
      <div className="settings-list">
        <SettingsItem icon={<UserRound />} label={t("profile")} onClick={() => setScreen("profile")} />
        <div className={`settings-card language-card ${languageOpen ? "open" : ""}`}>
          <button className="settings-row" onClick={() => setLanguageOpen((value) => !value)}>
            <span className="setting-icon">
              <Flag country={currentLanguageFlag} />
            </span>
            <span>{t("language")}</span>
            {languageOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </button>
          {languageOpen && (
            <div className="language-options">
              <button aria-pressed={currentLanguage === "AR"} onClick={() => updateState({ language: "AR" })}>
                <Flag country={arabicLanguageFlag} />
                <span>{t("arabic")}</span>
              </button>
              <button aria-pressed={currentLanguage === "EN"} onClick={() => updateState({ language: "EN" })}>
                <Flag country={englishLanguageFlag} />
                <span>{t("english")}</span>
              </button>
            </div>
          )}
        </div>
        <SettingsItem icon={<Ban />} label={t("blockedUsers")} onClick={() => setScreen("blocked")} />
        <SettingsItem icon={<ShieldCheck />} label={t("adminDashboard")} onClick={() => setScreen("admin")} />
        <SettingsItem icon={<Headset />} label={t("contactUs")} onClick={() => setScreen("contact")} />
        <SettingsItem icon={<FileText />} label={t("terms")} onClick={() => setScreen("terms")} />
        {activeUser ? (
          <SettingsItem icon={<LogOut />} label={t("logout")} onClick={logout} />
        ) : (
          <SettingsItem icon={<UserRoundPlus />} label={t("createAccount")} onClick={() => setScreen("register")} />
        )}
      </div>
      <button className="primary-button settings-done" onClick={() => setScreen("home", { reset: true })}>
        {t("done")}
      </button>
    </main>
  );
}

function SettingsItem({ icon, label, onClick }) {
  return (
    <button className="settings-card settings-row" onClick={onClick}>
      <span className="setting-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ProfileScreen({ activeUser, language, t, setScreen, goBack }) {
  const user = activeUser;

  return (
    <main className="profile-screen main-screen">
      <button className="header-icon profile-back" onClick={goBack} aria-label={t("back")}>
        <ArrowLeft size={34} />
      </button>
      <button className="profile-edit" onClick={() => setScreen("editProfile")} aria-label={t("editProfile")}>
        <CircleUserRound size={30} />
        <Pencil size={20} />
      </button>
      <h1>{t("myAccount")}</h1>
      <section className="profile-identity" aria-label={getUserName(user)}>
        <div className="profile-avatar">
          <ProfileAvatar user={user} />
        </div>
        <h2>{getUserName(user)}</h2>
      </section>
      <section className="info-panel">
        <h3>{t("myInformation")}</h3>
        <InfoLine icon={<Mail />} label={t("emailAddress")} value={user?.email || t("guestAccount")} />
        <InfoLine icon={<Navigation />} label={t("country")} value={user?.country ? countryLabel(user.country, language) : t("notSelected")} />
      </section>
    </main>
  );
}

function ProfileAvatar({ user }) {
  const uploadedSrc = userAvatarSource(user);
  const [uploadedImageFailed, setUploadedImageFailed] = useState(false);

  useEffect(() => {
    setUploadedImageFailed(false);
  }, [uploadedSrc]);

  if (uploadedSrc && !uploadedImageFailed) {
    return (
      <img
        className="profile-avatar-image profile-avatar-user-image"
        src={uploadedSrc}
        alt={getUserName(user)}
        onError={() => setUploadedImageFailed(true)}
      />
    );
  }

  return (
    <img
      className="profile-avatar-image profile-avatar-default-image"
      src={defaultAvatar}
      alt="Default avatar"
    />
  );
}

function EditProfileScreen({ activeUser, state, language, t, updateState, setScreen, goBack, setModal, setToast }) {
  const [form, setForm] = useState({
    photo: userAvatarSource(activeUser) || "",
    firstName: activeUser?.firstName || "",
    surname: activeUser?.surname || "",
    email: activeUser?.email || "",
    country: activeUser?.country || state.currentCountry || initialState.currentCountry
  });

  const pickProfilePhoto = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const photo = await compressImageFile(file);
      setForm((current) => ({ ...current, photo }));
    } finally {
      input.value = "";
    }
  };

  const save = () => {
    if (!activeUser) {
      setScreen("register");
      return;
    }
    const accountCountry = findCountry(form.country || state.currentCountry);
    const updated = { ...activeUser, ...form, country: accountCountry.name };
    updateState({
      currentUser: updated,
      users: state.users.map((user) => (user.id === updated.id ? updated : user)),
      currentCountry: accountCountry.name,
      homeFilter: accountCountry.name
    });
    setToast(t("profileUpdated"));
    setScreen("profile", { replace: true });
  };

  return (
    <main className="main-screen scroll-screen edit-screen">
      <Header title={t("editProfile")} back={goBack} language={language} t={t} />
      <section className="add-form">
        <label className="photo-picker profile-photo-picker">
          {form.photo ? (
            <img src={form.photo} alt={t("selected")} />
          ) : (
            <img className="profile-picker-default" src={defaultAvatar} alt="Default avatar" />
          )}
          <span>
            <ImageUp size={24} />
          </span>
          <input type="file" accept="image/*" aria-label={t("attachPhoto")} onChange={pickProfilePhoto} />
        </label>
        <Input
          label={t("firstName")}
          placeholder={t("firstName")}
          value={form.firstName}
          onChange={(value) => setForm((current) => ({ ...current, firstName: value }))}
        />
        <Input
          label={t("surname")}
          placeholder={t("surname")}
          value={form.surname}
          onChange={(value) => setForm((current) => ({ ...current, surname: value }))}
        />
        <Input
          label={t("emailAddress")}
          placeholder="email@example.com"
          value={form.email}
          onChange={(value) => setForm((current) => ({ ...current, email: value }))}
        />
        <SelectField
          label={t("country")}
          value={countryLabel(form.country, language)}
          onClick={() =>
            setModal({
              type: "country",
              title: t("country"),
              selectedCountry: form.country,
              onPick: (country) => setForm((current) => ({ ...current, country: country.name }))
            })
          }
        />
        <button className="primary-button" onClick={save}>
          {t("save")}
        </button>
      </section>
    </main>
  );
}

function UserDashboardScreen({ state, language, t, updateState, goBack, setModal, setToast }) {
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(null);

  const beginEdit = (user) => {
    setEditingId(user.id);
    setForm({
      firstName: user.firstName || "",
      surname: user.surname || "",
      email: user.email || "",
      phone: user.phone || "",
      gender: user.gender || "",
      country: normalizeCountryName(user.country || state.currentCountry, state.currentCountry),
      password: user.password || ""
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(null);
  };

  const saveUser = () => {
    const user = state.users.find((item) => item.id === editingId);
    if (!user || !form) return;

    const accountCountry = findCountry(form.country || user.country || state.currentCountry);
    const phoneDigits = String(form.phone || "").replace(/^0+/, "");
    const updatedUser = {
      ...user,
      firstName: form.firstName.trim(),
      surname: form.surname.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      gender: form.gender,
      country: accountCountry.name,
      phoneCountry: accountCountry.name,
      phoneCode: accountCountry.code,
      phoneIso: accountCountry.iso,
      otpPhone: phoneDigits ? `${accountCountry.code}${phoneDigits}` : user.otpPhone || "",
      password: form.password
    };

    updateState({
      users: state.users.map((item) => (item.id === updatedUser.id ? updatedUser : item)),
      currentUser: state.currentUser?.id === updatedUser.id ? updatedUser : state.currentUser
    });
    setToast(t("userSaved"));
    cancelEdit();
  };

  const deleteUser = (userId) => {
    if (typeof window !== "undefined" && !window.confirm(t("deleteUserConfirm"))) return;

    const isCurrentUser = state.currentUser?.id === userId;
    updateState({
      users: state.users.filter((user) => user.id !== userId),
      currentUser: isCurrentUser ? null : state.currentUser,
      guest: isCurrentUser ? true : state.guest,
      following: isCurrentUser ? [] : state.following,
      people: state.people.map((person) => ({
        ...person,
        flowers: (person.flowers || []).filter((flower) => flower.userId !== userId)
      }))
    });
    setToast(t("userDeleted"));
    if (editingId === userId) cancelEdit();
  };

  return (
    <main className="main-screen user-dashboard-screen scroll-screen">
      <Header title={t("userDashboard")} compact back={goBack} language={language} t={t} />
      <section className="dashboard-intro">
        <p>{t("dashboardIntro")}</p>
      </section>
      {!state.users.length && <EmptyState title={t("noUsers")} body={t("noUsersBody")} />}
      <section className="user-dashboard-list">
        {state.users.map((user) => {
          const isEditing = editingId === user.id && form;
          const userName = getUserName(user) || t("guestAccount");

          return (
            <article className="user-dashboard-card" key={user.id}>
              <div className="user-dashboard-card-header">
                <span className="user-dashboard-avatar">
                  <UserRound size={24} />
                </span>
                <div>
                  <strong>{userName}</strong>
                  <span>{user.email || user.phone || t("notSelected")}</span>
                </div>
              </div>

              {isEditing ? (
                <div className="user-dashboard-form">
                  <div className="two-grid">
                    <Input label={t("firstName")} value={form.firstName} onChange={(value) => setForm((current) => ({ ...current, firstName: value }))} />
                    <Input label={t("surname")} value={form.surname} onChange={(value) => setForm((current) => ({ ...current, surname: value }))} />
                  </div>
                  <Input label={t("emailAddress")} value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                  <Input label={t("mobileNumber")} value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value.replace(/\D/g, "").slice(0, 14) }))} />
                  <SelectField
                    label={t("gender")}
                    value={genderLabel(form.gender, t)}
                    placeholder={t("gender")}
                    onClick={() =>
                      setModal({
                        type: "gender",
                        onPick: (gender) => setForm((current) => ({ ...current, gender }))
                      })
                    }
                  />
                  <SelectField
                    label={t("country")}
                    value={countryLabel(form.country, language)}
                    onClick={() =>
                      setModal({
                        type: "country",
                        title: t("country"),
                        selectedCountry: form.country,
                        onPick: (country) => setForm((current) => ({ ...current, country: country.name }))
                      })
                    }
                  />
                  <Input label={t("password")} value={form.password} type="text" onChange={(value) => setForm((current) => ({ ...current, password: value }))} />
                  <div className="user-dashboard-actions">
                    <button className="primary-button small" type="button" onClick={saveUser}>
                      {t("save")}
                    </button>
                    <button className="outline-button small" type="button" onClick={cancelEdit}>
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="user-dashboard-meta">
                    <span>{countryLabel(user.country, language) || t("notSelected")}</span>
                    <span>{genderLabel(user.gender, t) || t("notSelected")}</span>
                    <span>{user.phoneCode || ""} {user.phone || ""}</span>
                  </div>
                  <div className="user-dashboard-actions">
                    <button className="outline-button small" type="button" onClick={() => beginEdit(user)}>
                      <Pencil size={18} /> {t("editUser")}
                    </button>
                    <button className="danger-button small" type="button" onClick={() => deleteUser(user.id)}>
                      <Trash2 size={18} /> {t("deleteUser")}
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

function termsToDraft(sections) {
  return (sections || [])
    .map((section) => [section.title || "", section.body || ""].filter(Boolean).join("\n"))
    .join("\n\n");
}

function draftToTerms(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return null;
      return {
        title: lines[0] || `${index + 1}. Terms`,
        body: lines.slice(1).join(" ")
      };
    })
    .filter(Boolean);
}

function normalizeDashboard(data) {
  const dashboard = data?.dashboard && typeof data.dashboard === "object" ? data.dashboard : {};
  return {
    stats: dashboard.stats || {},
    terms: normalizeLiveData({ live: { terms: dashboard.terms } }).terms,
    users: Array.isArray(dashboard.users) ? dashboard.users : [],
    shrines: Array.isArray(dashboard.shrines) ? dashboard.shrines : [],
    comments: Array.isArray(dashboard.comments) ? dashboard.comments : [],
    contactMessages: Array.isArray(dashboard.contactMessages) ? dashboard.contactMessages : [],
    blockedPeople: Array.isArray(dashboard.blockedPeople) ? dashboard.blockedPeople : [],
    updatedAt: dashboard.updatedAt || ""
  };
}

function AdminDashboardScreen({ state, language, t, goBack, setToast }) {
  const [session, setSession] = useState(() => savedAdminSession());
  const [identifier, setIdentifier] = useState(state.currentUser?.email || state.currentUser?.otpPhone || "");
  const [accessKey, setAccessKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [activeTab, setActiveTab] = useState("users");
  const [termsDraft, setTermsDraft] = useState({ EN: "", AR: "" });
  const [loading, setLoading] = useState(false);
  const signedIn = Boolean(session?.sessionToken);

  const loadDashboard = async (activeSession = session) => {
    if (!activeSession?.sessionToken) return;
    setLoading(true);
    try {
      const { response, data } = await adminApi("/api/admin/dashboard", activeSession, { method: "GET" }, "Could not load admin dashboard.");
      if (response.status === 401) {
        saveAdminSession(null);
        setSession(null);
        setDashboard(null);
        return;
      }
      if (!response.ok || !data?.success) {
        setToast(data?.error || t("adminLiveOffline"));
        return;
      }
      const nextDashboard = normalizeDashboard(data);
      setDashboard(nextDashboard);
      setTermsDraft({
        EN: termsToDraft(nextDashboard.terms.EN.length ? nextDashboard.terms.EN : termsSections.EN),
        AR: termsToDraft(nextDashboard.terms.AR.length ? nextDashboard.terms.AR : termsSections.AR)
      });
    } catch {
      setToast(t("adminLiveOffline"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (signedIn) loadDashboard(session);
  }, [signedIn, session?.sessionToken]);

  const login = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { response, data } = await apiJson(
        "/api/admin/login",
        {
          method: "POST",
          body: JSON.stringify({ identifier, accessKey })
        },
        "Could not sign in."
      );
      if (!response.ok || !data?.success) {
        setToast(data?.error || t("badLogin"));
        return;
      }
      const nextSession = { sessionToken: data.sessionToken, identifier };
      saveAdminSession(nextSession);
      setSession(nextSession);
      setAccessKey("");
      setToast(t("adminSignedIn"));
    } catch {
      setToast(t("adminLiveOffline"));
    } finally {
      setLoading(false);
    }
  };

  const logoutAdmin = () => {
    saveAdminSession(null);
    setSession(null);
    setDashboard(null);
  };

  const runAction = async (requestFactory, successKey = "adminSaved") => {
    if (!session?.sessionToken || loading) return;
    setLoading(true);
    try {
      const { response, data } = await requestFactory();
      if (!response.ok || !data?.success) {
        setToast(data?.error || t("adminLiveOffline"));
        return;
      }
      setToast(t(successKey));
      await loadDashboard(session);
    } catch {
      setToast(t("adminLiveOffline"));
    } finally {
      setLoading(false);
    }
  };

  const saveTerms = () =>
    runAction(
      () =>
        adminApi(
          "/api/admin/terms",
          session,
          {
            method: "PATCH",
            body: JSON.stringify({
              terms: {
                EN: draftToTerms(termsDraft.EN),
                AR: draftToTerms(termsDraft.AR)
              }
            })
          },
          "Could not save terms."
        ),
      "adminSaved"
    );

  const deleteUser = (userId) =>
    runAction(
      () => adminApi(`/api/admin/users/${encodeURIComponent(userId)}`, session, { method: "DELETE" }, "Could not delete user."),
      "adminDeleted"
    );

  const deleteComment = (commentId) =>
    runAction(
      () => adminApi(`/api/admin/comments/${encodeURIComponent(commentId)}`, session, { method: "DELETE" }, "Could not delete comment."),
      "adminDeleted"
    );

  const updateContact = (messageId, status) =>
    runAction(
      () =>
        adminApi(
          `/api/admin/contact/${encodeURIComponent(messageId)}`,
          session,
          { method: "PATCH", body: JSON.stringify({ status }) },
          "Could not update message."
        ),
      "adminSaved"
    );

  const deleteContact = (messageId) =>
    runAction(
      () => adminApi(`/api/admin/contact/${encodeURIComponent(messageId)}`, session, { method: "DELETE" }, "Could not delete message."),
      "adminDeleted"
    );

  const blockPerson = (person) =>
    runAction(
      () =>
        adminApi(
          "/api/admin/blocked",
          session,
          {
            method: "POST",
            body: JSON.stringify({ personId: person.id || person.publicId, fullName: person.fullName })
          },
          "Could not block person."
        ),
      "adminBlockedPerson"
    );

  const unblockPerson = (personId) =>
    runAction(
      () => adminApi(`/api/admin/blocked/${encodeURIComponent(personId)}`, session, { method: "DELETE" }, "Could not unblock person."),
      "adminUnblockedPerson"
    );

  const tabs = [
    { id: "users", label: t("adminUsers"), count: dashboard?.users.length || 0 },
    { id: "terms", label: t("adminTerms"), count: "" },
    { id: "contact", label: t("adminContact"), count: dashboard?.contactMessages.length || 0 },
    { id: "comments", label: t("adminComments"), count: dashboard?.comments.length || 0 },
    { id: "blocked", label: t("adminBlocked"), count: dashboard?.blockedPeople.length || 0 }
  ];

  const blockedIds = new Set((dashboard?.blockedPeople || []).flatMap((person) => [person.personId, person.publicId]).filter(Boolean));
  const blockableShrines = (dashboard?.shrines || []).filter((person) => !blockedIds.has(person.id) && !blockedIds.has(person.publicId));

  if (!signedIn) {
    return (
      <main className="main-screen admin-screen scroll-screen">
        <Header title={t("adminDashboard")} compact back={goBack} language={language} t={t} />
        <form className="admin-login-panel" onSubmit={login}>
          <ShieldCheck size={44} />
          <h2>{t("adminSignIn")}</h2>
          <p>{t("adminKeyHelp")}</p>
          <Input label={t("adminIdentifier")} value={identifier} onChange={setIdentifier} />
          <PasswordInput
            label={t("adminAccessKey")}
            value={accessKey}
            visible={keyVisible}
            onToggle={() => setKeyVisible((value) => !value)}
            onChange={setAccessKey}
            t={t}
          />
          <button className="primary-button" type="submit" disabled={loading || !accessKey.trim()}>
            {loading ? t("pleaseWait") : t("adminSignIn")}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="main-screen admin-screen scroll-screen">
      <Header
        title={t("adminDashboard")}
        compact
        back={goBack}
        language={language}
        t={t}
        action={
          <button className="header-icon" type="button" onClick={() => loadDashboard(session)} aria-label={t("adminRefresh")}>
            <LayoutGrid size={27} />
          </button>
        }
      />
      <section className="admin-overview">
        <div>
          <span>{t("adminStats")}</span>
          <strong>{dashboard ? dashboard.stats.shrines || 0 : 0}</strong>
          <small>{t("memorial")}</small>
        </div>
        <div>
          <span>{t("adminUsers")}</span>
          <strong>{dashboard ? dashboard.stats.users || 0 : 0}</strong>
          <small>{t("adminUsers")}</small>
        </div>
        <div>
          <span>{t("adminComments")}</span>
          <strong>{dashboard ? dashboard.stats.comments || 0 : 0}</strong>
          <small>{t("adminComments")}</small>
        </div>
      </section>
      <div className="admin-tabs" role="tablist" aria-label={t("adminDashboard")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count !== "" && <strong>{tab.count}</strong>}
          </button>
        ))}
      </div>
      {!dashboard && <EmptyState title={loading ? t("pleaseWait") : t("adminNoData")} body={t("adminIntro")} />}

      {dashboard && activeTab === "users" && (
        <section className="admin-list">
          {!dashboard.users.length && <EmptyState title={t("adminNoData")} />}
          {dashboard.users.map((user) => (
            <article className="admin-row" key={user.id}>
              <div>
                <strong>{user.name || `${user.firstName || ""} ${user.surname || ""}`.trim() || user.email || user.phone || t("guestAccount")}</strong>
                <span>{[user.email, `${user.phoneCode || ""} ${user.phone || ""}`.trim(), user.country].filter(Boolean).join(" • ")}</span>
              </div>
              <button className="danger-button small" type="button" onClick={() => deleteUser(user.id)} disabled={loading}>
                <Trash2 size={18} /> {t("deleteUser")}
              </button>
            </article>
          ))}
        </section>
      )}

      {dashboard && activeTab === "terms" && (
        <section className="admin-editor">
          <label className="field-label">English</label>
          <textarea className="text-area" value={termsDraft.EN} onChange={(event) => setTermsDraft((current) => ({ ...current, EN: event.target.value }))} />
          <label className="field-label">العربية</label>
          <textarea className="text-area" value={termsDraft.AR} onChange={(event) => setTermsDraft((current) => ({ ...current, AR: event.target.value }))} />
          <button className="primary-button" type="button" onClick={saveTerms} disabled={loading}>
            {loading ? t("pleaseWait") : t("save")}
          </button>
        </section>
      )}

      {dashboard && activeTab === "contact" && (
        <section className="admin-list">
          {!dashboard.contactMessages.length && <EmptyState title={t("adminNoData")} />}
          {dashboard.contactMessages.map((message) => (
            <article className="admin-row expanded" key={message.id}>
              <div>
                <strong>{message.email || message.name || t("guestAccount")}</strong>
                <span>{formatStoredDate(message.createdAt)} • {message.status || "new"}</span>
                <p>{message.message}</p>
              </div>
              <div className="admin-row-actions">
                <button className="outline-button small" type="button" onClick={() => updateContact(message.id, message.status === "done" ? "new" : "done")} disabled={loading}>
                  <Check size={18} /> {message.status === "done" ? t("adminMarkNew") : t("adminMarkDone")}
                </button>
                <button className="danger-button small" type="button" onClick={() => deleteContact(message.id)} disabled={loading}>
                  <Trash2 size={18} /> {t("deleteItem")}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {dashboard && activeTab === "comments" && (
        <section className="admin-list">
          {!dashboard.comments.length && <EmptyState title={t("adminNoData")} />}
          {dashboard.comments.map((comment) => (
            <article className="admin-row expanded" key={comment.id}>
              <div>
                <strong>{comment.userName || t("guestAccount")} • {comment.shrineName || t("memorial")}</strong>
                <span>{formatStoredDate(comment.createdAt)}</span>
                <p>{comment.text || comment.attachmentName || comment.attachment}</p>
              </div>
              <button className="danger-button small" type="button" onClick={() => deleteComment(comment.id)} disabled={loading}>
                <Trash2 size={18} /> {t("deleteItem")}
              </button>
            </article>
          ))}
        </section>
      )}

      {dashboard && activeTab === "blocked" && (
        <section className="admin-list">
          {dashboard.blockedPeople.map((person) => (
            <article className="admin-row" key={person.personId || person.publicId}>
              <div>
                <strong>{person.fullName || person.personId || person.publicId}</strong>
                <span>{formatStoredDate(person.blockedAt)}</span>
              </div>
              <button className="outline-button small" type="button" onClick={() => unblockPerson(person.personId || person.publicId)} disabled={loading}>
                {t("unblock")}
              </button>
            </article>
          ))}
          <h2 className="admin-section-title">{t("adminBlockPerson")}</h2>
          {!blockableShrines.length && <EmptyState title={t("adminNoData")} />}
          {blockableShrines.map((person) => (
            <article className="admin-row" key={person.id}>
              <div>
                <strong>{person.fullName}</strong>
                <span>{[person.country, person.createdByName].filter(Boolean).join(" • ")}</span>
              </div>
              <button className="danger-button small" type="button" onClick={() => blockPerson(person)} disabled={loading}>
                <Ban size={18} /> {t("block")}
              </button>
            </article>
          ))}
        </section>
      )}

      <section className="admin-footer-actions">
        <button className="outline-button small" type="button" onClick={logoutAdmin}>
          <LogOut size={18} /> {t("adminLogout")}
        </button>
      </section>
    </main>
  );
}

function InfoLine({ icon, label, value }) {
  return (
    <div className="info-line">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function GalleryScreen({ state, t, setScreen, goBack }) {
  const [viewMode, setViewMode] = useState("list");
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const person = findVisiblePersonByShareId(state, state.selectedPersonId);

  useEffect(() => {
    if (!photoViewerOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPhotoViewerOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [photoViewerOpen]);

  useEffect(() => {
    setPhotoViewerOpen(false);
  }, [person?.id]);

  if (!person) {
    return (
      <main className="main-screen gallery-screen scroll-screen">
        <Header title={t("gallery")} back={goBack} t={t} />
        <EmptyState title={t("entryNotFound")} />
      </main>
    );
  }

  const galleryItems = personGalleryItems({ ...person, messages: visiblePersonMessages(person, state) });

  return (
    <main className="main-screen gallery-screen scroll-screen">
      <Header title={t("gallery")} back={goBack} t={t} />
      <section className="gallery-owner-row">
        <button type="button" className="gallery-owner-avatar" onClick={() => setPhotoViewerOpen(true)} aria-label="Open photo">
          {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
        </button>
        <strong>{person.fullName}</strong>
        <div className="gallery-view-toggle" aria-label={t("gallery")}>
          <button
            type="button"
            className={viewMode === "grid" ? "active" : ""}
            aria-label="Grid"
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid size={24} />
          </button>
          <button
            type="button"
            className={viewMode === "list" ? "active" : ""}
            aria-label="List"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
          >
            <LayoutList size={26} />
          </button>
        </div>
      </section>
      <section className={`gallery-content ${viewMode}`}>
        {galleryItems.map((item) => (
          <div className="gallery-item" key={item.id || item.src}>
            <img src={item.src} alt={item.alt || person.fullName} />
          </div>
        ))}
      </section>
      {photoViewerOpen && (
        <div className="photo-viewer-backdrop" role="dialog" aria-modal="true" aria-label={person.fullName} onClick={() => setPhotoViewerOpen(false)}>
          <div className="photo-viewer" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="photo-viewer-close" onClick={() => setPhotoViewerOpen(false)} aria-label={t("back")}>
              <X size={36} />
            </button>
            <div className="photo-viewer-media">
              {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function FlowerScreen({ state, language, t, setModal, goBack, flowerScreenMode }) {
  const person = findVisiblePersonByShareId(state, state.selectedPersonId);

  if (!person) {
    return (
      <main className="main-screen flowers-screen">
        <Header title={t("giveFlower")} back={goBack} language={language} t={t} />
        <EmptyState title={t("entryNotFound")} />
      </main>
    );
  }

  const flowers = activeFlowerGifts(person.flowers).sort((left, right) => Date.parse(right.givenAt) - Date.parse(left.givenAt));
  return (
    <main className="main-screen flowers-screen scroll-screen">
      <Header
        title={t("giveFlower")}
        back={goBack}
        language={language}
        t={t}
        action={
          <button
            className="header-icon flower-header-button"
            onClick={() => setModal({ type: "flower", personId: person.id })}
            aria-label={t("giveFlower")}
          >
            <Plus size={34} />
          </button>
        }
      />
      <section className="flower-person-row">
        <div className="flower-person-photo">
          {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
        </div>
        <strong>{person.fullName}</strong>
      </section>
      <section className="flower-sender-list" aria-label={t("flowerSenders")}>
        {!flowers.length && <p className="flower-empty">{t("noFlowersYet")}</p>}
        {flowers.map((flower) => (
          <article className="flower-sender-card" key={flower.id}>
            <div className="flower-sender-avatar">
              <AvatarSilhouette />
            </div>
            <div className="flower-sender-text">
              <strong>{flower.userName || t("guestAccount")}</strong>
              <span>{formatStoredDate(flower.givenAt)}</span>
            </div>
            <RoseGraphic small flowerType={flower.flowerType} />
          </article>
        ))}
      </section>
      <p className="flower-page-note">{t("flowerLasts")}</p>
    </main>
  );
}

function MessageScreen({ state, language, t, goBack, setScreen, setModal, onSendMessage, activeUser, canUseAccount }) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const person = findVisiblePersonByShareId(state, state.selectedPersonId);

  if (!person) {
    return (
      <main className="main-screen message-screen">
        <Header title={t("message")} back={goBack} language={language} t={t} />
        <EmptyState title={t("entryNotFound")} />
      </main>
    );
  }

  const messages = visiblePersonMessages(person, state);
  const canSend = canUseAccount && Boolean(draft.trim() || attachment?.src);
  const draftPreview = draft.trim();
  const hasDraftPreview = Boolean(draftPreview || attachment?.src);

  const pickAttachment = (event) => {
    if (!canUseAccount) {
      setModal({ type: "accountPrompt", intent: "message" });
      return;
    }

    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        src: reader.result,
        name: file.name || t("attachPhoto")
      });
    };
    reader.readAsDataURL(file);
  };

  const send = () => {
    if (!canUseAccount) {
      setModal({ type: "accountPrompt", intent: "message" });
      return;
    }
    if (!canSend) return;
    const sent = onSendMessage(person.id, {
      text: draft,
      attachment: attachment?.src || "",
      attachmentName: attachment?.name || ""
    });
    if (!sent) return;

    setDraft("");
    setAttachment(null);
    setScreen("detail", { replace: true });
  };

  return (
    <main className="main-screen message-screen">
      <Header title={t("message")} back={goBack} language={language} t={t} />
      <section className="message-person-row">
        <div className="message-person-photo">
          {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
        </div>
        <strong>{person.fullName}</strong>
      </section>
      <section className="message-thread" aria-live="polite">
        {!messages.length && !hasDraftPreview && <p className="message-empty">{t("noMessages")}</p>}
        {messages.map((message) => {
          const mine = message.userId !== "guest" && message.userId === activeUser?.id;
          const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          return (
            <article className={`message-bubble ${mine ? "mine" : ""}`} key={message.id}>
              <div className="message-bubble-meta">
                <strong>{message.userName || t("guestAccount")}</strong>
                <span>{time}</span>
              </div>
              {message.attachment && <img className="message-bubble-image" src={message.attachment} alt={message.attachmentName || t("message")} />}
              {message.text && <p dir="auto">{message.text}</p>}
            </article>
          );
        })}
        {hasDraftPreview && (
          <article className="message-draft-preview">
            {attachment?.src && <img className="message-draft-image" src={attachment.src} alt={attachment.name || t("attachPhoto")} />}
            {draftPreview && <p dir="auto">{draftPreview}</p>}
          </article>
        )}
      </section>
      {canUseAccount ? (
        <form
          className="message-composer"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          {attachment && (
            <div className="message-attachment-preview">
              <img src={attachment.src} alt={attachment.name} />
              <span>{attachment.name}</span>
              <button type="button" onClick={() => setAttachment(null)} aria-label={t("removeAttachment")}>
                <X size={18} />
              </button>
            </div>
          )}
          <div className="message-composer-row">
            <label className="message-attach-button" aria-label={t("attachPhoto")}>
              <Paperclip size={31} />
              <input type="file" accept="image/*" onChange={pickAttachment} />
            </label>
            <textarea
              className="message-input"
              dir="auto"
              rows={1}
              placeholder={t("writeMessage")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="message-send-button" type="submit" disabled={!canSend} aria-label={t("send")}>
              <ArrowUp size={27} />
            </button>
          </div>
        </form>
      ) : (
        <div className="message-account-gate">
          <button className="primary-button" type="button" onClick={() => setModal({ type: "accountPrompt", intent: "message" })}>
            <UserRoundPlus size={20} /> {t("createAccount")}
          </button>
        </div>
      )}
    </main>
  );
}

function DetailScreen({
  state,
  language,
  t,
  updateState,
  setScreen,
  goBack,
  setModal,
  sharedTarget,
  onSharedTargetHandled,
  setFlowerScreenMode,
  canUseAccount
}) {
  const [entryMenuOpen, setEntryMenuOpen] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState("");
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const entryRef = useRef(null);
  const messageRefs = useRef(new Map());
  const person = findVisiblePersonByShareId(state, state.selectedPersonId);
  const sharedCommentPersonId = sharedTarget?.type === "comment" ? sharedTarget.personId : "";
  const sharedCommentId = sharedTarget?.type === "comment" ? sharedTarget.commentId || "" : "";

  useEffect(() => {
    if (!person || !personMatchesShareId(person, sharedCommentPersonId)) return undefined;

    const scrollTimer = setTimeout(() => {
      const target = sharedCommentId && sharedCommentId !== "info" ? messageRefs.current.get(sharedCommentId) : entryRef.current;
      if (sharedCommentId && sharedCommentId !== "info" && !target) return;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      onSharedTargetHandled?.();
    }, 350);

    return () => clearTimeout(scrollTimer);
  }, [person, sharedCommentId, sharedCommentPersonId, onSharedTargetHandled]);

  useEffect(() => {
    if (!photoViewerOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPhotoViewerOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [photoViewerOpen]);

  useEffect(() => {
    setPhotoViewerOpen(false);
  }, [person?.id]);

  if (!person) {
    return (
      <main className="main-screen">
        <Header title={t("memorial")} back={goBack} language={language} t={t} />
        <EmptyState title={t("entryNotFound")} />
      </main>
    );
  }

  const creator = state.users.find((user) => user.id === person.createdBy);
  const creatorName =
    person.createdByName ||
    (creator ? getUserName(creator) : !person.createdBy || person.createdBy === "guest" ? t("guestAccount") : "Shrine");
  const creatorPhoto = userAvatarSource(creator);
  const createdDate = personCreatedDate(person);
  const detailInfo = person.info?.trim();
  const lifeYears = personLifeYears(person, t);
  const displayAge = personDisplayAge(person);
  const activeFlowers = activeFlowerGifts(person.flowers);
  const latestFlower = activeFlowers
    .slice()
    .sort((left, right) => Date.parse(right.givenAt) - Date.parse(left.givenAt))[0];
  const shrineMessages = visiblePersonMessages(person, state);
  const canOpenFlowerSenders = canViewFlowerSenders(person, state.currentUser);
  const isFollowing = state.following.includes(person.id);
  const ageText = displayAge ? `${displayAge} ${normalizeLanguage(language) === "AR" ? "سنه" : "Years"}` : "";

  const shareShrine = () => {
    shareContent({
      title: person.fullName,
      text: shrinePreviewDescription(person),
      url: buildShareUrl(person)
    });
  };

  const toggleFollow = () => {
    if (!canUseAccount) {
      setModal({ type: "accountPrompt", intent: "follow" });
      return;
    }

    updateState({
      following: isFollowing
        ? state.following.filter((personId) => personId !== person.id)
        : [...state.following, person.id]
    });
  };

  const shareMessage = (message) => {
    const messageText = String(message?.text || "").trim();
    const commenterName = message?.userName || creatorName || t("guestAccount");
    shareContent({
      title: `${person.fullName} - ${commenterName}`,
      text: previewText(messageText || detailInfo || person.fullName),
      url: buildShareUrl(person)
    });
  };

  const setMessageRef = (messageId) => (node) => {
    if (node) {
      messageRefs.current.set(messageId, node);
      return;
    }
    messageRefs.current.delete(messageId);
  };

  return (
    <main className="main-screen detail-screen scroll-screen">
      <Header
        title=""
        back={goBack}
        backIcon={<ChevronRight size={44} />}
        language={language}
        t={t}
        action={
          <div className="header-action-cluster">
            <button className="header-icon detail-share-button" onClick={shareShrine} aria-label="Share">
              <Share2 size={30} />
            </button>
          </div>
        }
      />
      <section className="detail-card">
        <div className="detail-hero">
          <div className="detail-summary">
            <h2>{person.fullName}</h2>
            <p className="detail-dates">{lifeYears}</p>
            {ageText && <p className="detail-age">{ageText}</p>}
          </div>
          <button type="button" className="detail-photo" onClick={() => setPhotoViewerOpen(true)} aria-label="Open photo">
            {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
          </button>
        </div>
        <div className="detail-tools" aria-label={t("memorial")}>
          <button
            className={`detail-tool-button detail-follow-button${isFollowing ? " is-following" : ""}`}
            onClick={toggleFollow}
            aria-label={t("follow")}
            aria-pressed={isFollowing}
          >
            <UserRoundPlus size={31} />
          </button>
          <button className="detail-tool-button" onClick={() => setModal({ type: "aiSoon" })} aria-label="AI">
            <AiMark />
          </button>
          <button
            className="detail-tool-button detail-flower-button"
            onClick={() => {
              if (canOpenFlowerSenders) {
                setFlowerScreenMode?.("senders");
                setScreen("flowers");
                return;
              }
              setFlowerScreenMode?.("give");
              setModal({ type: "flower", personId: person.id });
            }}
            aria-label={t("giveFlower")}
          >
            <span>{activeFlowers.length}</span>
            <RoseGraphic small flowerType={latestFlower?.flowerType} />
          </button>
          <button className="detail-tool-button" onClick={() => setScreen("gallery")} aria-label={t("gallery")}>
            <ImageIcon size={30} />
          </button>
        </div>
        <article id="comment" ref={entryRef} className={`detail-entry ${detailInfo ? "" : "compact"}`}>
          <div className="detail-entry-header">
            <div className="detail-entry-avatar">
              {creatorPhoto ? <img src={creatorPhoto} alt={creatorName} /> : <AvatarSilhouette />}
            </div>
            <div className="detail-entry-author">
              <strong>{creatorName}</strong>
              {createdDate && <span>{createdDate}</span>}
            </div>
            <div className="detail-entry-actions">
              <button
                className="detail-entry-menu-button"
                onClick={() => {
                  setOpenMessageMenuId("");
                  setEntryMenuOpen((open) => !open);
                }}
                aria-label="More"
                aria-expanded={entryMenuOpen}
              >
                <MoreVertical size={27} />
              </button>
              {entryMenuOpen && (
                <div className="detail-entry-menu">
                  <button
                    onClick={() => {
                      shareMessage();
                      setEntryMenuOpen(false);
                    }}
                  >
                    <Share2 size={29} /> Share
                  </button>
                </div>
              )}
            </div>
          </div>
          {detailInfo && <p className="detail-info" dir="auto">{detailInfo}</p>}
        </article>
        {shrineMessages.length > 0 && (
          <section className="detail-message-list" aria-label={t("message")}>
            {shrineMessages.map((message) => (
              <article id={`comment-${message.id}`} ref={setMessageRef(message.id)} className="detail-message-card" key={message.id}>
                <div className="detail-message-header">
                  <div className="detail-message-avatar">
                    {message.userPhoto ? <img src={message.userPhoto} alt={message.userName || t("guestAccount")} /> : <AvatarSilhouette />}
                  </div>
                  <div className="detail-message-author">
                    <strong>{message.userName || t("guestAccount")}</strong>
                    <span>{formatStoredDate(message.createdAt)}</span>
                  </div>
                  <div className="detail-message-actions">
                    <button
                      className="detail-message-menu-button"
                      type="button"
                      aria-label="More"
                      aria-expanded={openMessageMenuId === message.id}
                      onClick={() => {
                        setEntryMenuOpen(false);
                        setOpenMessageMenuId((openId) => (openId === message.id ? "" : message.id));
                      }}
                    >
                      <MoreVertical size={27} />
                    </button>
                    {openMessageMenuId === message.id && (
                      <div className="detail-entry-menu detail-message-menu">
                        <button
                          onClick={() => {
                            shareMessage(message);
                            setOpenMessageMenuId("");
                          }}
                        >
                          <Share2 size={29} /> Share
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {message.attachment && (
                  <img className="detail-message-image" src={message.attachment} alt={message.attachmentName || t("message")} />
                )}
                {message.text && <p className="detail-message-text" dir="auto">{message.text}</p>}
              </article>
            ))}
          </section>
        )}
      </section>
      {photoViewerOpen && (
        <div className="photo-viewer-backdrop" role="dialog" aria-modal="true" aria-label={person.fullName} onClick={() => setPhotoViewerOpen(false)}>
          <div className="photo-viewer" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="photo-viewer-close" onClick={() => setPhotoViewerOpen(false)} aria-label={t("back")}>
              <X size={36} />
            </button>
            <div className="photo-viewer-media">
              {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AiMark({ large = false }) {
  return (
    <span className={`ai-mark ${large ? "large" : ""}`} aria-hidden="true">
      <span>AI</span>
      <Sparkles size={large ? 18 : 14} />
    </span>
  );
}

function BlockedUsersScreen({ state, language, t, updateState, goBack }) {
  const blockedPeople = state.people.filter((person) => state.blocked.includes(person.id));
  return (
    <main className="main-screen blocked-screen">
      <Header title={t("blockedUsers")} compact back={goBack} language={language} t={t} />
      {!blockedPeople.length && <EmptyState title={t("noBlockedUsers")} />}
      <section className="blocked-list">
        {blockedPeople.map((person) => (
          <div className="blocked-row" key={person.id}>
            <div>{person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}</div>
            <span>{person.fullName}</span>
            <button
              onClick={() => updateState({ blocked: state.blocked.filter((id) => id !== person.id) })}
            >
              {t("unblock")}
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

function TermsScreen({ state, language, t, goBack }) {
  const sections = liveTermsForLanguage(state, language);
  return (
    <main className="main-screen terms-screen scroll-screen">
      <Header title={t("terms")} compact back={goBack} language={language} t={t} />
      <section className="terms-content">
        <p className="updated">{t("lastUpdated")}: {today()}</p>
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function ContactScreen({ language, t, goBack, setToast, activeUser }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const { response, data } = await apiJson(
        "/api/contact",
        {
          method: "POST",
          body: JSON.stringify({
            email: email || activeUser?.email || "",
            name: activeUser ? getUserName(activeUser) : "",
            message
          })
        },
        "Could not save message."
      );
      if (!response.ok || !data?.success) {
        setToast(data?.error || t("adminLiveOffline"));
        return;
      }
      setEmail("");
      setMessage("");
      setToast(t("messageSaved"));
    } catch {
      setToast(t("adminLiveOffline"));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="main-screen contact-screen scroll-screen">
      <Header title={t("contactUs")} back={goBack} language={language} t={t} />
      <section className="add-form">
        <Input label={t("yourEmail")} placeholder="email@example.com" value={email} onChange={setEmail} />
        <label className="field-label">{t("message")}</label>
        <textarea
          className="text-area"
          placeholder={t("writeMessage")}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          className="primary-button"
          onClick={submit}
          disabled={sending || !message.trim()}
        >
          {sending ? t("pleaseWait") : t("send")}
        </button>
      </section>
    </main>
  );
}

function BottomNav({ active, variant = "main", canEditShrine = false, setScreen, setModal, canUseAccount, t }) {
  const isDetail = variant === "detail";
  const items = isDetail
    ? [
        { id: "settings", label: t("settings"), icon: <Settings size={42} /> },
        { id: "message", label: t("message"), icon: <MessageSquare size={38} /> },
        {
          id: canEditShrine ? "editShrine" : "profile",
          label: canEditShrine ? t("update") : t("profile"),
          icon: <UserRoundPen size={41} />
        }
      ]
    : [
        { id: "home", label: t("home"), icon: <ShrineHomeNavIcon /> },
        { id: "add", label: t("add"), icon: <Plus size={30} />, featured: true },
        { id: "search", label: t("search"), icon: <Search size={42} /> },
        { id: "settings", label: t("settings"), icon: <Settings size={42} /> }
      ];

  const go = (item) => {
    const id = item.id;
    if (item.disabled) return;
    if (id === "add" && !canUseAccount) {
      setModal({ type: "accountPrompt", intent: "add" });
      return;
    }
    if (id === "message") {
      if (!canUseAccount) {
        setModal({ type: "accountPrompt", intent: "message" });
        return;
      }
      setScreen("message");
      return;
    }
    setScreen(id);
  };

  return (
    <nav className={`bottom-nav${isDetail ? " detail-bottom-nav" : ""}`}>
      {items.map((item) => (
        <button
          key={item.id}
          className={`${active === item.id ? "nav-active" : ""}${item.matched ? " nav-matched" : ""}${item.featured ? " nav-featured" : ""}${item.disabled ? " nav-disabled" : ""}`}
          aria-label={item.label}
          aria-disabled={item.disabled || undefined}
          disabled={item.disabled}
          onClick={() => go(item)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
      <div className="home-indicator" />
    </nav>
  );
}

function ShrineHomeNavIcon() {
  return (
    <svg
      className="shrine-home-nav-icon"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 8.5H52C54.5 8.5 56.5 10.5 56.5 13V53C56.5 55.5 54.5 57.5 52 57.5H12C9.5 57.5 7.5 55.5 7.5 53V13C7.5 10.5 9.5 8.5 12 8.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <path
        d="M15 54.8C16.2 47.8 22.4 42.7 30.2 40.2L30.8 35.6C26.8 32.8 24.8 28.1 24.8 23C24.8 15.5 29.3 11.2 35.8 11.2C42 11.2 46.3 15.7 46.3 23C46.3 28.1 44.1 32.8 40.2 35.6L40.8 40.2C46 42 50.3 45.1 52.8 49.5L47.5 54.8H15Z"
        fill="currentColor"
      />
      <path
        d="M10.5 25.5L25.5 10.5"
        fill="none"
        stroke="#2494e8"
        strokeLinecap="round"
        strokeWidth="10"
      />
      <path
        d="M10.5 25.5L25.5 10.5"
        fill="none"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="5.5"
      />
    </svg>
  );
}

function Input({ label, required, requiredLabel = "Required", placeholder, value = "", type = "text", error, onChange }) {
  return (
    <label className="field-wrap">
      <span className="field-label">
        {label}
        {required && <em>{requiredLabel}</em>}
      </span>
      <input
        className={error ? "has-error" : ""}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p className="error-text">* {error}</p>}
    </label>
  );
}

function PasswordInput({ label, value = "", error, visible, onToggle, onChange, t = translator("EN") }) {
  return (
    <label className="field-wrap">
      <span className="field-label">{label}</span>
      <span className="password-field">
        <input
          className={error ? "has-error" : ""}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" onClick={onToggle} aria-label={visible ? t("hidePassword") : t("showPassword")}>
          {visible ? <EyeOff size={30} /> : <Eye size={30} />}
        </button>
      </span>
      {error && <p className="error-text">* {error}</p>}
    </label>
  );
}

function SelectField({ label, required, requiredLabel = "Required", placeholder, value, error, onClick }) {
  return (
    <label className="field-wrap">
      <span className="field-label">
        {label}
        {required && <em>{requiredLabel}</em>}
      </span>
      <button className={`select-field ${error ? "has-error" : ""}`} onClick={onClick}>
        <span className={value ? "" : "muted"}>{value || placeholder}</span>
        <ChevronDown size={24} />
      </button>
      {error && <p className="error-text">* {error}</p>}
    </label>
  );
}

function DateField({ label, required, requiredLabel = "Required", value, error, onChange }) {
  const inputRef = useRef(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;

    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // Some WebViews expose showPicker but still reject it.
      }
    }

    input.click();
  };

  const openPickerFromKeyboard = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPicker();
  };

  return (
    <div className="field-wrap">
      <span className="field-label">
        {label}
        {required && <em>{requiredLabel}</em>}
      </span>
      <span
        className={`date-field ${error ? "has-error" : ""}`}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={openPickerFromKeyboard}
      >
        <span className={value ? "" : "muted"}>{value || label}</span>
        <input
          ref={inputRef}
          aria-label={label}
          tabIndex={-1}
          type="date"
          value={value}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onChange(event.target.value)}
        />
        <Calendar size={28} aria-hidden="true" />
      </span>
      {error && <p className="error-text">* {error}</p>}
    </div>
  );
}

function AgeModal({ value, t, onSave, onCancel }) {
  const selectedRef = useRef(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center" });
  }, [value]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="age-modal" onClick={(event) => event.stopPropagation()}>
        <h2>{t("age")}</h2>
        <div className="age-options" role="listbox" aria-label={t("age")}>
          {AGE_OPTIONS.map((age) => {
            const isSelected = age === value;

            return (
              <button
                key={age}
                ref={isSelected ? selectedRef : null}
                className={isSelected ? "selected" : ""}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSave(age)}
              >
                {age}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CountryModal({ title, language, t, onPick, onClose, withCodes, selectedCountry }) {
  const [query, setQuery] = useState("");
  const selectedCountryName = findCountryExact(selectedCountry)?.name || "";
  const selectedRef = useRef(null);
  const results = countries.filter((country) =>
    `${country.name} ${country.ar} ${country.code}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!selectedRef.current || query) return;
    selectedRef.current.scrollIntoView({ block: "center" });
  }, [query, selectedCountryName]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="country-modal" onClick={(event) => event.stopPropagation()}>
        <div className="country-search">
          <input placeholder={withCodes ? t("searchCountry") : t("search")} value={query} onChange={(event) => setQuery(event.target.value)} />
          <Search size={26} />
        </div>
        <div className="modal-title">{title}</div>
        <div className="country-list">
          {results.map((country) => {
            const isSelected = country.name === selectedCountryName;
            return (
              <button
                key={`${country.name}-${country.code}`}
                ref={isSelected ? selectedRef : null}
                className={isSelected ? "selected" : ""}
                onClick={() => onPick(country)}
              >
                <Flag country={country} />
                <strong>{countryLabel(country, language)}</strong>
                {withCodes && <em>{country.code}</em>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Sheet({ children, onClose }) {
  return (
    <div className="modal-backdrop bottom" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FlowerModal({ t, onGive, onClose }) {
  const [showLimit, setShowLimit] = useState(false);
  const [flowerIndex, setFlowerIndex] = useState(
    Math.max(0, FLOWER_CHOICES.findIndex((flower) => flower.id === INITIAL_FLOWER_TYPE))
  );
  const selectedFlower = FLOWER_CHOICES[flowerIndex] || FLOWER_CHOICES[0];

  const previousFlower = () => {
    setFlowerIndex((index) => (index - 1 + FLOWER_CHOICES.length) % FLOWER_CHOICES.length);
  };

  const nextFlower = () => {
    setFlowerIndex((index) => (index + 1) % FLOWER_CHOICES.length);
  };

  const give = () => {
    if (onGive(selectedFlower.id)) return;
    setShowLimit(true);
  };

  return (
    <div className="modal-backdrop flower-backdrop" onClick={onClose}>
      <div className="flower-modal" onClick={(event) => event.stopPropagation()}>
        <button className="flower-close-button" type="button" onClick={onClose} aria-label={t("back")}>
          <X size={36} />
        </button>
        <button className="flower-nav-button left" type="button" onClick={previousFlower} aria-label="Previous flower">
          <ChevronLeft size={50} />
        </button>
        <button className="flower-nav-button right" type="button" onClick={nextFlower} aria-label="Next flower">
          <ChevronRight size={50} />
        </button>
        <button className="flower-pick-button" type="button" onClick={give} aria-label={t("giveFlower")}>
          <RoseGraphic flowerType={selectedFlower.id} />
        </button>
        {showLimit && (
          <>
            <div className="flower-limit-banner">{t("oneFlowerADay")}</div>
            <div className="flower-limit-message">{t("flowerAlreadySentToday")}</div>
          </>
        )}
        <p className="flower-note">{t("flowerLasts")}</p>
      </div>
    </div>
  );
}

function VerifyModal({
  user,
  language = "EN",
  t,
  toggleLanguage,
  initialChannel,
  autoSendInitial = false,
  requireChannelChoice = false,
  onProceed,
  onCancel,
  onBackFromCode,
  onLoginFromCode
}) {
  const channels = useMemo(() => {
    const phoneValue = [user.phoneCode, user.phone].filter(Boolean).join(" ").trim() || user.otpPhone;
    return [
      user.otpPhone
        ? {
            id: "mobile",
            label: t("mobileWhatsapp"),
            value: phoneValue,
            sendPath: "/api/otp/send",
            verifyPath: "/api/otp/verify"
          }
        : null,
      user.email
        ? {
            id: "email",
            label: t("emailCode"),
            value: user.email,
            sendPath: "/api/otp/email/send",
            verifyPath: "/api/otp/email/verify"
          }
        : null
    ].filter(Boolean);
  }, [t, user.email, user.otpPhone, user.phone, user.phoneCode]);
  const shouldRequireChannelChoice = requireChannelChoice && channels.length > 1;
  const initialChannelId = channels.some((channel) => channel.id === initialChannel)
    ? initialChannel
    : shouldRequireChannelChoice
      ? ""
    : channels[0]?.id || "mobile";
  const [channelId, setChannelId] = useState(initialChannelId);
  const [step, setStep] = useState("choose");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const codeInputRef = useRef(null);
  const autoSentRef = useRef(false);
  const selectedChannel = channels.find((channel) => channel.id === channelId) || (shouldRequireChannelChoice ? null : channels[0]);
  const codeStep = step === "code";
  const registrationCodeStep = codeStep && Boolean(onBackFromCode);
  const codeDigits = Array.from({ length: 6 }, (_item, index) => code[index] || "");
  const codeReady = code.length === 6;
  const resendWaitSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  const resendBlocked = resendWaitSeconds > 0;

  useEffect(() => {
    if (channels.some((channel) => channel.id === channelId)) return;
    setChannelId(shouldRequireChannelChoice ? "" : channels[0]?.id || "mobile");
  }, [channelId, channels, shouldRequireChannelChoice]);

  useEffect(() => {
    if (!codeStep) return;
    window.requestAnimationFrame(() => {
      codeInputRef.current?.focus();
      codeInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [codeStep]);

  useEffect(() => {
    if (!resendAvailableAt) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [resendAvailableAt]);

  useEffect(() => {
    if (resendAvailableAt && now >= resendAvailableAt) {
      setResendAvailableAt(0);
    }
  }, [now, resendAvailableAt]);

  const resetChannel = (nextChannelId) => {
    if (loading || nextChannelId === channelId) return;
    setChannelId(nextChannelId);
    setStep("choose");
    setCode("");
    setSent(false);
    setChallenge("");
    setExpiresAt("");
    setMessage("");
    setError("");
    setResendAvailableAt(0);
  };

  const startResendCooldown = (seconds = OTP_RESEND_COOLDOWN_SECONDS) => {
    const duration = positiveSeconds(seconds) || OTP_RESEND_COOLDOWN_SECONDS;
    const nextAvailableAt = Date.now() + duration * 1000;
    setNow(Date.now());
    setResendAvailableAt(nextAvailableAt);
  };

  const requestBody = () => {
    if (selectedChannel?.id === "email") {
      return {
        send: { email: user.email, codeLength: 6 },
        verify: { email: user.email, code, challenge }
      };
    }

    return {
      send: { phone: user.otpPhone, codeLength: 6 },
      verify: { phone: user.otpPhone, code }
    };
  };

  const sendCode = async () => {
    if (!selectedChannel) return;
    if (resendBlocked) {
      setError(formatText(t("rateLimited"), { time: formatWaitTime(resendWaitSeconds) }));
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const body = requestBody();
      const response = await fetch(apiUrl(selectedChannel.sendPath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.send)
      });
      const data = await readApiJson(response, t("couldNotSend"));
      if (!response.ok || data.success === false) {
        const errorMessage = otpSendErrorMessage(data, selectedChannel, t);
        const canEnterExistingCode =
          selectedChannel.id === "mobile" && (response.status === 429 || /rate limit/i.test(errorMessage));

        if (canEnterExistingCode) {
          const retryAfterSeconds = retryAfterSecondsForResponse(response, data) || OTP_RESEND_COOLDOWN_SECONDS;
          setSent(false);
          setStep("choose");
          setChallenge(data.challenge || "");
          setExpiresAt(data.expiresAt || "");
          startResendCooldown(retryAfterSeconds);
          setError(formatText(t("rateLimited"), { time: formatWaitTime(retryAfterSeconds) }));
          return;
        }

        throw new Error(errorMessage);
      }
      setSent(true);
      setStep("code");
      setCode("");
      setChallenge(data.challenge || "");
      setExpiresAt(data.expiresAt || "");
      startResendCooldown(retryAfterSecondsForResponse(response, data) || OTP_RESEND_COOLDOWN_SECONDS);
      const sentMessage = data.message || (selectedChannel.id === "email" ? t("emailCodeSent") : t("codeSent"));
      setMessage(data.debugCode ? `${sentMessage} ${t("devCode")}: ${data.debugCode}` : sentMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("couldNotSend"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoSendInitial || autoSentRef.current || !selectedChannel) return;
    autoSentRef.current = true;
    sendCode();
  }, [autoSendInitial, selectedChannel]);

  const chooseDifferentMethod = () => {
    setStep("choose");
    setCode("");
    setMessage("");
    setError("");
  };

  const goBackFromCode = () => {
    if (loading) return;
    if (shouldRequireChannelChoice) {
      chooseDifferentMethod();
      return;
    }
    if (onBackFromCode) {
      onBackFromCode();
      return;
    }
    chooseDifferentMethod();
  };

  const verifyCode = async () => {
    if (codeStep && !codeReady) {
      setError(t("enterCode"));
      return;
    }
    if (!code.trim()) {
      setError(t("enterCode"));
      return;
    }
    if (!selectedChannel) return;
    setLoading(true);
    setError("");
    try {
      const body = requestBody();
      const response = await fetch(apiUrl(selectedChannel.verifyPath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.verify)
      });
      const data = await readApiJson(response, t("couldNotVerify"));
      if (!response.ok) {
        throw new Error(data.error || t("couldNotVerify"));
      }
      if (!data.valid) {
        throw new Error(data.error || t("codeWrong"));
      }
      onProceed();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("couldNotVerify"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`modal-backdrop${registrationCodeStep ? " verification-page-backdrop" : ""}`} onClick={onCancel}>
      <div className={`verify-modal${registrationCodeStep ? " verification-page" : ""}`} onClick={(event) => event.stopPropagation()}>
        {registrationCodeStep && toggleLanguage && <LanguageButton value={language} onClick={toggleLanguage} />}
        {codeStep && (
          <button type="button" className="verify-back-button" disabled={loading} onClick={goBackFromCode} aria-label={t("back")}>
            <ArrowLeft size={30} />
          </button>
        )}
        <h2>{codeStep ? t("activationCode") : t("receiveActivationCode")}</h2>
        {!codeStep && (
          <div className="verify-options">
            {channels.map((channel) => (
              <button
                type="button"
                key={channel.id}
                className={`verify-option ${channel.id === selectedChannel?.id ? "selected" : ""}`}
                aria-pressed={channel.id === selectedChannel?.id}
                disabled={loading}
                onClick={() => resetChannel(channel.id)}
              >
                <span className="radio" />
                <div>
                  <strong>{channel.label}</strong>
                  <p>{channel.value}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {codeStep && (
          <div className="verify-code-page">
            <label className={`otp-code-field${registrationCodeStep ? " verification-otp-field" : ""}`}>
              {!registrationCodeStep && <span>{t("activationCode")}</span>}
              <input
                ref={codeInputRef}
                className={registrationCodeStep ? "otp-hidden-input" : ""}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder={t("sixDigitCode")}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") verifyCode();
                }}
              />
              {registrationCodeStep && (
                <span className="otp-boxes" aria-hidden="true">
                  {codeDigits.map((digit, index) => (
                    <span className={`otp-box ${digit ? "filled" : ""}`} key={index}>
                      {digit}
                    </span>
                  ))}
                </span>
              )}
            </label>
            <div className="verify-destination">
              <strong>{selectedChannel?.id === "email" ? t("codeSentToEmail") : t("codeSentToMobile")}</strong>
              <p>{selectedChannel?.value}</p>
            </div>
          </div>
        )}
        {message && !registrationCodeStep && <p className="verify-message">{message}</p>}
        {expiresAt && !registrationCodeStep && (
          <p className="verify-note">
            {t("expiresAt")} {new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {error && <p className="verify-error">{error}</p>}
        {registrationCodeStep && (
          <button className="ghost-link resend-link verification-resend-link" disabled={loading || resendBlocked} onClick={sendCode}>
            {resendBlocked ? formatText(t("resendCodeIn"), { time: resendWaitSeconds }) : t("resendCode")}
          </button>
        )}
        <button className="primary-button" disabled={loading || !selectedChannel || (codeStep && !codeReady)} onClick={codeStep ? verifyCode : sendCode}>
          {loading ? t("pleaseWait") : codeStep ? t("verifyProceed") : selectedChannel?.id === "mobile" ? t("sendWhatsappCode") : t("send")}
        </button>
        {codeStep && !registrationCodeStep && (
          <button className="ghost-link resend-link" disabled={loading || resendBlocked} onClick={sendCode}>
            {resendBlocked ? formatText(t("resendIn"), { time: formatWaitTime(resendWaitSeconds) }) : t("resendCode")}
          </button>
        )}
        {codeStep && !registrationCodeStep && (
          <button className="ghost-link resend-link" disabled={loading} onClick={goBackFromCode}>
            {t("back")}
          </button>
        )}
        {registrationCodeStep && onLoginFromCode && (
          <button type="button" className="verify-login-link" onClick={onLoginFromCode}>
            {t("alreadyHaveAccount")} <span>{t("login")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function AccountPrompt({ t, intent = "follow", onCreate, onLogin, onClose, onContinueBrowsing }) {
  const isAdd = intent === "add";
  const isFlower = intent === "flower";
  const isMessage = intent === "message";
  return (
    <div className="modal-backdrop bottom account-prompt-backdrop" onClick={onClose}>
      <div className="account-prompt" onClick={(event) => event.stopPropagation()}>
        <span className="drag-handle" />
        <div className="prompt-icon">
          <LockKeyhole className="prompt-main-icon" size={30} />
          <span className="prompt-icon-badge">
            <CircleUserRound size={13} />
          </span>
        </div>
        <h2>
          {isAdd
            ? t("accountPromptAddTitle")
            : isFlower
              ? t("accountPromptFlowerTitle")
              : isMessage
                ? t("accountPromptMessageTitle")
                : t("accountPromptTitle")}
        </h2>
        <p>
          {isAdd
            ? t("accountPromptAddBody")
            : isFlower
              ? t("accountPromptFlowerBody")
              : isMessage
                ? t("accountPromptMessageBody")
                : t("accountPromptBody")}
        </p>
        <button className="primary-button" onClick={onCreate}>
          <UserRoundPlus size={20} /> {t("createAccount")}
        </button>
        <button className="outline-button" onClick={onLogin}>
          <LogIn size={20} /> {t("signIn")}
        </button>
        <button className="ghost-link" onClick={onContinueBrowsing || onClose}>
          {t("continueBrowsing")}
        </button>
      </div>
    </div>
  );
}

function LogoutConfirmModal({ t, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop logout-backdrop" onClick={onCancel}>
      <div
        className="logout-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="logout-confirm-title">{t("logout")}</h2>
        <p>{t("logoutConfirmMessage")}</p>
        <div className="logout-actions">
          <button type="button" className="logout-cancel-button" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="button" className="logout-confirm-button" onClick={onConfirm}>
            {t("logout")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AiSoonModal({ onClose }) {
  return (
    <div className="modal-backdrop ai-modal-backdrop" onClick={onClose}>
      <div
        className="ai-soon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-soon-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ai-modal-icon">
          <AiMark large />
        </div>
        <h2 id="ai-soon-title">Soon</h2>
        <p>The AI feature will be launched + Other features Please Keep updating</p>
        <button className="primary-button ai-ok-button" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body }) {
  return (
    <section className="empty-state">
      {icon && <div>{icon}</div>}
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </section>
  );
}

function Flag({ country, large = false }) {
  const code = country?.iso || "xx";
  const flag = country?.flag || code.toUpperCase();
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = /^[a-z]{2}$/.test(code) ? `https://flagcdn.com/${code}.svg` : "";

  useEffect(() => {
    setImageFailed(false);
  }, [code]);

  return (
    <span
      className={`flag-visual flag-${code} ${large ? "large" : ""}`}
      aria-label={`${country?.name || "Country"} flag`}
      role="img"
    >
      {imageSrc && !imageFailed ? (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{flag}</span>
      )}
    </span>
  );
}

function RoseGraphic({ flowerType = DEFAULT_FLOWER_TYPE, small = false }) {
  const flower = flowerAssetByType(flowerType);

  return (
    <img
      className={`rose-graphic ${small ? "small" : ""}`}
      src={flower.src}
      alt={flower.label}
      draggable="false"
      loading={small ? "lazy" : "eager"}
      decoding="async"
    />
  );
}

function AvatarSilhouette() {
  return (
    <img className="avatar-image" src={defaultAvatar} alt="Default avatar" />
  );
}

createRoot(document.getElementById("root")).render(<App />);
