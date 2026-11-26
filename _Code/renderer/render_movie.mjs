import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "./node_modules/playwright/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = "/Users/khushagrarawal/Desktop/VIDEO_math";
const RENDERER_DIR = path.join(ROOT_DIR, "project/renderer");
const KEYFRAME_DIR = path.join(ROOT_DIR, "review/keyframes");
const SEG_DIR = path.join(ROOT_DIR, "project/segments");

const FPS = 30;
const TOTAL_FRAMES = 9415; // 313.833333s @ 30fps
const TOTAL_SEGS = 24; // ~393 frames (~18s) per fresh browser instance for 100% stability

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
};

let activeFfmpeg = null;

function startStaticServer(dir) {
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
              activeFfmpeg.stdin.once("drain", () => {
                res.writeHead(200);
                res.end("ok");
              });
              return;
            }
          }
          res.writeHead(200);
          res.end("ok");
        });
        return;
      }

      const cleanUrl = (req.url || "/").split("?")[0];
      const rel = cleanUrl === "/" ? "/index.html" : cleanUrl;
      const fullPath = path.join(dir, rel);
      if (!fullPath.startsWith(dir) || !fs.existsSync(fullPath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(fullPath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

async function launchBrowser() {
  return chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
}

async function ensureDomCaptured(page) {
  const pendingKey = await page.evaluate(() => window.getPendingDomCapture());
  if (pendingKey) {
    // Hide WebGL & HUD canvases during DOM capture so the cached overlay is pure transparent PNG of #math-dom only
    await page.evaluate(() => {
      document.getElementById("gl-canvas").style.visibility = "hidden";
      document.getElementById("hud-canvas").style.visibility = "hidden";
    });
    const buf = await page.locator("#math-dom").screenshot({ type: "png", omitBackground: true });
    await page.evaluate(() => {
      document.getElementById("gl-canvas").style.visibility = "visible";
      document.getElementById("hud-canvas").style.visibility = "visible";
    });
    const b64 = "data:image/png;base64," + buf.toString("base64");
    await page.evaluate(([k, u]) => window.registerDomImage(k, u), [pendingKey, b64]);
  }
}

async function renderKeyframes(url) {
  fs.mkdirSync(KEYFRAME_DIR, { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", (err) => console.error("PAGEERROR:", err));
  await page.goto(url, { waitUntil: "networkidle" });

  const checks = [
    ["kf01_title_flat_map", 4.0],
    ["kf02_dot_pip", 8.0],
    ["kf03_directions_probe", 22.0],
    ["kf04_function_pillars", 50.0],
    ["kf05_3d_lift_hills", 58.0],
    ["kf06_glass_slice", 78.0],
    ["kf07_nadir_contour", 89.5],
    ["kf08_bowl_equation", 119.5],
    ["kf09_center_1_neg2", 141.8],
    ["kf10_three_rings", 183.5],
    ["kf11_radius_vs_c_mistake", 196.2],
    ["kf12_c_zero_point", 204.2],
    ["kf13_c_negative_empty", 209.2],
    ["kf14_partial_derivatives", 243.5],
    ["kf15_saddle_trap", 256.5],
    ["kf16_squares_proof_global", 282.5],
    ["kf17_summary_triad", 307.0],
    ["kf18_end_card", 312.5],
  ];

  for (const [name, t] of checks) {
    await page.evaluate((sec) => window.renderAtTime(sec), t);
    await ensureDomCaptured(page);
    const dataUrl = await page.evaluate(() => {
      window.compositeAndGetRGBA();
      return document.getElementById("comp-canvas").toDataURL("image/png");
    });
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(path.join(KEYFRAME_DIR, `${name}.png`), Buffer.from(b64, "base64"));
    console.log(`Rendered ${name} (t=${t}s)`);
  }
  await browser.close();
}

async function renderSingleSegment(url, segIdx) {
  fs.mkdirSync(SEG_DIR, { recursive: true });
  const chunk = Math.ceil(TOTAL_FRAMES / TOTAL_SEGS);
  const startFrame = segIdx * chunk;
  const endFrame = Math.min(TOTAL_FRAMES, (segIdx + 1) * chunk);
  const outPath = path.join(SEG_DIR, `seg_${String(segIdx).padStart(2, "0")}.mp4`);

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", (e) => console.error(`[Seg ${segIdx}] pageerror:`, e));
  await page.goto(url, { waitUntil: "networkidle" });

  const ff = spawn("ffmpeg", [
    "-y",
    "-f", "image2pipe",
    "-vcodec", "mjpeg",
    "-framerate", String(FPS),
    "-i", "-",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "15",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    outPath,
  ], { stdio: ["pipe", "ignore", "pipe"] });
  activeFfmpeg = ff;

  let errLog = "";
  ff.stderr.on("data", (d) => { errLog += d.toString(); });
  const ffDone = new Promise((resolve, reject) => {
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg seg ${segIdx} exited ${code}: ${errLog.slice(-500)}`));
    });
  });

  const tStart = Date.now();
  for (let f = startFrame; f < endFrame; f++) {
    await page.evaluate((s) => window.renderAtTime(s), f / FPS);
    await ensureDomCaptured(page);
    await page.evaluate(() => window.compositeAndSend());
    if ((f - startFrame) % 300 === 0 && f > startFrame) {
      const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`[Seg ${segIdx}] frame ${f}/${endFrame} (${elapsed}s)`);
    }
  }

  ff.stdin.end();
  await ffDone;
  await browser.close();
  console.log(`[Seg ${segIdx}] Complete (${((Date.now() - tStart) / 1000).toFixed(1)}s) -> ${outPath}`);
}

function runChildSeg(segIdx, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, "--seg", String(segIdx)], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) resolve();
      else reject(new Error(`seg ${segIdx} exit ${code}`));
    });
  });
}

async function renderFullOrchestrator() {
  fs.mkdirSync(SEG_DIR, { recursive: true });
  const segPaths = [];
  for (let i = 0; i < TOTAL_SEGS; i++) {
    segPaths.push(path.join(SEG_DIR, `seg_${String(i).padStart(2, "0")}.mp4`));
  }

  // Run sequentially (1 Metal Chrome at a time, ~18s per chunk, auto-retry on transient GPU hiccup)
  for (let i = 0; i < TOTAL_SEGS; i++) {
    const outPath = segPaths[i];
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 50000) {
      console.log(`Skipping completed segment ${i}/${TOTAL_SEGS - 1}`);
      continue;
    }
    let ok = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Rendering segment ${i}/${TOTAL_SEGS - 1} (attempt ${attempt})...`);
        await runChildSeg(i, outPath);
        ok = true;
        break;
      } catch (err) {
        console.error(`Segment ${i} attempt ${attempt} failed:`, err.message);
      }
    }
    if (!ok) throw new Error(`Segment ${i} failed after 3 attempts`);
  }

  const concatFile = path.join(SEG_DIR, "concat.txt");
  fs.writeFileSync(concatFile, segPaths.map((p) => `file '${p}'`).join("\n") + "\n");

  const outMaster = path.join(ROOT_DIR, "project/video_master_silent.mp4");
  await new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", outMaster
    ], { stdio: "inherit" });
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`concat exit ${code}`))));
  });
  console.log("Rendered full silent master:", outMaster);
}

const mode = process.argv[2] || "--keyframes";
if (mode === "--full") {
  await renderFullOrchestrator();
} else {
  const { server, url } = await startStaticServer(RENDERER_DIR);
  try {
    if (mode === "--seg") {
      const segIdx = parseInt(process.argv[3], 10);
      await renderSingleSegment(url, segIdx);
    } else {
      await renderKeyframes(url);
    }
  } finally {
    server.close();
  }
}
