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

const countries = [
  { name: "Egypt", code: "+20", iso: "eg" },
  { name: "United States", code: "+1", iso: "us" },
  { name: "Saudi Arabia", code: "+966", iso: "sa" },
  { name: "United Arab Emirates", code: "+971", iso: "ae" },
  { name: "Kuwait", code: "+965", iso: "kw" },
  { name: "Qatar", code: "+974", iso: "qa" },
  { name: "Jordan", code: "+962", iso: "jo" },
  { name: "Morocco", code: "+212", iso: "ma" },
  { name: "Algeria", code: "+213", iso: "dz" },
  { name: "Tunisia", code: "+216", iso: "tn" },
  { name: "Germany", code: "+49", iso: "de" },
  { name: "France", code: "+33", iso: "fr" },
  { name: "United Kingdom", code: "+44", iso: "gb" },
  { name: "Canada", code: "+1", iso: "ca" },
  { name: "Australia", code: "+61", iso: "au" },
  { name: "Turkey", code: "+90", iso: "tr" },
  { name: "Italy", code: "+39", iso: "it" },
  { name: "Spain", code: "+34", iso: "es" },
  { name: "Malaysia", code: "+60", iso: "my" },
  { name: "Indonesia", code: "+62", iso: "id" }
];

const initialState = {
  currentUser: null,
  users: [],
  people: [],
  following: [],
  blocked: [],
  language: "EN",
  homeFilter: "Sponsor",
  guest: false
};

const termsSections = [
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
];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...initialState, ...saved } : initialState;
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
  return countries.find((country) => country.name === name) || countries[0];
}

function App() {
  const [state, setState] = useState(loadState);
  const [screen, setScreen] = useState(() =>
    state.currentUser || state.guest ? "home" : "register"
  );
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

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
    setToast("Memorial created");
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

  const loginUser = (email, password) => {
    const user = state.users.find((item) => item.email === email && item.password === password);
    if (!user) {
      setToast("Check your email and password");
      return false;
    }
    updateState({ currentUser: user, guest: false, language: user.language || state.language });
    setScreen("home");
    return true;
  };

  const logout = () => {
    updateState({ currentUser: null, guest: false });
    setScreen("register");
  };

  const activeUser = state.currentUser;
  const canUseAccount = Boolean(activeUser);

  const commonProps = {
    state,
    updateState,
    setScreen,
    setModal,
    setToast,
    activeUser,
    canUseAccount
  };

  return (
    <div className="app-shell">
      <StatusBar />
      {screen === "register" && (
        <RegisterScreen
          state={state}
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
          onLogin={loginUser}
          onBack={() => setScreen("register")}
          setScreen={setScreen}
        />
      )}
      {screen === "success" && <SuccessScreen state={state} setScreen={setScreen} />}
      {screen === "home" && <HomeScreen {...commonProps} />}
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
        <BottomNav active={screen} setScreen={setScreen} />
      )}

      {modal?.type === "country" && (
        <CountryModal
          title={modal.title || "Country"}
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
          <h2 className="sheet-title">Gender</h2>
          {["Male", "Female"].map((gender) => (
            <button
              key={gender}
              className="sheet-row"
              onClick={() => {
                modal.onPick(gender);
                setModal(null);
              }}
            >
              {gender}
            </button>
          ))}
        </Sheet>
      )}
      {modal?.type === "age" && (
        <AgeModal
          value={modal.value}
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
          selected={modal.selected}
          setSelected={modal.setSelected}
          onCancel={() => setModal(null)}
          onProceed={() => {
            setModal(null);
            modal.onProceed();
          }}
        />
      )}
      {modal?.type === "accountPrompt" && (
        <AccountPrompt
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

function StatusBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit"
        })
      );
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="status-bar" aria-hidden="true">
      <div className="status-left">
        <strong>{time}</strong>
        <span className="mini-dot" />
        <span className="mini-pill" />
        <span className="mini-pill second" />
      </div>
      <div className="status-right">
        <span>Wi-Fi</span>
        <span className="signal-bars" />
        <span className="battery">84%</span>
      </div>
    </div>
  );
}

