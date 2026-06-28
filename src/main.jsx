import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleUserRound,
  ContactRound,
  DoorOpen,
  Eye,
  EyeOff,
  FileText,
  Flower2,
  Headset,
  Home,
  Image as ImageIcon,
  ImageUp,
  LayoutGrid,
  LayoutList,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundPlus,
  X
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "shrine_mobile_state_v1";
const PRODUCTION_API_BASE_URL = "https://book-of-heaven.bodammohamed204.workers.dev";
const PRODUCTION_API_HOST = "book-of-heaven.bodammohamed204.workers.dev";
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const FLOWER_LIFETIME_DAYS = 7;
const FLOWER_LIFETIME_MS = FLOWER_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
const AGE_OPTIONS = Array.from({ length: 120 }, (_, index) => String(index + 1));

function defaultApiBaseUrl() {
  if (typeof window === "undefined") return "";
  const { hostname, port, protocol } = window.location;
  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

  if (import.meta.env.DEV && (protocol === "http:" || protocol === "https:") && localHosts.has(hostname) && port !== "5184") {
    return `http://${hostname === "localhost" ? "localhost" : "127.0.0.1"}:5184`;
  }

  if (!import.meta.env.DEV && hostname !== PRODUCTION_API_HOST) {
    return PRODUCTION_API_BASE_URL;
  }

  return "";
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl()).replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
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

const countries = [
  { name: "Egypt", ar: "مصر", code: "+20", iso: "eg" },
  { name: "United States", ar: "الولايات المتحدة", code: "+1", iso: "us" },
  { name: "Saudi Arabia", ar: "السعودية", code: "+966", iso: "sa" },
  { name: "United Arab Emirates", ar: "الإمارات", code: "+971", iso: "ae" },
  { name: "Kuwait", ar: "الكويت", code: "+965", iso: "kw" },
  { name: "Qatar", ar: "قطر", code: "+974", iso: "qa" },
  { name: "Jordan", ar: "الأردن", code: "+962", iso: "jo" },
  { name: "Morocco", ar: "المغرب", code: "+212", iso: "ma" },
  { name: "Algeria", ar: "الجزائر", code: "+213", iso: "dz" },
  { name: "Tunisia", ar: "تونس", code: "+216", iso: "tn" },
  { name: "Germany", ar: "ألمانيا", code: "+49", iso: "de" },
  { name: "France", ar: "فرنسا", code: "+33", iso: "fr" },
  { name: "United Kingdom", ar: "المملكة المتحدة", code: "+44", iso: "gb" },
  { name: "Canada", ar: "كندا", code: "+1", iso: "ca" },
  { name: "Australia", ar: "أستراليا", code: "+61", iso: "au" },
  { name: "Turkey", ar: "تركيا", code: "+90", iso: "tr" },
  { name: "Italy", ar: "إيطاليا", code: "+39", iso: "it" },
  { name: "Spain", ar: "إسبانيا", code: "+34", iso: "es" },
  { name: "Malaysia", ar: "ماليزيا", code: "+60", iso: "my" },
  { name: "Indonesia", ar: "إندونيسيا", code: "+62", iso: "id" }
];

const LEGACY_DEFAULT_COUNTRY_NAME = "United States";
const FALLBACK_COUNTRY_NAME = "Egypt";
const COUNTRY_FILTER_IDS = new Set(["Sponsor", "Follow"]);

