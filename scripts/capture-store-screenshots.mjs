import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import WebSocket from "ws";

const root = process.cwd();
const outDir = path.join(root, "store-assets", "screenshots", "phone");
const appUrl = process.env.SCREENSHOT_URL || "http://127.0.0.1:5184/";
const port = Number(process.env.CHROME_DEBUG_PORT || 9231);

await fs.mkdir(outDir, { recursive: true });

function chromePath() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ];
  return candidates.find((candidate) => fsSync.existsSync(candidate));
}

async function connect() {
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target = tabs.find((tab) => tab.type === "page") || tabs[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  let id = 0;
  const pending = new Map();
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      const callbacks = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? callbacks.reject(new Error(JSON.stringify(msg.error))) : callbacks.resolve(msg.result);
    }
  });

  return {
    ws,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const nextId = ++id;
        pending.set(nextId, { resolve, reject });
        ws.send(JSON.stringify({ id: nextId, method, params }));
      });
    }
  };
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const chrome = chromePath();
  if (!chrome) {
    throw new Error("Chrome executable was not found.");
  }

  const profile = path.join(os.tmpdir(), `shrine-screenshot-${Date.now()}`);
  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank"
    ],
    { stdio: "ignore", detached: false }
  );

  try {
    await wait(1800);
    const cdp = await connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 432,
      height: 768,
      deviceScaleFactor: 2.5,
      mobile: true
    });
    await cdp.send("Page.navigate", { url: appUrl });
    await wait(1000);

    const seededState = {
      currentUser: {
        id: "store-user",
        firstName: "Boda",
        surname: "Mohamed",
        email: "release@example.com",
        country: "Egypt",
        phoneCode: "+20",
        phone: "1234567890",
        language: "EN"
      },
      users: [],
      people: [
        {
          id: "person-1",
          fullName: "Omar Salem",
          surnameCheck: "Salem",
          birthDate: "1961-08-14",
          deathDate: "2024-03-10",
          age: "62",
          gender: "Male",
          country: "Egypt",
          info: "A respectful memorial profile with searchable personal information.",
          createdBy: "store-user"
        }
      ],
      following: ["person-1"],
      blocked: [],
      language: "EN",
      homeFilter: "Sponsor",
      guest: false,
      currentCountry: "Egypt"
    };

    await cdp.send("Runtime.evaluate", {
      expression: `localStorage.setItem('shrine_mobile_state_v1', ${JSON.stringify(JSON.stringify(seededState))}); location.reload();`
    });
    await wait(4100);

    async function screenshot(name) {
      const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false
      });
      await fs.writeFile(path.join(outDir, name), Buffer.from(result.data, "base64"));
    }

    async function clickBottomNav(index) {
      const expression = `document.querySelectorAll('.bottom-nav button')[${index}]?.click()`;
      await cdp.send("Runtime.evaluate", { expression });
      await wait(700);
    }

    await screenshot("01-home.png");
    await clickBottomNav(1);
    await screenshot("02-add.png");
    await clickBottomNav(2);
    await cdp.send("Runtime.evaluate", {
      expression: `
        const input = document.querySelector('.search-box input');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Omar');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      `
    });
    await wait(500);
    await screenshot("03-search.png");
    await cdp.send("Runtime.evaluate", { expression: "location.reload()" });
    await wait(4100);
    await clickBottomNav(3);
    await screenshot("04-settings.png");
    cdp.ws.close();
  } finally {
    child.kill();
    await wait(900);
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
