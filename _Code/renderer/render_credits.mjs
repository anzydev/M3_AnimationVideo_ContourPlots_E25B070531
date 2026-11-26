import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "./node_modules/playwright/index.mjs";

const ROOT_DIR = "/Users/khushagrarawal/Desktop/VIDEO_math";
const RENDERER_DIR = path.join(ROOT_DIR, "project/renderer");
const OUT_PREVIEW = path.join(ROOT_DIR, "review/credits_preview_3s.png");

const FPS = 30;
const CREDITS_FRAMES = 180; // 6.000 seconds silent end credits

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
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
      const rel = cleanUrl === "/" ? "/credits.html" : cleanUrl;
      const fullPath = path.join(dir, rel);
      if (!fullPath.startsWith(dir) || !fs.existsSync(fullPath)) {
        res.writeHead(404); res.end("Not found"); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fullPath)] || "application/octet-stream" });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/credits.html` }));
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

  await page.evaluate(() => {
    const c = document.getElementById("c");
    window.getCreditsBlob = async (t, type = "image/jpeg", q = 0.98) => {
      window.renderCreditsAtTime(t);
      return await new Promise((r) => c.toBlob(r, type, q));
    };
  });

  if (mode === "--preview") {
    const b64 = await page.evaluate(async () => {
      const blob = await window.getCreditsBlob(3.0, "image/png", 1.0);
      const buf = await blob.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    });
    fs.writeFileSync(OUT_PREVIEW, Buffer.from(b64, "base64"));
    console.log("Saved preview:", OUT_PREVIEW);
  } else {
    const outSilent = path.join(ROOT_DIR, "project/credits_silent.mp4");
    const ff = spawn("ffmpeg", [
      "-y", "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(FPS), "-i", "-",
      "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(FPS), outSilent,
    ], { stdio: ["pipe", "ignore", "pipe"] });
    activeFfmpeg = ff;
    const ffDone = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ff exit ${c}`)))));

    for (let f = 0; f < CREDITS_FRAMES; f++) {
      await page.evaluate(async (sec) => {
        const blob = await window.getCreditsBlob(sec, "image/jpeg", 0.98);
        await fetch("/frame", { method: "POST", body: await blob.arrayBuffer() });
      }, f / FPS);
    }
    ff.stdin.end();
    await ffDone;
    console.log("Rendered credits silent:", outSilent);
  }

  await browser.close();
  server.close();
}

await run(process.argv[2] || "--preview");