function Header({ title, back, action, compact = false, flagCountry, onFlag }) {
  return (
    <header className={`top-header ${compact ? "compact" : ""}`}>
      {back && (
        <button className="header-icon left" onClick={back} aria-label="Back">
          <ArrowLeft size={32} />
        </button>
      )}
      <div className="rays" />
      <h1>{title}</h1>
      {flagCountry && (
        <button className="flag-button" onClick={onFlag} aria-label="Choose country">
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

function RegisterScreen({ state, updateState, onRegister, onLogin, onGuest, setModal, setToast }) {
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
  const [verifyBy, setVerifyBy] = useState("email");
  const [errors, setErrors] = useState({});

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = () => {
    const nextErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = "First name is required";
    if (!form.surname.trim()) nextErrors.surname = "Surname is required";
    if (!/^\d{7,14}$/.test(form.phone)) nextErrors.phone = "Enter a valid mobile number";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = "Enter a valid email";
    if (!form.gender) nextErrors.gender = "Gender is required";
    if (!form.password) nextErrors.password = "Password is required";
    if (form.password.length > 0 && form.password.length < 8) {
      nextErrors.password = "Use at least 8 characters";
    }
    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setToast("Complete the required fields");
      return;
    }

    const user = {
      ...form,
      phoneCountry: form.phoneCountry.name,
      phoneCode: form.phoneCountry.code,
      phoneIso: form.phoneCountry.iso
    };

    setModal({
      type: "verify",
      user,
      selected: verifyBy,
      setSelected: setVerifyBy,
      onProceed: () => onRegister(user)
    });
  };

  return (
    <main className="auth-screen scroll-screen">
      <LanguageButton
        value={form.language}
        onClick={() => setField("language", form.language === "EN" ? "AR" : "EN")}
      />
      <section className="auth-intro">
        <h1>Start Your Shrine</h1>
        <p>Create a private account and keep every memorial under your own name.</p>
      </section>

      <div className="two-grid">
        <Input
          label="First Name"
          placeholder="First Name"
          value={form.firstName}
          error={errors.firstName}
          onChange={(value) => setField("firstName", value)}
        />
        <Input
          label="Surname"
          placeholder="Surname"
          value={form.surname}
          error={errors.surname}
          onChange={(value) => setField("surname", value)}
        />
      </div>

      <label className="field-label">Mobile Number</label>
      <div className={`phone-field ${errors.phone ? "has-error" : ""}`}>
        <button
          className="country-code-button"
          onClick={() =>
            setModal({
              type: "country",
              title: "Select calling code",
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
        label="Email Address"
        placeholder="email@example.com"
        type="email"
        value={form.email}
        error={errors.email}
        onChange={(value) => setField("email", value)}
      />

      <SelectField
        label="Gender"
        placeholder="Gender"
        value={form.gender}
        error={errors.gender}
        onClick={() =>
          setModal({
            type: "gender",
            onPick: (gender) => setField("gender", gender)
          })
        }
      />

      <SelectField
        label="Country"
        value={form.country}
        onClick={() =>
          setModal({
            type: "country",
            title: "Country",
            onPick: (country) => setField("country", country.name)
          })
        }
      />

      <PasswordInput
        label="Password"
        value={form.password}
        error={errors.password}
        visible={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
        onChange={(value) => setField("password", value)}
      />
      <PasswordInput
        label="Confirm Password"
        value={form.confirmPassword}
        error={errors.confirmPassword}
        visible={showConfirm}
        onToggle={() => setShowConfirm((value) => !value)}
        onChange={(value) => setField("confirmPassword", value)}
      />

      <button className="primary-button" onClick={submit}>
        Continue
      </button>
      <button className="text-link wide" onClick={onLogin}>
        Already Have An Account? <span>Login</span>
      </button>
      <button className="ghost-link" onClick={onGuest}>
        Continue browsing
      </button>
    </main>
  );
}

function LoginScreen({ state, onLogin, onBack, setScreen }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <main className="auth-screen scroll-screen">
      <button className="back-text" onClick={onBack}>
        <ArrowLeft size={24} /> Back
      </button>
      <section className="auth-intro login">
        <h1>Welcome Back</h1>
        <p>Sign in with an account you created on this browser.</p>
      </section>
      <Input
        label="Email Address"
        placeholder="email@example.com"
        type="email"
        value={email}
        onChange={setEmail}
      />
      <PasswordInput
        label="Password"
        value={password}
        visible={visible}
        onToggle={() => setVisible((value) => !value)}
        onChange={setPassword}
      />
      <button className="primary-button" onClick={() => onLogin(email, password)}>
        Login
      </button>
      <button className="text-link wide" onClick={() => setScreen("register")}>
        New here? <span>Create account</span>
      </button>
    </main>
  );
}

function SuccessScreen({ state, setScreen }) {
  return (
    <main className="success-screen">
      <LanguageButton value={state.language || "EN"} onClick={() => {}} />
      <h1>Success</h1>
      <div className="success-mark">
        <div>
          <Check size={112} strokeWidth={4} />
        </div>
      </div>
      <h2>Congrats!</h2>
      <p>Your account is ready. Start adding memorials and manage everything from your profile.</p>
      <button className="primary-button" onClick={() => setScreen("home")}>
        Let&apos;s Start
      </button>
    </main>
  );
}

function HomeScreen({ state, updateState, setModal, setScreen, activeUser, canUseAccount }) {
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

  const tabs = ["Sponsor", "Follow", selectedCountry.name];

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
        title="Shrines"
        compact
        flagCountry={selectedCountry}
        onFlag={() =>
          setModal({
            type: "country",
            title: "Browse country",
            onPick: (country) => updateState({ currentCountry: country.name, homeFilter: country.name })
          })
        }
      />
      <section className="segmented">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={state.homeFilter === tab ? "active" : ""}
            onClick={() => setTab(tab)}
          >
            {tab}
          </button>
        ))}
      </section>
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
      {!filteredPeople.length && (
        <EmptyState
          icon={<Home size={56} />}
          title="No memorials yet"
          body="Use the add button to create the first real entry from your own data."
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

function AddScreen({ state, setModal, onCreate, activeUser }) {
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
    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required";
    if (!form.surnameCheck.trim()) nextErrors.surnameCheck = "Surname is required";
    if (!form.deathDate) nextErrors.deathDate = "Date of death is required";
    if (!form.gender) nextErrors.gender = "Gender is required";
    if (!form.country) nextErrors.country = "Country is required";
    if (form.info.trim().split(/\s+/).filter(Boolean).length > 250) {
      nextErrors.info = "Use 250 words or less";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onCreate(form);
  };

  const infoWords = form.info.trim().split(/\s+/).filter(Boolean).length;

  return (
    <main className="main-screen add-screen scroll-screen">
      <Header title="Add" compact />
      <section className="add-form">
        <label className="photo-picker">
          {form.photo ? <img src={form.photo} alt="Selected" /> : <AvatarSilhouette />}
          <span>
            <ImageUp size={24} />
          </span>
          <input type="file" accept="image/*" onChange={pickImage} />
        </label>

        <Input
          label="Full Name (including Surname)"
          required
          placeholder="Full Name (including Surname)"
          value={form.fullName}
          error={errors.fullName}
          onChange={(value) => setField("fullName", value)}
        />
        <Input
          label="Verify Surname"
          required
          placeholder="Verify Surname"
          value={form.surnameCheck}
          error={errors.surnameCheck}
          onChange={(value) => setField("surnameCheck", value)}
        />
        <DateField
          label="Date of Death"
          required
          value={form.deathDate}
          error={errors.deathDate}
          onChange={(value) => setField("deathDate", value)}
        />
        <DateField
          label="Date of Birth"
          value={form.birthDate}
          onChange={(value) => setField("birthDate", value)}
        />
        <div className="two-grid">
          <SelectField
            label="Age"
            placeholder="Age"
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
            label="Gender"
            required
            placeholder="Gender"
            value={form.gender}
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
          label="Country"
          required
          value={form.country}
          error={errors.country}
          onClick={() =>
            setModal({
              type: "country",
              title: "Country",
              onPick: (country) => setField("country", country.name)
            })
          }
        />
        <label className="field-label">Information</label>
        <textarea
          className={`text-area ${errors.info ? "has-error" : ""}`}
          placeholder="Information"
          value={form.info}
          onChange={(event) => setField("info", event.target.value)}
        />
        <div className="counter left">{infoWords}/250 words</div>
        {errors.info && <p className="error-text">* {errors.info}</p>}
        <button className="primary-button" onClick={create}>
          Create
        </button>
      </section>
    </main>
  );
}

function SearchScreen({ state, updateState, setScreen }) {
  const [query, setQuery] = useState("");
  const results = state.people.filter((person) => {
    const value = `${person.fullName} ${person.country} ${person.info}`.toLowerCase();
    return query.trim() && value.includes(query.toLowerCase());
  });

  return (
    <main className="main-screen search-screen">
      <Header title="Search" compact />
      <section className="search-box">
        <Search size={30} />
        <input
          autoComplete="off"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </section>
      {!query && <EmptyState title="Start typing to search" />}
      {query && !results.length && <EmptyState title="No results found" body="Try a name, country, or story word." />}
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

function SettingsScreen({ state, updateState, setScreen, logout }) {
  const [languageOpen, setLanguageOpen] = useState(false);

  return (
    <main className="main-screen settings-screen scroll-screen">
      <h1 className="plain-title">Settings</h1>
      <div className="settings-list">
        <SettingsItem icon={<UserRound />} label="Profile" onClick={() => setScreen("profile")} />
        <div className={`settings-card language-card ${languageOpen ? "open" : ""}`}>
          <button className="settings-row" onClick={() => setLanguageOpen((value) => !value)}>
            <span className="setting-icon">
              <Flag country={countries.find((country) => country.iso === "gb")} />
            </span>
            <span>Language</span>
            {languageOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </button>
          {languageOpen && (
            <div className="language-options">
              <button onClick={() => updateState({ language: "AR" })}>
                <Flag country={countries.find((country) => country.iso === "kw")} /> العربية
              </button>
              <button onClick={() => updateState({ language: "EN" })}>
                <Flag country={countries.find((country) => country.iso === "gb")} /> English
              </button>
            </div>
          )}
        </div>
        <SettingsItem icon={<Ban />} label="Blocked Users" onClick={() => setScreen("blocked")} />
        <SettingsItem icon={<Headphones />} label="Contact Us" onClick={() => setScreen("contact")} />
        <SettingsItem icon={<FileText />} label="Terms & Conditions" onClick={() => setScreen("terms")} />
        <SettingsItem icon={<DoorOpen />} label="Logout" onClick={logout} />
      </div>
      <button className="primary-button settings-done" onClick={() => setScreen("home")}>
        Done
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

function ProfileScreen({ activeUser, setScreen }) {
  const user = activeUser;

  return (
    <main className="profile-screen main-screen">
      <button className="header-icon profile-back" onClick={() => setScreen("settings")} aria-label="Back">
        <ArrowLeft size={34} />
      </button>
      <button className="profile-edit" onClick={() => setScreen("editProfile")} aria-label="Edit profile">
        <CircleUserRound size={30} />
        <Pencil size={20} />
      </button>
      <h1>My Account</h1>
      <div className="profile-avatar">
        <AvatarSilhouette />
      </div>
      <h2>{getUserName(user)}</h2>
      <section className="info-panel">
        <h3>My Information</h3>
        <InfoLine icon={<Mail />} label="Email Address" value={user?.email || "Guest account"} />
        <InfoLine icon={<MapPin />} label="Country" value={user?.country || "Not selected"} />
      </section>
    </main>
  );
}

function EditProfileScreen({ activeUser, state, updateState, setScreen, setModal, setToast }) {
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
    setToast("Profile updated");
    setScreen("profile");
  };

  return (
    <main className="main-screen scroll-screen edit-screen">
      <Header title="Edit Profile" back={() => setScreen("profile")} />
      <section className="add-form">
        <Input
          label="First Name"
          placeholder="First Name"
          value={form.firstName}
          onChange={(value) => setForm((current) => ({ ...current, firstName: value }))}
        />
        <Input
          label="Surname"
          placeholder="Surname"
          value={form.surname}
          onChange={(value) => setForm((current) => ({ ...current, surname: value }))}
        />
        <Input
          label="Email Address"
          placeholder="email@example.com"
          value={form.email}
          onChange={(value) => setForm((current) => ({ ...current, email: value }))}
        />
        <SelectField
          label="Country"
          value={form.country}
          onClick={() =>
            setModal({
              type: "country",
              title: "Country",
              onPick: (country) => setForm((current) => ({ ...current, country: country.name }))
            })
          }
        />
        <button className="primary-button" onClick={save}>
          Save
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

function DetailScreen({ state, updateState, setScreen, setModal, canUseAccount }) {
  const person = state.people.find((item) => item.id === state.selectedPersonId);
  if (!person) {
    return (
      <main className="main-screen">
        <Header title="Memorial" back={() => setScreen("home")} />
        <EmptyState title="Entry not found" />
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
      <Header title="Shrine" back={() => setScreen("home")} />
      <section className="detail-card">
        <div className="detail-photo">
          {person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}
        </div>
        <h2>{person.fullName}</h2>
        <p className="detail-dates">
          {person.birthDate || "Unknown birth"} - {person.deathDate}
        </p>
        <p className="detail-country">
          <Flag country={findCountry(person.country)} /> {person.country}
        </p>
        {person.info && <p className="detail-info">{person.info}</p>}
        <div className="detail-actions">
          <button className={followed ? "primary-button small active" : "primary-button small"} onClick={toggleFollow}>
            <UserRoundPlus size={20} /> {followed ? "Following" : "Follow"}
          </button>
          <button className="outline-button small" onClick={toggleBlock}>
            <Ban size={20} /> {blocked ? "Unblock" : "Block"}
          </button>
        </div>
      </section>
    </main>
  );
}

function BlockedUsersScreen({ state, updateState, setScreen }) {
  const blockedPeople = state.people.filter((person) => state.blocked.includes(person.id));
  return (
    <main className="main-screen blocked-screen">
      <Header title="Blocked Users" compact back={() => setScreen("settings")} />
      {!blockedPeople.length && <EmptyState title="No blocked users" />}
      <section className="blocked-list">
        {blockedPeople.map((person) => (
          <div className="blocked-row" key={person.id}>
            <div>{person.photo ? <img src={person.photo} alt={person.fullName} /> : <AvatarSilhouette />}</div>
            <span>{person.fullName}</span>
            <button
              onClick={() => updateState({ blocked: state.blocked.filter((id) => id !== person.id) })}
            >
              Unblock
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

function TermsScreen({ setScreen }) {
  return (
    <main className="main-screen terms-screen scroll-screen">
      <Header title="Terms & Conditions" compact back={() => setScreen("settings")} />
      <section className="terms-content">
        <p className="updated">Last updated: {today()}</p>
        {termsSections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function ContactScreen({ setScreen, setToast }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  return (
    <main className="main-screen contact-screen scroll-screen">
      <Header title="Contact Us" back={() => setScreen("settings")} />
      <section className="add-form">
        <Input label="Your Email" placeholder="email@example.com" value={email} onChange={setEmail} />
        <label className="field-label">Message</label>
        <textarea
          className="text-area"
          placeholder="Write your message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          className="primary-button"
          onClick={() => {
            setMessage("");
            setToast("Message saved locally");
          }}
        >
          Send
        </button>
      </section>
    </main>
  );
}

function BottomNav({ active, setScreen }) {
  const items = [
    { id: "home", label: "Home", icon: <ContactRound size={36} /> },
    { id: "add", label: "Add", icon: <Plus size={42} /> },
    { id: "search", label: "Search", icon: <Search size={42} /> },
    { id: "settings", label: "Settings", icon: <Settings size={42} /> }
  ];
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={active === item.id ? "nav-active" : ""}
          onClick={() => setScreen(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
      <div className="home-indicator" />
    </nav>
  );
}

function Input({ label, required, placeholder, value = "", type = "text", error, onChange }) {
  return (
    <label className="field-wrap">
      <span className="field-label">
        {label}
        {required && <em>Required</em>}
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

function PasswordInput({ label, value = "", error, visible, onToggle, onChange }) {
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
        <button type="button" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff size={30} /> : <Eye size={30} />}
        </button>
      </span>
      {error && <p className="error-text">* {error}</p>}
    </label>
  );
}

function SelectField({ label, required, placeholder, value, error, onClick }) {
  return (
    <label className="field-wrap">
      <span className="field-label">
        {label}
        {required && <em>Required</em>}
      </span>
      <button className={`select-field ${error ? "has-error" : ""}`} onClick={onClick}>
        <span className={value ? "" : "muted"}>{value || placeholder}</span>
        <ChevronDown size={24} />
      </button>
      {error && <p className="error-text">* {error}</p>}
    </label>
  );
}

function DateField({ label, required, value, error, onChange }) {
  return (
    <label className="field-wrap">
      <span className="field-label">
        {label}
        {required && <em>Required</em>}
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

function AgeModal({ value, onSave, onCancel }) {
  const [age, setAge] = useState(value || "");

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="age-modal" onClick={(event) => event.stopPropagation()}>
        <h2>Age</h2>
        <input
          autoFocus
          inputMode="numeric"
          placeholder="Age"
          value={age}
          onChange={(event) => setAge(event.target.value.replace(/\D/g, "").slice(0, 3))}
        />
        <button className="primary-button" onClick={() => onSave(age)}>
          Save
        </button>
      </div>
    </div>
  );
}

function CountryModal({ title, onPick, onClose, withCodes }) {
  const [query, setQuery] = useState("");
  const results = countries.filter((country) =>
    `${country.name} ${country.code}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="country-modal" onClick={(event) => event.stopPropagation()}>
        <div className="country-search">
          <input placeholder={withCodes ? "Search country" : "Search"} value={query} onChange={(event) => setQuery(event.target.value)} />
          <Search size={26} />
        </div>
        <div className="modal-title">{title}</div>
        <div className="country-list">
          {results.map((country) => (
            <button key={`${country.name}-${country.code}`} onClick={() => onPick(country)}>
              <Flag country={country} />
              <strong>{country.name}</strong>
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

function VerifyModal({ user, selected, setSelected, onProceed, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="verify-modal" onClick={(event) => event.stopPropagation()}>
        <h2>Choose activation method</h2>
        <button
          className={`verify-option ${selected === "mobile" ? "selected" : ""}`}
          onClick={() => setSelected("mobile")}
        >
          <span className="radio" />
          <div>
            <strong>Mobile (WhatsApp)</strong>
            <p>
              {user.phoneCode} {user.phone}
            </p>
          </div>
        </button>
        <button
          className={`verify-option ${selected === "email" ? "selected" : ""}`}
          onClick={() => setSelected("email")}
        >
          <span className="radio" />
          <div>
            <strong>E-Mail</strong>
            <p>{user.email}</p>
          </div>
        </button>
        <button className="primary-button" onClick={onProceed}>
          Verify & Proceed
        </button>
      </div>
    </div>
  );
}

function AccountPrompt({ onCreate, onLogin, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="account-prompt" onClick={(event) => event.stopPropagation()}>
        <span className="drag-handle" />
        <div className="prompt-icon">
          <LockKeyhole size={34} />
        </div>
        <h2>Create an account to save your follows</h2>
        <p>Your following list belongs to your account, so it stays separate from guest browsing.</p>
        <button className="primary-button" onClick={onCreate}>
          <UserRoundPlus size={20} /> Create account
        </button>
        <button className="outline-button" onClick={onLogin}>
          <DoorOpen size={20} /> Sign in
        </button>
        <button className="ghost-link" onClick={onClose}>
          Continue browsing
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