const regionCountryNames = {
  EG: "Egypt",
  US: "United States",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  KW: "Kuwait",
  QA: "Qatar",
  JO: "Jordan",
  MA: "Morocco",
  DZ: "Algeria",
  TN: "Tunisia",
  DE: "Germany",
  FR: "France",
  GB: "United Kingdom",
  UK: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  TR: "Turkey",
  IT: "Italy",
  ES: "Spain",
  MY: "Malaysia",
  ID: "Indonesia"
};

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
  language: "AR",
  currentCountry: initialCountryName,
  homeFilter: initialCountryName,
  countryPreferenceTouched: false,
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
    errGender: "Gender is required",
    errPassword: "Password is required",
    errPasswordLength: "Use at least 8 characters",
    errPasswordMatch: "Passwords do not match",
    welcomeBack: "Welcome Back",
    loginIntro: "Sign in with an account you created on this browser.",
    back: "Back",
    newHere: "New here?",
    createAccount: "Create account",
    badLogin: "Check your email or mobile number and password",
    success: "Success",
    congrats: "Congrats!",
    successBody: "Your account is ready. Start adding memorials and manage everything from your profile.",
    letsStart: "Let's Start",
    sponsor: "Sponsor",
    follow: "Follow",
    sponsorTab: "Sponsor",
    followersTab: "Followers",
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
    memorialCreated: "Memorial created",
    errFullName: "Full name is required",
    errDeathDate: "Date of death is required",
    errCountry: "Country is required",
    errInfo: "Use 250 words or less",
    search: "Search",
    startTyping: "Start typing to search",
    noResults: "No results found",
    noResultsBody: "Try a name, country, or story word.",
    settings: "Settings",
    profile: "Profile",
    language: "Language",
    arabic: "العربية",
    english: "English",
    blockedUsers: "Blocked Users",
    contactUs: "Contact Us",
    terms: "Terms & Conditions",
    logout: "Logout",
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
    send: "Send",
    messageSaved: "Message saved locally",
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
    emailOrPhone: "Email or mobile number",
    emailOrPhonePlaceholder: "email@example.com or mobile number",
    accountPromptTitle: "Create an account to save your follows",
    accountPromptBody: "Your following list belongs to your account, so it stays separate from guest browsing.",
    accountPromptAddTitle: "Create an account to add a shrine",
    accountPromptAddBody: "Add a shrine, preserve details, and manage it safely from your own account.",
    accountPromptFlowerTitle: "Create an account to give a flower",
    accountPromptFlowerBody: "Each user can give one flower per day, so your daily flower needs to belong to your account.",
    signIn: "Sign in",
    gallery: "Gallary",
    giveFlower: "Give Flower",
    flower: "Flower",
    flowerAdded: "Flower added to the shrine",
    flowerUsedToday: "You have one flower per day",
    oneFlowerADay: "One Flower A Day",
    flowerAlreadySentToday: "You have already sent a flower to this shrine today",
    flowerLasts: "The flower lasts for seven days",
    flowerCount: "{count} flowers"
  },
  AR: {
    shrine: "مزارات",
    registerTitle: "ابدأ حسابك",
    registerIntro: "اعمل حسابك واحفظ كل مزار باسمك.",
    firstName: "الاسم الأول",
    surname: "اسم العائلة",
    mobileNumber: "رقم الهاتف",
    emailAddress: "البريد الإلكتروني",
    gender: "النوع",
    country: "الدولة",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    continue: "متابعة",
    alreadyHaveAccount: "عندك حساب بالفعل؟",
    login: "تسجيل الدخول",
    continueBrowsing: "تصفح كزائر",
    selectCallingCode: "اختر كود الدولة",
    required: "مطلوب",
    startRequired: "أكمل الحقول المطلوبة",
    errFirstName: "الاسم الأول مطلوب",
    errSurname: "اسم العائلة مطلوب",
    errPhone: "أدخل رقم هاتف صحيح",
    errEmail: "أدخل بريد إلكتروني صحيح",
    errGender: "النوع مطلوب",
    errPassword: "كلمة المرور مطلوبة",
    errPasswordLength: "استخدم 8 أحرف على الأقل",
    errPasswordMatch: "كلمتا المرور غير متطابقتين",
    welcomeBack: "أهلًا بعودتك",
    loginIntro: "سجّل الدخول بالحساب اللي عملته على الجهاز ده.",
    back: "رجوع",
    newHere: "مستخدم جديد؟",
    createAccount: "إنشاء حساب",
    badLogin: "راجع البريد الإلكتروني أو رقم الهاتف وكلمة المرور",
    success: "تم بنجاح",
    congrats: "مبروك!",
    successBody: "حسابك جاهز. ابدأ بإضافة المزارات وإدارتها من ملفك.",
    letsStart: "ابدأ",
    sponsor: "الداعمين",
    follow: "المتابعين",
    sponsorTab: "الرعاية",
    followersTab: "المتابعون",
    noMemorials: "لسه مفيش مزارات",
    noMemorialsBody: "اضغط على زر إضافة عشان تضيف أول مزار ببياناتك.",
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
    memorialCreated: "تم إنشاء المزار",
    errFullName: "الاسم الكامل مطلوب",
    errDeathDate: "تاريخ الوفاة مطلوب",
    errCountry: "الدولة مطلوبة",
    errInfo: "استخدم 250 كلمة أو أقل",
    search: "بحث",
    startTyping: "ابدأ الكتابة للبحث",
    noResults: "مفيش نتائج",
    noResultsBody: "جرّب اسم أو دولة أو كلمة من الوصف.",
    settings: "الإعدادات",
    profile: "الملف الشخصي",
    language: "اللغة",
    arabic: "العربية",
    english: "English",
    blockedUsers: "المستخدمون المحظورون",
    contactUs: "تواصل معنا",
    terms: "الشروط والأحكام",
    logout: "تسجيل الخروج",
    done: "تم",
    myAccount: "حسابي",
    editProfile: "تعديل الملف",
    myInformation: "معلوماتي",
    guestAccount: "حساب زائر",
    notSelected: "غير محدد",
    save: "حفظ",
    profileUpdated: "تم تحديث الملف",
    memorial: "المزار",
    entryNotFound: "المزار مش موجود",
    unknownBirth: "تاريخ الميلاد غير معروف",
    following: "تتم متابعته",
    block: "حظر",
    unblock: "إلغاء الحظر",
    noBlockedUsers: "مفيش مستخدمين محظورين",
    lastUpdated: "آخر تحديث",
    yourEmail: "بريدك الإلكتروني",
    message: "الرسالة",
    writeMessage: "اكتب رسالتك",
    send: "إرسال",
    messageSaved: "تم حفظ الرسالة محليًا",
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
    couldNotVerify: "تعذر التحقق من كود التفعيل.",
    codeWrong: "الكود غير صحيح أو انتهت صلاحيته.",
    registrationCancelled: "تم إلغاء التسجيل. ابدأ من جديد بالبيانات الصحيحة.",
    devCode: "كود التطوير",
    expiresAt: "ينتهي في",
    pleaseWait: "برجاء الانتظار...",
    verifyProceed: "تحقق وتابع",
    sendWhatsappCode: "إرسال كود واتساب",
    resendCode: "إعادة إرسال الكود",
    resendIn: "إعادة الإرسال بعد {time}",
    emailOrPhone: "البريد الإلكتروني أو رقم الهاتف",
    emailOrPhonePlaceholder: "email@example.com أو رقم الهاتف",
    accountPromptTitle: "اعمل حساب عشان تحفظ المتابعات",
    accountPromptBody: "قائمة المتابعين مرتبطة بحسابك، وبتفضل منفصلة عن تصفح الزائر.",
    accountPromptAddTitle: "اعمل حساب عشان تضيف مزار",
    accountPromptAddBody: "أضف مزار واحفظ التفاصيل وتحكم فيه بأمان من حسابك.",
    accountPromptFlowerTitle: "اعمل حساب عشان تهدي وردة",
    accountPromptFlowerBody: "كل مستخدم ليه وردة واحدة في اليوم، فخليها محفوظة على حسابك.",
    signIn: "تسجيل الدخول",
    gallery: "المعرض",
    giveFlower: "إهداء وردة",
    flower: "وردة",
    flowerAdded: "تمت إضافة الوردة إلى المزار",
    flowerUsedToday: "لديك وردة واحدة فقط في اليوم",
    oneFlowerADay: "وردة واحدة في اليوم",
    flowerAlreadySentToday: "لقد أرسلت وردة لهذا المزار اليوم بالفعل",
    flowerLasts: "الوردة تستمر سبعة أيام",
    flowerCount: "{count} وردة"
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

    return {
      ...merged,
      people,
      guest: merged.currentUser ? false : true,
      language: normalizeLanguage(merged.language),
      currentCountry,
      homeFilter,
      countryPreferenceTouched: Boolean(merged.countryPreferenceTouched)
    };
  } catch {
    return initialState;
  }
}

