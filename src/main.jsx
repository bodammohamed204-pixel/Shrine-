import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  CircleUserRound,
  ContactRound,
  DoorOpen,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Home,
  ImageUp,
  LockKeyhole,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  UserRoundPlus
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "shrine_mobile_state_v1";

function defaultApiBaseUrl() {
  if (typeof window === "undefined" || !import.meta.env.DEV) return "";
  const { hostname, port, protocol } = window.location;
  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

  if ((protocol === "http:" || protocol === "https:") && localHosts.has(hostname) && port !== "5184") {
    return `http://${hostname === "localhost" ? "localhost" : "127.0.0.1"}:5184`;
  }

  return "";
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl()).replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
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
  currentCountry: "United States",
  homeFilter: "United States",
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
    noMemorials: "No memorials yet",
    noMemorialsBody: "Use the add button to create the first real entry from your own data.",
    browseCountry: "Browse country",
    add: "Add",
    selected: "Selected",
    fullName: "Full Name (including Surname)",
    verifySurname: "Verify Surname",
    dateOfDeath: "Date of Death",
    dateOfBirth: "Date of Birth",
    age: "Age",
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
    whatsappCode: "WhatsApp activation code",
    mobileWhatsapp: "Mobile (WhatsApp)",
    activationCode: "Activation Code",
    sixDigitCode: "6-digit code",
    codeSent: "WhatsApp code sent.",
    enterCode: "Enter the WhatsApp code first.",
    couldNotSend: "Could not send WhatsApp code.",
    couldNotVerify: "Could not verify WhatsApp code.",
    codeWrong: "The code is incorrect or expired.",
    expiresAt: "Expires at",
    pleaseWait: "Please wait...",
    verifyProceed: "Verify & Proceed",
    sendWhatsappCode: "Send WhatsApp Code",
    resendCode: "Resend code",
    emailOrPhone: "Email or mobile number",
    emailOrPhonePlaceholder: "email@example.com or mobile number",
    accountPromptTitle: "Create an account to save your follows",
    accountPromptBody: "Your following list belongs to your account, so it stays separate from guest browsing.",
    accountPromptAddTitle: "Create an account to add a shrine",
    accountPromptAddBody: "Add a shrine, preserve details, and manage it safely from your own account.",
    signIn: "Sign in"
  },
  AR: {
    shrine: "المزارات",
    registerTitle: "ابدأ حسابك",
    registerIntro: "أنشئ حسابًا خاصًا واحفظ كل ذكرى باسمك.",
    firstName: "الاسم الأول",
    surname: "اسم العائلة",
    mobileNumber: "رقم الهاتف",
    emailAddress: "البريد الإلكتروني",
    gender: "النوع",
    country: "الدولة",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    continue: "متابعة",
    alreadyHaveAccount: "لديك حساب بالفعل؟",
    login: "تسجيل الدخول",
    continueBrowsing: "تصفح كزائر",
    selectCallingCode: "اختر كود الدولة",
    required: "مطلوب",
    startRequired: "أكمل الحقول المطلوبة",
    errFirstName: "الاسم الأول مطلوب",
    errSurname: "اسم العائلة مطلوب",
    errPhone: "أدخل رقم هاتف صحيح",
    errEmail: "أدخل بريدًا إلكترونيًا صحيحًا",
    errGender: "النوع مطلوب",
    errPassword: "كلمة المرور مطلوبة",
    errPasswordLength: "استخدم 8 أحرف على الأقل",
    errPasswordMatch: "كلمتا المرور غير متطابقتين",
    welcomeBack: "مرحبًا بعودتك",
    loginIntro: "سجل الدخول بالحساب الذي أنشأته على هذا الجهاز.",
    back: "رجوع",
    newHere: "مستخدم جديد؟",
    createAccount: "إنشاء حساب",
    badLogin: "راجع البريد الإلكتروني أو رقم الهاتف وكلمة المرور",
    success: "تم بنجاح",
    congrats: "تهانينا!",
    successBody: "حسابك جاهز. ابدأ بإضافة الذكريات وإدارتها من ملفك.",
    letsStart: "لنبدأ",
    sponsor: "الداعمون",
    follow: "المتابعة",
    noMemorials: "لا توجد ذكريات بعد",
    noMemorialsBody: "استخدم زر الإضافة لإنشاء أول إدخال من بياناتك.",
    browseCountry: "تصفح حسب الدولة",
    add: "إضافة",
    selected: "تم الاختيار",
    fullName: "الاسم الكامل (مع اسم العائلة)",
    verifySurname: "تأكيد اسم العائلة",
    dateOfDeath: "تاريخ الوفاة",
    dateOfBirth: "تاريخ الميلاد",
    age: "العمر",
    information: "معلومات",
    words: "كلمة",
    create: "إنشاء",
    memorialCreated: "تم إنشاء الذكرى",
    errFullName: "الاسم الكامل مطلوب",
    errDeathDate: "تاريخ الوفاة مطلوب",
    errCountry: "الدولة مطلوبة",
    errInfo: "استخدم 250 كلمة أو أقل",
    search: "بحث",
    startTyping: "ابدأ الكتابة للبحث",
    noResults: "لا توجد نتائج",
    noResultsBody: "جرب اسمًا أو دولة أو كلمة من الوصف.",
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
    memorial: "الذكرى",
    entryNotFound: "الإدخال غير موجود",
    unknownBirth: "تاريخ الميلاد غير معروف",
    following: "تتم المتابعة",
    block: "حظر",
    unblock: "إلغاء الحظر",
    noBlockedUsers: "لا يوجد مستخدمون محظورون",
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
    whatsappCode: "كود تفعيل واتساب",
    mobileWhatsapp: "الهاتف (واتساب)",
    activationCode: "كود التفعيل",
    sixDigitCode: "كود من 6 أرقام",
    codeSent: "تم إرسال كود واتساب.",
    enterCode: "أدخل كود واتساب أولًا.",
    couldNotSend: "تعذر إرسال كود واتساب.",
    couldNotVerify: "تعذر التحقق من كود واتساب.",
    codeWrong: "الكود غير صحيح أو انتهت صلاحيته.",
    expiresAt: "ينتهي في",
    pleaseWait: "برجاء الانتظار...",
    verifyProceed: "تحقق وتابع",
    sendWhatsappCode: "إرسال كود واتساب",
    resendCode: "إعادة إرسال الكود",
    emailOrPhone: "البريد الإلكتروني أو رقم الهاتف",
    emailOrPhonePlaceholder: "email@example.com أو رقم الهاتف",
    accountPromptTitle: "أنشئ حسابًا لحفظ المتابعات",
    accountPromptBody: "قائمة المتابعة مرتبطة بحسابك حتى تبقى منفصلة عن تصفح الزائر.",
    accountPromptAddTitle: "أنشئ حسابًا لإضافة مزار",
    accountPromptAddBody: "أضف مزارًا، واحفظ التفاصيل، وتحكم فيه بأمان من حسابك.",
    signIn: "تسجيل الدخول"
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
        "يحفظ حسابك الذكريات وبيانات الملف الشخصي والمتابعات والإعدادات التي تضيفها داخل التطبيق. حافظ على بيانات الدخول الخاصة بك وحدث أي معلومات غير صحيحة."
    },
    {
      title: "2. إدخالات الذكرى",
      body:
        "أضف فقط الأسماء والصور والتواريخ والقصص التي تملك حق مشاركتها. يمكنك تعديل أو حذف إدخالاتك من هذا الجهاز في أي وقت."
    },
    {
      title: "3. الاستخدام باحترام",
      body:
        "لا تضف محتوى ضارًا أو مضللًا أو مسيئًا أو خاصًا عن أي شخص. استخدم أدوات الحظر والإبلاغ لحماية تجربتك."
    },
    {
      title: "4. البيانات المحلية",
      body:
        "يحفظ هذا الإصدار البيانات في مساحة تخزين المتصفح أو التطبيق على جهازك. مسح بيانات التطبيق أو استخدام جهاز آخر قد يزيل الحسابات والذكريات المحفوظة."
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
    const savedPeople = Array.isArray(merged.people) ? merged.people : [];
    const people = [
      ...defaultPeople,
      ...savedPeople.filter((person) => !defaultPeople.some((sample) => sample.id === person.id))
    ];

    return {
      ...merged,
      people,
      guest: merged.currentUser ? false : true,
      currentCountry: merged.currentCountry || initialState.currentCountry,
      homeFilter: merged.homeFilter || initialState.homeFilter
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

function getUserName(user) {
  if (!user) return "Guest";
  return `${user.firstName || ""} ${user.surname || ""}`.trim() || user.email;
}

function findCountry(name) {
  return countries.find((country) => country.name === name || country.ar === name) || countries[0];
}

function normalizeLanguage(language) {
  return language === "AR" ? "AR" : "EN";
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
    setState((current) => ({ ...current, ...patch }));
  };

  const addPerson = (person) => {
    setState((current) => ({
      ...current,
      people: [{ ...person, id: uid(), createdBy: current.currentUser?.id || "guest" }, ...current.people]
    }));
    setToast(t("memorialCreated"));
    setScreen("home");
  };

  const registerUser = (user) => {
    const completeUser = { ...user, id: uid(), createdAt: new Date().toISOString() };
    setState((current) => ({
      ...current,
      currentUser: completeUser,
      users: [completeUser, ...current.users.filter((item) => item.email !== completeUser.email)],
      guest: false,
      language: user.language
    }));
    setScreen("success");
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
    updateState({ currentUser: user, guest: false, language: user.language || state.language });
    setScreen("home");
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
    canUseAccount
  };

  return (
    <div className={`app-shell ${isArabic ? "rtl" : ""}`} dir={isArabic ? "rtl" : "ltr"} lang={isArabic ? "ar" : "en"}>
      {opening && <SplashIntro />}
      {screen === "register" && (
        <RegisterScreen
          state={state}
          language={language}
          t={t}
          updateState={updateState}
          onRegister={registerUser}
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
          onLogin={loginUser}
          onBack={() => setScreen("home")}
          setScreen={setScreen}
        />
      )}
      {screen === "success" && <SuccessScreen state={state} t={t} setScreen={setScreen} />}
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

      {["home", "add", "search", "settings"].includes(screen) && (
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
          onProceed={() => {
            setModal(null);
            modal.onProceed();
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
  return (
    <button className="language-mini" onClick={onClick}>
      <span>{value}</span>
      <ChevronDown size={18} />
    </button>
  );
}

function RegisterScreen({ state, language, t, updateState, onRegister, onLogin, onGuest, setModal, setToast }) {
  const [form, setForm] = useState({
    language: state.language || "EN",
    firstName: "",
    surname: "",
    phoneCountry: countries[1],
    phone: "",
    email: "",
    gender: "",
    country: "United States",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setLanguage = () => {
    const nextLanguage = form.language === "EN" ? "AR" : "EN";
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
              onPick: (country) => setField("phoneCountry", country)
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
            onPick: (country) => setField("country", country.name)
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

function LoginScreen({ state, t, onLogin, onBack, setScreen }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <main className="auth-screen scroll-screen">
      <button className="back-text" onClick={onBack}>
        <ArrowLeft size={24} /> {t("back")}
      </button>
      <section className="auth-intro login">
        <h1>{t("welcomeBack")}</h1>
        <p>{t("loginIntro")}</p>
      </section>
      <Input
        label={t("emailOrPhone")}
        placeholder={t("emailOrPhonePlaceholder")}
        value={identifier}
        onChange={setIdentifier}
      />
      <PasswordInput
        label={t("password")}
        value={password}
        visible={visible}
        onToggle={() => setVisible((value) => !value)}
        onChange={setPassword}
        t={t}
      />
      <button className="primary-button" onClick={() => onLogin(identifier, password)}>
        {t("login")}
      </button>
      <button className="text-link wide" onClick={() => setScreen("register")}>
        {t("newHere")} <span>{t("createAccount")}</span>
      </button>
    </main>
  );
}

function SuccessScreen({ state, t, setScreen }) {
  return (
    <main className="success-screen">
      <LanguageButton value={state.language || "EN"} onClick={() => {}} />
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
  const selectedCountry = findCountry(state.currentCountry || activeUser?.country || "Egypt");
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
    { id: "Sponsor", label: t("sponsor") },
    { id: "Follow", label: t("follow") },
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
      <span>{person.fullName}</span>
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
    country: activeUser?.country || "Egypt",
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
    const value = `${person.fullName} ${person.country} ${person.info}`.toLowerCase();
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

function SettingsScreen({ state, t, updateState, setScreen, logout }) {
  const [languageOpen, setLanguageOpen] = useState(false);

  return (
    <main className="main-screen settings-screen scroll-screen">
      <h1 className="plain-title">{t("settings")}</h1>
      <div className="settings-list">
        <SettingsItem icon={<UserRound />} label={t("profile")} onClick={() => setScreen("profile")} />
        <div className={`settings-card language-card ${languageOpen ? "open" : ""}`}>
          <button className="settings-row" onClick={() => setLanguageOpen((value) => !value)}>
            <span className="setting-icon">
              <Flag country={countries.find((country) => country.iso === "gb")} />
            </span>
            <span>{t("language")}</span>
            {languageOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </button>
          {languageOpen && (
            <div className="language-options">
              <button onClick={() => updateState({ language: "AR" })}>
                <Flag country={countries.find((country) => country.iso === "kw")} /> {t("arabic")}
              </button>
              <button onClick={() => updateState({ language: "EN" })}>
                <Flag country={countries.find((country) => country.iso === "gb")} /> {t("english")}
              </button>
            </div>
          )}
        </div>
        <SettingsItem icon={<Ban />} label={t("blockedUsers")} onClick={() => setScreen("blocked")} />
        <SettingsItem icon={<Headphones />} label={t("contactUs")} onClick={() => setScreen("contact")} />
        <SettingsItem icon={<FileText />} label={t("terms")} onClick={() => setScreen("terms")} />
        <SettingsItem icon={<DoorOpen />} label={t("logout")} onClick={logout} />
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
    country: activeUser?.country || "Egypt"
  });

  const save = () => {
    if (!activeUser) {
      setScreen("register");
      return;
    }
    const updated = { ...activeUser, ...form };
    updateState({
      currentUser: updated,
      users: state.users.map((user) => (user.id === updated.id ? updated : user))
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

function DetailScreen({ state, language, t, updateState, setScreen, setModal, canUseAccount }) {
  const person = state.people.find((item) => item.id === state.selectedPersonId);
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
      <Header title={t("memorial")} back={() => setScreen("home")} language={language} t={t} />
      <section className="detail-card">
        <div className="detail-photo">
          {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
        </div>
        <h2>{person.fullName}</h2>
        <p className="detail-dates">
          {person.birthDate || t("unknownBirth")} - {person.deathDate}
        </p>
        <p className="detail-country">
          <Flag country={findCountry(person.country)} /> {countryLabel(person.country, language)}
        </p>
        {person.info && <p className="detail-info">{person.info}</p>}
        <div className="detail-actions">
          <button className={followed ? "primary-button small active" : "primary-button small"} onClick={toggleFollow}>
            <UserRoundPlus size={20} /> {followed ? t("following") : t("follow")}
          </button>
          <button className="outline-button small" onClick={toggleBlock}>
            <Ban size={20} /> {blocked ? t("unblock") : t("block")}
          </button>
        </div>
      </section>
    </main>
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
    { id: "add", label: t("add"), icon: <Plus size={42} /> },
    { id: "search", label: t("search"), icon: <Search size={42} /> },
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
          className={active === item.id ? "nav-active" : ""}
          onClick={() => go(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
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
  const [age, setAge] = useState(value || "");

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="age-modal" onClick={(event) => event.stopPropagation()}>
        <h2>{t("age")}</h2>
        <input
          autoFocus
          inputMode="numeric"
          placeholder={t("age")}
          value={age}
          onChange={(event) => setAge(event.target.value.replace(/\D/g, "").slice(0, 3))}
        />
        <button className="primary-button" onClick={() => onSave(age)}>
          {t("save")}
        </button>
      </div>
    </div>
  );
}

function CountryModal({ title, language, t, onPick, onClose, withCodes }) {
  const [query, setQuery] = useState("");
  const results = countries.filter((country) =>
    `${country.name} ${country.ar} ${country.code}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="country-modal" onClick={(event) => event.stopPropagation()}>
        <div className="country-search">
          <input placeholder={withCodes ? t("searchCountry") : t("search")} value={query} onChange={(event) => setQuery(event.target.value)} />
          <Search size={26} />
        </div>
        <div className="modal-title">{title}</div>
        <div className="country-list">
          {results.map((country) => (
            <button key={`${country.name}-${country.code}`} onClick={() => onPick(country)}>
              <Flag country={country} />
              <strong>{countryLabel(country, language)}</strong>
              {withCodes && <em>{country.code}</em>}
            </button>
          ))}
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

function VerifyModal({ user, t, onProceed, onCancel }) {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sendCode = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(apiUrl("/api/otp/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: user.otpPhone, codeLength: 6 })
      });
      const data = await readApiJson(response, t("couldNotSend"));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.message || t("couldNotSend"));
      }
      setSent(true);
      setExpiresAt(data.expiresAt || "");
      setMessage(data.message || t("codeSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("couldNotSend"));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      setError(t("enterCode"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: user.otpPhone, code })
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
        <h2>{t("whatsappCode")}</h2>
        <div className="verify-option selected">
          <span className="radio" />
          <div>
            <strong>{t("mobileWhatsapp")}</strong>
            <p>
              {user.phoneCode} {user.phone}
            </p>
          </div>
        </div>
        {sent && (
          <label className="otp-code-field">
            <span>{t("activationCode")}</span>
            <input
              inputMode="numeric"
              maxLength={8}
              placeholder={t("sixDigitCode")}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}
        {message && <p className="verify-message">{message}</p>}
        {expiresAt && (
          <p className="verify-note">
            {t("expiresAt")} {new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {error && <p className="verify-error">{error}</p>}
        <button className="primary-button" disabled={loading} onClick={sent ? verifyCode : sendCode}>
          {loading ? t("pleaseWait") : sent ? t("verifyProceed") : t("sendWhatsappCode")}
        </button>
        {sent && (
          <button className="ghost-link resend-link" disabled={loading} onClick={sendCode}>
            {t("resendCode")}
          </button>
        )}
      </div>
    </div>
  );
}

function AccountPrompt({ t, intent = "follow", onCreate, onLogin, onClose }) {
  const isAdd = intent === "add";
  return (
    <div className="modal-backdrop bottom" onClick={onClose}>
      <div className="account-prompt" onClick={(event) => event.stopPropagation()}>
        <span className="drag-handle" />
        <div className="prompt-icon">
          <LockKeyhole size={34} />
        </div>
        <h2>{isAdd ? t("accountPromptAddTitle") : t("accountPromptTitle")}</h2>
        <p>{isAdd ? t("accountPromptAddBody") : t("accountPromptBody")}</p>
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
