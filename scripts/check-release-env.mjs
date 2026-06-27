const target = process.argv[2] || "release";

const missing = [];

function requireVar(name) {
  if (!process.env[name] || !String(process.env[name]).trim()) {
    missing.push(name);
  }
}

if (target === "android") {
  requireVar("VITE_API_BASE_URL");
  requireVar("ANDROID_KEYSTORE_PATH");
  requireVar("ANDROID_KEY_ALIAS");
  requireVar("ANDROID_KEYSTORE_PASSWORD");
  requireVar("ANDROID_KEY_PASSWORD");

  const apiBaseUrl = process.env.VITE_API_BASE_URL || "";
  if (apiBaseUrl && !apiBaseUrl.startsWith("https://")) {
    missing.push("VITE_API_BASE_URL must be an HTTPS URL");
  }
  if (/example\.com|your-production-api/i.test(apiBaseUrl)) {
    missing.push("VITE_API_BASE_URL must be your real production API URL, not the placeholder");
  }
}

if (missing.length) {
  console.error("Missing production release configuration:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`Release configuration for ${target} looks complete.`);