function saveState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
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
        givenAt: isoGivenAt,
        dayKey
      };
    })
    .filter(Boolean)
    .filter((flower) => activeFlowerGifts([flower]).length);
}

function normalizePersonFlowers(person) {
  return {
    ...person,
    flowers: normalizeFlowerGifts(person?.flowers)
  };
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

function personLifeYears(person, t) {
  const birthYear = yearFromDate(person?.birthDate);
  const deathYear = yearFromDate(person?.deathDate);
  return `(${birthYear || t("unknownBirth")} - ${deathYear || ""})`;
}

function personDisplayAge(person) {
  if (person?.age) return person.age;

  const birthYearText = yearFromDate(person?.birthDate);
  const deathYearText = yearFromDate(person?.deathDate);
  if (!birthYearText || !deathYearText) return "";

  const birthYear = Number(birthYearText);
  const deathYear = Number(deathYearText);
  if (Number.isFinite(birthYear) && Number.isFinite(deathYear) && deathYear >= birthYear) {
    return String(deathYear - birthYear);
  }

  return "";
}

function personCreatedDate(person) {
  if (person?.createdAt) return formatStoredDate(person.createdAt);

  const idTimestamp = Number(String(person?.id || "").split("-")[0]);
  if (Number.isFinite(idTimestamp) && idTimestamp > 0) {
    return formatStoredDate(idTimestamp);
  }

  return "";
}

function getUserName(user) {
  if (!user) return "Guest";
  return `${user.firstName || ""} ${user.surname || ""}`.trim() || user.email;
}

function findCountry(name) {
  return findCountryExact(name) || countries[0];
}

function normalizeLanguage(language) {
  return language === "AR" ? "AR" : "EN";
}

function getNextLanguage(language) {
  return normalizeLanguage(language) === "AR" ? "EN" : "AR";
}

function translator(language) {
  const lang = normalizeLanguage(language);
  return (key) => copy[lang][key] || copy.EN[key] || key;
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
  const [state, setState] = useState(loadState);
  const language = normalizeLanguage(state.language);
  const t = translator(language);
  const isArabic = language === "AR";
  const [screen, setScreen] = useState("home");
  const [opening, setOpening] = useState(true);
  const [homeIntroLoading, setHomeIntroLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [registerResetKey, setRegisterResetKey] = useState(0);

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
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

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

  const toggleLanguage = () => {
    updateState({ language: getNextLanguage(language) });
  };

  const addPerson = (person) => {
    setState((current) => ({
      ...current,
      people: [
        {
          ...person,
          id: uid(),
          createdAt: new Date().toISOString(),
          createdBy: current.currentUser?.id || "guest",
          createdByName: current.currentUser ? getUserName(current.currentUser) : "",
          flowers: []
        },
        ...current.people
      ]
    }));
    setToast(t("memorialCreated"));
    setScreen("home");
  };

  const giveFlowerToPerson = (personId) => {
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
      givenAt: new Date().toISOString(),
      dayKey
    };

    setState((current) => ({
      ...current,
      people: current.people.map((person) => {
        const flowers = activeFlowerGifts(person.flowers);
        if (person.id !== personId) return { ...person, flowers };
        return { ...person, flowers: [...flowers, flower] };
      })
    }));
    setToast(t("flowerAdded"));
    return true;
  };

  const registerUser = (user) => {
    const accountCountry = findCountry(user.country || state.currentCountry);
    const completeUser = { ...user, country: accountCountry.name, id: uid(), createdAt: new Date().toISOString() };
    setState((current) => ({
      ...current,
      currentUser: completeUser,
      users: [completeUser, ...current.users.filter((item) => item.email !== completeUser.email)],
      guest: false,
      language: user.language,
      currentCountry: accountCountry.name,
      homeFilter: accountCountry.name,
      countryPreferenceTouched: true
    }));
    setScreen("success");
  };

  const cancelRegistrationAttempt = () => {
    setModal(null);
    setRegisterResetKey((key) => key + 1);
    setScreen("register");
    setToast(t("registrationCancelled"));
  };

  const loginUser = (identifier, password) => {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const identifierDigits = identifier.replace(/\D/g, "");
    const user = state.users.find((item) => {
      const emailMatches = item.email?.toLowerCase() === normalizedIdentifier;
      const phoneDigits = `${item.phoneCode || ""}${item.phone || ""}`.replace(/\D/g, "");
      const mobileMatches = Boolean(identifierDigits && phoneDigits.endsWith(identifierDigits));
      return item.password === password && (emailMatches || mobileMatches);
    });
    if (!user) {
      setToast(t("badLogin"));
      return false;
    }
    const loginUserWithOtp = {
      ...user,
      otpPhone: user.otpPhone || `${user.phoneCode || ""}${String(user.phone || "").replace(/^0+/, "")}`
    };
    setModal({
      type: "verify",
      user: loginUserWithOtp,
      onProceed: () => {
        const accountCountry = findCountry(loginUserWithOtp.country || state.currentCountry);
        updateState({
          currentUser: loginUserWithOtp,
          guest: false,
          language: user.language || state.language,
          currentCountry: accountCountry.name,
          homeFilter: accountCountry.name
        });
        setScreen("home");
      }
    });
    return true;
  };

  const logout = () => {
    updateState({ currentUser: null, guest: true });
    setScreen("home");
  };

  const activeUser = state.currentUser;
  const canUseAccount = Boolean(activeUser);

  const commonProps = {
    state,
    language,
    t,
    updateState,
    setScreen,
    setModal,
    setToast,
    activeUser,
    canUseAccount,
    onGiveFlower: giveFlowerToPerson,
    toggleLanguage
  };

  return (
    <div className={`app-shell ${isArabic ? "rtl" : ""}`} dir={isArabic ? "rtl" : "ltr"} lang={isArabic ? "ar" : "en"}>
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
            setScreen("home");
          }}
          setModal={setModal}
          setToast={setToast}
        />
      )}
      {screen === "login" && (
        <LoginScreen
          state={state}
          language={language}
          t={t}
          toggleLanguage={toggleLanguage}
          onLogin={loginUser}
          onBack={() => setScreen("home")}
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
        />
      )}
      {screen === "home" && <HomeScreen {...commonProps} bootLoading={homeIntroLoading && !opening} />}
      {screen === "add" && <AddScreen {...commonProps} onCreate={addPerson} />}
      {screen === "search" && <SearchScreen {...commonProps} />}
      {screen === "settings" && <SettingsScreen {...commonProps} logout={logout} />}
      {screen === "profile" && <ProfileScreen {...commonProps} />}
      {screen === "editProfile" && <EditProfileScreen {...commonProps} />}
      {screen === "blocked" && <BlockedUsersScreen {...commonProps} />}
      {screen === "terms" && <TermsScreen {...commonProps} />}
      {screen === "contact" && <ContactScreen {...commonProps} />}
      {screen === "detail" && <DetailScreen {...commonProps} />}
      {screen === "gallery" && <GalleryScreen {...commonProps} />}

      {["home", "add", "search", "settings", "detail"].includes(screen) && (
        <BottomNav active={screen} setScreen={setScreen} setModal={setModal} canUseAccount={canUseAccount} t={t} />
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
          t={t}
          onCancel={() => setModal(null)}
          onBackFromCode={modal.onBackFromCode}
          onProceed={() => {
            setModal(null);
            modal.onProceed();
          }}
        />
      )}
      {modal?.type === "flower" && (
        <FlowerModal
          t={t}
          onClose={() => setModal(null)}
          onGive={() => {
            const added = giveFlowerToPerson(modal.personId);
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
        />
      )}
      {modal?.type === "aiSoon" && <AiSoonModal onClose={() => setModal(null)} />}
      {toast && <div className="toast">{toast}</div>}
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

function Header({ title, back, action, compact = false, flagCountry, onFlag, language = "EN", t = translator("EN") }) {
  return (
    <header className={`top-header ${compact ? "compact" : ""}`}>
      {back && (
        <button className="header-icon left" onClick={back} aria-label={t("back")}>
          <ArrowLeft size={32} />
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

  return (
    <button type="button" className="language-mini" onClick={onClick} aria-label={ariaLabel}>
      <span>{language}</span>
      <ChevronDown size={18} />
    </button>
  );
}

function RegisterScreen({ state, language, t, updateState, onRegister, onCancelRegistration, onLogin, onGuest, setModal, setToast }) {
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setAccountCountry = (country) => {
    setForm((current) => ({
      ...current,
      phoneCountry: country,
      country: country.name
    }));
  };

  const setLanguage = () => {
    const nextLanguage = getNextLanguage(form.language);
    setField("language", nextLanguage);
    updateState({ language: nextLanguage });
  };

  const submit = () => {
    const nextErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = t("errFirstName");
    if (!form.surname.trim()) nextErrors.surname = t("errSurname");
    if (!/^\d{7,14}$/.test(form.phone)) nextErrors.phone = t("errPhone");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = t("errEmail");
    if (!form.gender) nextErrors.gender = t("errGender");
    if (!form.password) nextErrors.password = t("errPassword");
    if (form.password.length > 0 && form.password.length < 8) {
      nextErrors.password = t("errPasswordLength");
    }
    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = t("errPasswordMatch");
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToast(t("startRequired"));
      return;
    }

    const user = {
      ...form,
      phoneCountry: form.phoneCountry.name,
      phoneCode: form.phoneCountry.code,
      phoneIso: form.phoneCountry.iso,
      otpPhone: `${form.phoneCountry.code}${form.phone.replace(/^0+/, "")}`
    };

    setModal({
      type: "verify",
      user,
      onBackFromCode: onCancelRegistration,
      onProceed: () => onRegister(user)
    });
  };

  return (
    <main className="auth-screen scroll-screen">
      <LanguageButton
        value={form.language}
        onClick={setLanguage}
      />
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

function LoginScreen({ state, language, t, toggleLanguage, onLogin, onBack, setScreen, setModal }) {
  const [phoneCountry, setPhoneCountry] = useState(findCountry(state.currentCountry || initialState.currentCountry));
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});

  const submit = () => {
    const nextErrors = {};
    if (!/^\d{7,14}$/.test(phone)) nextErrors.phone = t("errPhone");
    if (!password) nextErrors.password = t("errPassword");

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onLogin(`${phoneCountry.code}${phone}`, password);
  };

  return (
    <main className="auth-screen scroll-screen">
      <div className="auth-topbar">
        <button className="back-text" onClick={onBack}>
          <ArrowLeft size={24} /> {t("back")}
        </button>
        <LanguageButton value={language} onClick={toggleLanguage} />
      </div>
      <section className="auth-intro login">
        <h1>{t("welcomeBack")}</h1>
        <p>{t("loginIntro")}</p>
      </section>
      <label className="field-label">{t("mobileNumber")}</label>
      <div className={`phone-field ${errors.phone ? "has-error" : ""}`}>
        <button
          type="button"
          className="country-code-button"
          onClick={() =>
            setModal({
              type: "country",
              title: t("selectCallingCode"),
              withCodes: true,
              selectedCountry: phoneCountry.name,
              onPick: setPhoneCountry
            })
          }
        >
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
          onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="counter">{phone.length}/14</div>
      {errors.phone && <p className="error-text">* {errors.phone}</p>}
      <PasswordInput
        label={t("password")}
        value={password}
        error={errors.password}
        visible={visible}
        onToggle={() => setVisible((value) => !value)}
        onChange={setPassword}
        t={t}
      />
      <button className="primary-button" onClick={submit}>
        {t("login")}
      </button>
      <button className="text-link wide" onClick={() => setScreen("register")}>
        {t("newHere")} <span>{t("createAccount")}</span>
      </button>
    </main>
  );
}

function SuccessScreen({ state, language, t, toggleLanguage, setScreen }) {
  return (
    <main className="success-screen">
      <LanguageButton value={language || state.language} onClick={toggleLanguage} />
      <h1>{t("success")}</h1>
      <div className="success-mark">
        <div>
          <Check size={112} strokeWidth={4} />
        </div>
      </div>
      <h2>{t("congrats")}</h2>
      <p>{t("successBody")}</p>
      <button className="primary-button" onClick={() => setScreen("home")}>
        {t("letsStart")}
      </button>
    </main>
  );
}

function HomeScreen({ state, language, t, updateState, setModal, setScreen, activeUser, canUseAccount, bootLoading }) {
  const selectedCountry = findCountry(state.currentCountry || activeUser?.country || initialState.currentCountry);
  const filteredPeople = useMemo(() => {
    const people = state.people.filter((person) => !state.blocked.includes(person.id));
    if (state.homeFilter === "Follow") {
      return people.filter((person) => state.following.includes(person.id));
    }
    if (state.homeFilter !== "Sponsor") {
      return people.filter((person) => person.country === state.homeFilter);
    }
    return people;
  }, [state.people, state.blocked, state.following, state.homeFilter]);

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
        {person.fatherName && <em>{person.fatherName}</em>}
        <strong>{person.fullName}</strong>
      </span>
    </button>
  );
}

function AddScreen({ state, language, t, setModal, onCreate, activeUser }) {
  const [form, setForm] = useState({
    photo: "",
    fullName: "",
    surnameCheck: "",
    deathDate: "",
    birthDate: "",
    age: "",
    gender: "",
    country: activeUser?.country || state.currentCountry || initialState.currentCountry,
    info: ""
  });
  const [errors, setErrors] = useState({});

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const pickImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("photo", reader.result);
    reader.readAsDataURL(file);
  };

  const create = () => {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = t("errFullName");
    if (!form.surnameCheck.trim()) nextErrors.surnameCheck = t("errSurname");
    if (!form.deathDate) nextErrors.deathDate = t("errDeathDate");
    if (!form.gender) nextErrors.gender = t("errGender");
    if (!form.country) nextErrors.country = t("errCountry");
    if (form.info.trim().split(/\s+/).filter(Boolean).length > 250) {
      nextErrors.info = t("errInfo");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onCreate(form);
  };

  const infoWords = form.info.trim().split(/\s+/).filter(Boolean).length;

  return (
    <main className="main-screen add-screen scroll-screen">
      <Header title={t("add")} compact language={language} t={t} />
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
          onChange={(value) => setField("deathDate", value)}
        />
        <DateField
          label={t("dateOfBirth")}
          value={form.birthDate}
          onChange={(value) => setField("birthDate", value)}
        />
        <div className="two-grid">
          <SelectField
            label={t("age")}
            placeholder={t("age")}
            value={form.age}
            onClick={() =>
              setModal({
                type: "age",
                value: form.age,
                onPick: (age) => setField("age", age)
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
        <button className="primary-button" onClick={create}>
          {t("create")}
        </button>
      </section>
    </main>
  );
}

function SearchScreen({ state, language, t, updateState, setScreen }) {
  const [query, setQuery] = useState("");
  const results = state.people.filter((person) => {
    const value = `${person.fatherName || ""} ${person.fullName} ${person.country} ${person.info}`.toLowerCase();
    return query.trim() && value.includes(query.toLowerCase());
  });

  return (
    <main className="main-screen search-screen">
      <Header title={t("search")} compact language={language} t={t} />
      <section className="search-box">
        <Search size={30} />
        <input
          autoComplete="off"
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </section>
      {!query && <EmptyState title={t("startTyping")} />}
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

function SettingsScreen({ state, language, t, updateState, setScreen, logout }) {
  const [languageOpen, setLanguageOpen] = useState(false);
  const currentLanguage = normalizeLanguage(language || state.language);
  const arabicLanguageFlag = countries.find((country) => country.iso === "kw");
  const englishLanguageFlag = countries.find((country) => country.iso === "gb");
  const currentLanguageFlag = currentLanguage === "AR" ? arabicLanguageFlag : englishLanguageFlag;

  return (
    <main className="main-screen settings-screen scroll-screen">
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
        <SettingsItem icon={<Headset />} label={t("contactUs")} onClick={() => setScreen("contact")} />
        <SettingsItem icon={<FileText />} label={t("terms")} onClick={() => setScreen("terms")} />
        <SettingsItem icon={<LogOut />} label={t("logout")} onClick={logout} />
      </div>
      <button className="primary-button settings-done" onClick={() => setScreen("home")}>
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

function ProfileScreen({ activeUser, language, t, setScreen }) {
  const user = activeUser;

  return (
    <main className="profile-screen main-screen">
      <button className="header-icon profile-back" onClick={() => setScreen("settings")} aria-label={t("back")}>
        <ArrowLeft size={34} />
      </button>
      <button className="profile-edit" onClick={() => setScreen("editProfile")} aria-label={t("editProfile")}>
        <CircleUserRound size={30} />
        <Pencil size={20} />
      </button>
      <h1>{t("myAccount")}</h1>
      <div className="profile-avatar">
        <AvatarSilhouette />
      </div>
      <h2>{getUserName(user)}</h2>
      <section className="info-panel">
        <h3>{t("myInformation")}</h3>
        <InfoLine icon={<Mail />} label={t("emailAddress")} value={user?.email || t("guestAccount")} />
        <InfoLine icon={<MapPin />} label={t("country")} value={user?.country ? countryLabel(user.country, language) : t("notSelected")} />
      </section>
    </main>
  );
}

function EditProfileScreen({ activeUser, state, language, t, updateState, setScreen, setModal, setToast }) {
  const [form, setForm] = useState({
    firstName: activeUser?.firstName || "",
    surname: activeUser?.surname || "",
    email: activeUser?.email || "",
    country: activeUser?.country || state.currentCountry || initialState.currentCountry
  });

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
    setScreen("profile");
  };

  return (
    <main className="main-screen scroll-screen edit-screen">
      <Header title={t("editProfile")} back={() => setScreen("profile")} language={language} t={t} />
      <section className="add-form">
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

function GalleryScreen({ state, t, setScreen }) {
  const [viewMode, setViewMode] = useState("list");
  const person = state.people.find((item) => item.id === state.selectedPersonId);

  if (!person) {
    return (
      <main className="main-screen gallery-screen scroll-screen">
        <Header title={t("gallery")} back={() => setScreen("home")} t={t} />
        <EmptyState title={t("entryNotFound")} />
      </main>
    );
  }

  const galleryItems = Array.isArray(person.gallery) ? person.gallery : [];

  return (
    <main className="main-screen gallery-screen scroll-screen">
      <Header title={t("gallery")} back={() => setScreen("detail")} t={t} />
      <section className="gallery-owner-row">
        <div className="gallery-owner-avatar">
          {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
        </div>
        <strong>{person.fullName}</strong>
        <div className="gallery-view-toggle" aria-label={t("gallery")}>
          <button
            type="button"
            className={viewMode === "grid" ? "active" : ""}
            aria-label="Grid"
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid size={31} />
          </button>
          <button
            type="button"
            className={viewMode === "list" ? "active" : ""}
            aria-label="List"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
          >
            <LayoutList size={33} />
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
    </main>
  );
}

function DetailScreen({ state, language, t, updateState, setScreen, setModal, canUseAccount }) {
  const [commentMenuOpen, setCommentMenuOpen] = useState(false);
  const person = state.people.find((item) => item.id === state.selectedPersonId);

  useEffect(() => {
    if (!commentMenuOpen) return undefined;

    const closeMenu = (event) => {
      if (!event.target.closest?.(".detail-entry-actions")) {
        setCommentMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setCommentMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [commentMenuOpen]);

  if (!person) {
    return (
      <main className="main-screen">
        <Header title={t("memorial")} back={() => setScreen("home")} language={language} t={t} />
        <EmptyState title={t("entryNotFound")} />
      </main>
    );
  }

  const followed = state.following.includes(person.id);
  const blocked = state.blocked.includes(person.id);
  const creator = state.users.find((user) => user.id === person.createdBy);
  const creatorName = person.createdByName || (creator ? getUserName(creator) : person.createdBy === "guest" ? t("guestAccount") : "Shrine");
  const createdDate = personCreatedDate(person);
  const detailInfo = person.info?.trim();
  const activeFlowers = activeFlowerGifts(person.flowers);
  const lifeYears = personLifeYears(person, t);
  const displayAge = personDisplayAge(person);
  const shareUrl = typeof window !== "undefined" ? window.location?.href || "" : "";
  const shareTitle = person.fullName || t("memorial");
  const sharePerson = () => {
    shareContent({
      title: shareTitle,
      text: [shareTitle, lifeYears].filter(Boolean).join("\n"),
      url: shareUrl
    });
  };
  const shareComment = () => {
    shareContent({
      title: shareTitle,
      text: [shareTitle, creatorName, createdDate, detailInfo].filter(Boolean).join("\n"),
      url: shareUrl
    });
    setCommentMenuOpen(false);
  };

  const openFlowerPicker = () => {
    if (!canUseAccount) {
      setModal({ type: "accountPrompt", intent: "flower" });
      return;
    }
    setModal({ type: "flower", personId: person.id });
  };

  const toggleFollow = () => {
    if (!canUseAccount) {
      setModal({ type: "accountPrompt" });
      return;
    }
    updateState({
      following: followed
        ? state.following.filter((id) => id !== person.id)
        : [person.id, ...state.following]
    });
  };

  const toggleBlock = () => {
    updateState({
      blocked: blocked ? state.blocked.filter((id) => id !== person.id) : [person.id, ...state.blocked]
    });
  };

  return (
    <main className="main-screen detail-screen scroll-screen">
      <Header
        title=""
        back={() => setScreen("home")}
        language={language}
        t={t}
        action={
          <button className="header-icon flower-header-button" onClick={openFlowerPicker} aria-label={t("giveFlower")}>
            <Plus size={33} />
          </button>
        }
      />
      <section className="detail-card">
        <div className="detail-hero">
          <div className="detail-photo">
            {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
          </div>
          <div className="detail-summary">
            {person.fatherName && <p className="detail-father-name">{person.fatherName}</p>}
            <h2>{person.fullName}</h2>
            <p className="detail-dates">{lifeYears}</p>
            {displayAge && <p className="detail-age">{displayAge} Year</p>}
          </div>
        </div>
        <div className="detail-quick-actions">
          <button className="detail-action-tile" type="button" aria-label={t("gallery")} onClick={() => setScreen("gallery")}>
            <ImageIcon size={30} />
          </button>
          <button
            className={`detail-action-tile rose-tile ${activeFlowers.length ? "selected" : ""}`}
            type="button"
            aria-label={t("giveFlower")}
            aria-pressed={Boolean(activeFlowers.length)}
            onClick={openFlowerPicker}
          >
            <Flower2 size={30} />
            <span>{activeFlowers.length}</span>
          </button>
          <button className="detail-action-tile ai-tile" type="button" aria-label="AI" onClick={() => setModal({ type: "aiSoon" })}>
            <AiMark />
          </button>
        </div>
        <button className="detail-block-action" type="button" onClick={toggleBlock}>
          <Ban size={18} /> {blocked ? t("unblock") : t("block")}
        </button>
        {activeFlowers.length > 0 && (
          <div className="flower-offerings" aria-label={formatText(t("flowerCount"), { count: activeFlowers.length })}>
            {activeFlowers.slice(-6).map((flower) => (
              <span className="flower-offering" key={flower.id} title={flower.userName || t("flower")}>
                <RoseGraphic small />
              </span>
            ))}
            {activeFlowers.length > 6 && <span className="flower-count-badge">+{activeFlowers.length - 6}</span>}
          </div>
        )}
        {detailInfo && (
          <article className="detail-entry">
            <div className="detail-entry-header">
              <div className="detail-entry-avatar">
                <AvatarSilhouette />
              </div>
              <div>
                <strong>{creatorName}</strong>
                {createdDate && <span>{createdDate}</span>}
              </div>
              <div className="detail-entry-actions">
                <button
                  className="detail-entry-menu-button"
                  type="button"
                  aria-label="Share"
                  aria-haspopup="menu"
                  aria-expanded={commentMenuOpen}
                  onClick={() => setCommentMenuOpen((open) => !open)}
                >
                  <MoreVertical size={27} />
                </button>
                {commentMenuOpen && (
                  <div className="detail-entry-menu" role="menu">
                    <button type="button" role="menuitem" onClick={shareComment}>
                      <Share2 size={25} />
                      <span>Share</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="detail-info">{detailInfo}</p>
          </article>
        )}
      </section>
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

function BlockedUsersScreen({ state, language, t, updateState, setScreen }) {
  const blockedPeople = state.people.filter((person) => state.blocked.includes(person.id));
  return (
    <main className="main-screen blocked-screen">
      <Header title={t("blockedUsers")} compact back={() => setScreen("settings")} language={language} t={t} />
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

function TermsScreen({ language, t, setScreen }) {
  return (
    <main className="main-screen terms-screen scroll-screen">
      <Header title={t("terms")} compact back={() => setScreen("settings")} language={language} t={t} />
      <section className="terms-content">
        <p className="updated">{t("lastUpdated")}: {today()}</p>
        {termsSections[language].map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function ContactScreen({ language, t, setScreen, setToast }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  return (
    <main className="main-screen contact-screen scroll-screen">
      <Header title={t("contactUs")} back={() => setScreen("settings")} language={language} t={t} />
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
          onClick={() => {
            setMessage("");
            setToast(t("messageSaved"));
          }}
        >
          {t("send")}
        </button>
      </section>
    </main>
  );
}

function BottomNav({ active, setScreen, setModal, canUseAccount, t }) {
  const items = [
    { id: "home", label: t("home"), icon: <ContactRound size={36} /> },
    { id: "add", label: t("add"), icon: <Plus size={30} />, matched: true },
    { id: "search", label: t("search"), icon: <Search size={42} />, matched: true },
    { id: "settings", label: t("settings"), icon: <Settings size={42} /> }
  ];
  const go = (id) => {
    if (id === "add" && !canUseAccount) {
      setModal({ type: "accountPrompt", intent: "add" });
      return;
    }
    setScreen(id);
  };

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={`${active === item.id ? "nav-active" : ""}${item.matched ? " nav-matched" : ""}`}
          aria-label={item.label}
          onClick={() => go(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
      <div className="home-indicator" />
    </nav>
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
  return (
    <label className="field-wrap">
      <span className="field-label">
        {label}
        {required && <em>{requiredLabel}</em>}
      </span>
      <span className="date-field">
        <span className={value ? "" : "muted"}>{value || label}</span>
        <input
          className={error ? "has-error" : ""}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Calendar size={28} />
      </span>
      {error && <p className="error-text">* {error}</p>}
    </label>
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

  const give = () => {
    if (onGive()) return;
    setShowLimit(true);
  };

  return (
    <div className="modal-backdrop flower-backdrop" onClick={onClose}>
      <div className="flower-modal" onClick={(event) => event.stopPropagation()}>
        <button className="flower-close-button" type="button" onClick={onClose} aria-label={t("back")}>
          <X size={36} />
        </button>
        <button className="flower-nav-button left" type="button" aria-hidden="true" tabIndex={-1}>
          <ChevronLeft size={50} />
        </button>
        <button className="flower-nav-button right" type="button" aria-hidden="true" tabIndex={-1}>
          <ChevronRight size={50} />
        </button>
        <button className="flower-pick-button" type="button" onClick={give} aria-label={t("giveFlower")}>
          <RoseGraphic />
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

function VerifyModal({ user, t, onProceed, onCancel, onBackFromCode }) {
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
  const [channelId, setChannelId] = useState(channels[0]?.id || "mobile");
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
  const selectedChannel = channels.find((channel) => channel.id === channelId) || channels[0];
  const codeStep = step === "code";
  const resendWaitSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  const resendBlocked = resendWaitSeconds > 0;

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
        const errorMessage = data.error || data.message || t("couldNotSend");
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

  const chooseDifferentMethod = () => {
    setStep("choose");
    setCode("");
    setMessage("");
    setError("");
  };

  const goBackFromCode = () => {
    if (loading) return;
    if (onBackFromCode) {
      onBackFromCode();
      return;
    }
    chooseDifferentMethod();
  };

  const verifyCode = async () => {
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
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="verify-modal" onClick={(event) => event.stopPropagation()}>
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
            <div className="verify-destination">
              <strong>{selectedChannel?.label}</strong>
              <p>{selectedChannel?.value}</p>
            </div>
            <label className="otp-code-field">
              <span>{t("activationCode")}</span>
              <input
                ref={codeInputRef}
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
            </label>
          </div>
        )}
        {message && <p className="verify-message">{message}</p>}
        {expiresAt && (
          <p className="verify-note">
            {t("expiresAt")} {new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {error && <p className="verify-error">{error}</p>}
        <button className="primary-button" disabled={loading || !selectedChannel} onClick={codeStep ? verifyCode : sendCode}>
          {loading ? t("pleaseWait") : codeStep ? t("verifyProceed") : selectedChannel?.id === "mobile" ? t("sendWhatsappCode") : t("send")}
        </button>
        {codeStep && (
          <button className="ghost-link resend-link" disabled={loading || resendBlocked} onClick={sendCode}>
            {resendBlocked ? formatText(t("resendIn"), { time: formatWaitTime(resendWaitSeconds) }) : t("resendCode")}
          </button>
        )}
        {codeStep && (
          <button className="ghost-link resend-link" disabled={loading} onClick={goBackFromCode}>
            {t("back")}
          </button>
        )}
      </div>
    </div>
  );
}

function AccountPrompt({ t, intent = "follow", onCreate, onLogin, onClose }) {
  const isAdd = intent === "add";
  const isFlower = intent === "flower";
  return (
    <div className="modal-backdrop bottom" onClick={onClose}>
      <div className="account-prompt" onClick={(event) => event.stopPropagation()}>
        <span className="drag-handle" />
        <div className="prompt-icon">
          <LockKeyhole size={34} />
        </div>
        <h2>{isAdd ? t("accountPromptAddTitle") : isFlower ? t("accountPromptFlowerTitle") : t("accountPromptTitle")}</h2>
        <p>{isAdd ? t("accountPromptAddBody") : isFlower ? t("accountPromptFlowerBody") : t("accountPromptBody")}</p>
        <button className="primary-button" onClick={onCreate}>
          <UserRoundPlus size={20} /> {t("createAccount")}
        </button>
        <button className="outline-button" onClick={onLogin}>
          <DoorOpen size={20} /> {t("signIn")}
        </button>
        <button className="ghost-link" onClick={onClose}>
          {t("continueBrowsing")}
        </button>
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
  return (
    <span
      className={`flag-visual flag-${code} ${large ? "large" : ""}`}
      aria-label={`${country?.name || "Country"} flag`}
      role="img"
    >
      <span>{code.toUpperCase()}</span>
    </span>
  );
}

function RoseGraphic({ small = false }) {
  return (
    <svg
      className={`rose-graphic ${small ? "small" : ""}`}
      viewBox="0 0 220 320"
      role="img"
      aria-label="Rose"
      focusable="false"
    >
      <path className="rose-stem-shadow" d="M109 130 C94 184 101 238 82 303" />
      <path className="rose-stem" d="M112 126 C98 184 104 235 86 302" />
      <path className="rose-leaf back" d="M98 220 C55 197 42 166 80 166 C111 167 119 191 98 220Z" />
      <path className="rose-leaf front" d="M100 251 C143 229 163 200 126 194 C94 190 78 220 100 251Z" />
      <path className="rose-leaf small-leaf" d="M109 185 C142 172 151 148 123 144 C102 144 95 164 109 185Z" />
      <g className="rose-bloom">
        <path className="petal p1" d="M111 40 C142 25 174 43 180 78 C160 62 136 66 120 91 C114 75 108 58 111 40Z" />
        <path className="petal p2" d="M105 42 C69 26 39 49 40 88 C62 67 89 70 105 96 C111 73 111 55 105 42Z" />
        <path className="petal p3" d="M58 83 C38 111 52 149 91 161 C79 131 89 104 117 92 C93 79 72 75 58 83Z" />
        <path className="petal p4" d="M162 79 C190 103 181 144 142 162 C152 127 142 105 113 92 C133 78 151 74 162 79Z" />
        <path className="petal p5" d="M80 67 C104 49 139 51 157 72 C132 75 111 91 103 121 C91 102 82 86 80 67Z" />
        <path className="petal p6" d="M74 113 C91 83 127 73 154 92 C134 104 120 125 119 154 C96 145 80 132 74 113Z" />
        <path className="petal p7" d="M143 112 C121 83 84 76 62 99 C87 107 103 126 106 157 C126 146 140 131 143 112Z" />
        <path className="petal p8" d="M86 145 C107 159 133 159 153 143 C148 173 124 192 97 181 C79 173 73 157 86 145Z" />
        <path className="petal center" d="M91 91 C105 68 139 67 151 91 C132 88 117 99 111 123 C105 105 99 96 91 91Z" />
        <path className="petal core" d="M103 96 C113 82 132 83 141 97 C128 99 119 107 115 121 C112 110 108 102 103 96Z" />
        <path className="petal fold" d="M95 111 C112 96 137 100 148 119 C129 115 113 122 101 140 C96 129 94 119 95 111Z" />
      </g>
    </svg>
  );
}

function AvatarSilhouette() {
  return (
    <svg className="avatar-svg" viewBox="0 0 120 120" role="img" aria-label="Default avatar">
      <circle cx="60" cy="60" r="58" fill="#d8d8d8" />
      <path d="M35 105c6-17 20-25 25-25s19 8 25 25H35Z" fill="#fff" />
      <path d="M37 58c0-19 10-34 23-34s23 15 23 34c0 16-9 29-23 29S37 74 37 58Z" fill="#fff" />
      <path d="M74 16c18 7 31 23 36 43-15-7-27-19-36-43Z" fill="#cfcfcf" opacity=".8" />
    </svg>
  );
}

createRoot(document.getElementById("root")).render(<App />);
