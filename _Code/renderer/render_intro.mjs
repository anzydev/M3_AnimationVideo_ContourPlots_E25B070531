import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "./node_modules/playwright/index.mjs";

const ROOT_DIR = "/Users/khushagrarawal/Desktop/VIDEO_math";
const RENDERER_DIR = path.join(ROOT_DIR, "project/renderer");
const INTRO_KF_DIR = path.join(ROOT_DIR, "review/intro_keyframes");

const FPS = 30;
const INTRO_FRAMES = 512; // 17.066667s matching INTRO.mp4 exact container duration

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
};

let activeFfmpeg = null;

function startServer(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/frame") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (activeFfmpeg && !activeFfmpeg.stdin.destroyed) {
            const ok = activeFfmpeg.stdin.write(buf);
            if (!ok) {
              activeFfmpeg.stdin.once("drain", () => { res.writeHead(200); res.end("ok"); });
              return;
            }
          }
          res.writeHead(200);
          res.end("ok");
        });
        return;
      }
      const cleanUrl = (req.url || "/").split("?")[0];
      const rel = cleanUrl === "/" ? "/intro.html" : cleanUrl;
      const fullPath = path.join(dir, rel);
      if (!fullPath.startsWith(dir) || !fs.existsSync(fullPath)) {
        res.writeHead(404); res.end("Not found"); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fullPath)] || "application/octet-stream" });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/intro.html` }));
  });
}

async function run(mode) {
  const { server, url } = await startServer(RENDERER_DIR);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url, { waitUntil: "networkidle" });

  // Add offscreen composite helper on page
  await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1920; c.height = 1080;
    const cx = c.getContext("2d");
    const bg = document.getElementById("bg-canvas");
    const fg = document.getElementById("fg-canvas");
    window.getIntroBlob = async (t, type = "image/jpeg", q = 0.98) => {
      window.renderIntroAtTime(t);
      cx.clearRect(0, 0, 1920, 1080);
      cx.drawImage(bg, 0, 0);
      cx.drawImage(fg, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, type, q));
      return blob;
    };
  });

  if (mode === "--keyframes") {
    fs.mkdirSync(INTRO_KF_DIR, { recursive: true });
    for (const t of [1.2, 6.4, 11.3, 16.3]) {
      const b64 = await page.evaluate(async (sec) => {
        const blob = await window.getIntroBlob(sec, "image/png", 1.0);
        const buf = await blob.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      }, t);
      fs.writeFileSync(path.join(INTRO_KF_DIR, `intro_${t}s.png`), Buffer.from(b64, "base64"));
      console.log("Saved intro keyframe:", t);
    }
  } else {
    const outSilent = path.join(ROOT_DIR, "project/intro_silent.mp4");
    const ff = spawn("ffmpeg", [
      "-y", "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(FPS), "-i", "-",
      "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(FPS), outSilent,
    ], { stdio: ["pipe", "ignore", "pipe"] });
    activeFfmpeg = ff;
    const ffDone = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ff exit ${c}`)))));

    for (let f = 0; f < INTRO_FRAMES; f++) {
      await page.evaluate(async (sec) => {
        const blob = await window.getIntroBlob(sec, "image/jpeg", 0.98);
        await fetch("/frame", { method: "POST", body: await blob.arrayBuffer() });
      }, f / FPS);
    }
    ff.stdin.end();
    await ffDone;
    console.log("Rendered intro silent:", outSilent);
  }

  await browser.close();
  server.close();
}

await run(process.argv[2] || "--keyframes");

