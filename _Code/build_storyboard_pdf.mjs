import fs from "node:fs";
import path from "node:path";
import { chromium } from "./renderer/node_modules/playwright/index.mjs";

const ROOT = "/Users/khushagrarawal/Desktop/VIDEO_math";
const OUT_PDF = path.join(ROOT, "output/Storyboard.pdf");

function imgDataUri(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return "";
  return "data:image/png;base64," + fs.readFileSync(full).toString("base64");
}

const katexCss = fs.readFileSync(path.join(ROOT, "project/renderer/node_modules/katex/dist/katex.min.css"), "utf8");
const katexJs = fs.readFileSync(path.join(ROOT, "project/renderer/node_modules/katex/dist/katex.min.js"), "utf8");

const scenes = [
  {
    num: "1. Hook / Context",
    time: "00:00.00 – 00:51.83 (Intro 00:00–00:17.07 + Act I 00:17.07–00:51.83)",
    purpose: "Introduce the presenter, spark curiosity, and motivate why 2D maps fail without elevation.",
    visual: "Kinetic intro slide syncing word-by-word and letter-by-letter to URN E25B070531, transitioning onto a flat cartographic grid where silent explorer Pip probes left, right, forward, and backward while z = ??? remains hidden.",
    math: "Position $(x, y) \\in \\mathbb{R}^2$ without height $z$; probing $(\\pm\\Delta x, \\pm\\Delta y)$ cannot tell which direction goes downhill.",
    img: imgDataUri("review/intro_qa/seam_03.png"),
  },
  {
    num: "2. Concept Introduction",
    time: "00:51.83 – 01:26.57",
    purpose: "Define two-variable functions f(x,y) = z and introduce 3D height landscapes.",
    visual: "Input pairs (x, y) enter the function schematic and extrude elevation pillars across the map, then orthogonal X, Y, Z axes unfold as the grid lifts smoothly into 3D hills and valleys.",
    math: "$f: \\mathbb{R}^2 \\to \\mathbb{R},\\quad z = f(x, y)$ representing vertical elevation at each coordinate pair $(x, y)$.",
    img: imgDataUri("review/keyframes/kf05_3d_lift_hills.png"),
  },
  {
    num: "3. Visual Intuition",
    time: "01:26.57 – 02:04.87",
    purpose: "Build geometric understanding of how level curves encode a 3D surface on flat 2D paper.",
    visual: "A translucent horizontal glass plane z = c lowers slowly through the 3D terrain, illuminating equal-height intersection loops; the camera cranes straight overhead to project nested contour rings onto the 2D map.",
    math: "Horizontal slice $z = c$ intersected with $z = f(x, y)$ projects to the contour (level curve) $f(x, y) = c$.",
    img: imgDataUri("review/keyframes/kf07_nadir_contour.png"),
  },
  {
    num: "4. Worked Example",
    time: "02:04.87 – 03:50.97",
    purpose: "Walk step-by-step through an exact shifted paraboloid, its contours, and edge cases.",
    visual: "Terrain morphs into the paraboloid bowl. Blue and coral distance tapes locate shifted center (1, -2) vs. rejected (0, 0). Pip sweeps concentric circles for c = 1, 4, 9 (radii 1, 2, 3), contrasts against the r = c mistake, shrinks c = 0 to a point, and drops below z = 0 for c < 0.",
    math: "$f(x,y) = (x-1)^2 + (y+2)^2 = c \\implies$ circle at $(1,-2)$ with $r = \\sqrt{c}$: $(1,1), (4,2), (9,3)$; $c=0 \\Rightarrow \\{(1,-2)\\}$; $c \\lt 0 \\Rightarrow \\emptyset$.",
    img: imgDataUri("review/final_qa/final_02.png"),
  },
  {
    num: "5. Interpretation & Rigorous Proof",
    time: "03:50.97 – 05:04.47",
    purpose: "Connect partial derivatives to geometry, expose the saddle trap, and prove global optimality.",
    visual: "Orthogonal x- and y-slice tangent rods flatten at (1, -2). Surface morphs to saddle g(x, y) = x^2 - y^2 where grad g(0, 0) = 0 yet curves rise along x and fall along y. Returning to f, both nonnegative squares stack on the z = 0 floor and vanish at (1, -2), proving the unique global minimum.",
    math: "$\\frac{\\partial f}{\\partial x}=2(x-1)=0, \\frac{\\partial f}{\\partial y}=2(y+2)=0 \\Rightarrow \\nabla f(1,-2)=(0,0)$. Saddle $g(x,y)=x^2-y^2$. Proof: $(x-1)^2 \\ge 0,\\ (y+2)^2 \\ge 0 \\Rightarrow f(x,y) \\ge 0 = f(1,-2)$.",
    img: imgDataUri("review/final_qa/final_04.png"),
  },
  {
    num: "6. Summary & Credits",
    time: "05:04.47 – 05:36.90",
    purpose: "Reinforce the 3 core takeaways and declare all tools, audio, and AI assistance.",
    visual: "Aerial orbit over the 3D bowl and contour rings displays the 3-pillar summary (1. Discover, 2. Verify, 3. Prove), followed by the mathematical takeaway end card and a 6-second silent Credits & AI Transparency Disclosure slide.",
    math: "Discover via $f(x,y)=c$, verify via $\\nabla f(1,-2)=(0,0)$, and prove global minimum $0$ at $(1,-2)$ via sum of two squares $\\ge 0$.",
    img: imgDataUri("review/credits_final_check.png"),
  },
];

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${katexCss}
  @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #162032; font-size: 10.5pt; line-height: 1.42; }
  .header { border-bottom: 2.5px solid #162848; padding-bottom: 10px; margin-bottom: 12px; }
  .kicker { font-size: 8.5pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #0b6fa4; }
  h1 { font-size: 18pt; margin: 3px 0 4px; color: #0c172b; }
  .meta { font-size: 9.5pt; color: #43546f; }
  .objective { background: #f0f6fc; border-left: 4px solid #0b6fa4; padding: 9px 12px; border-radius: 4px; margin-bottom: 14px; }
  .objective strong { color: #0c172b; }
  .scene { border: 1px solid #cbd7e6; border-radius: 8px; padding: 10px 12px; margin-bottom: 11px; page-break-inside: avoid; display: grid; grid-template-columns: 1fr 200px; gap: 12px; align-items: center; background: #ffffff; }
  .scene-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; border-bottom: 1px solid #e6edf5; padding-bottom: 4px; }
  .scene-title { font-weight: 700; font-size: 11.5pt; color: #0f294a; }
  .scene-time { font-size: 8.5pt; color: #5b6d88; font-weight: 600; }
  .row { margin-bottom: 4px; font-size: 9.5pt; }
  .lbl { font-weight: 700; color: #1c3d66; }
  img.thumb { width: 200px; height: 112.5px; object-fit: cover; border-radius: 5px; border: 1px solid #b8c7dc; }
  .footer { margin-top: 8px; font-size: 8.5pt; color: #5b6d88; text-align: center; }
</style>
<script>${katexJs}</script>
</head>
<body>
  <div class="header">
    <div class="kicker">Linear Algebra and Calculus (M3) • Internal Assessment Storyboard</div>
    <h1>The Lowest Point — Contour Plots: Finding the Global Minimum</h1>
    <div class="meta"><b>Student:</b> Khushagra Rawal &nbsp;|&nbsp; <b>URN:</b> E25B070531 &nbsp;|&nbsp; <b>Batch:</b> Hopper-Debugger &nbsp;|&nbsp; <b>Total Duration:</b> 5m 36.9s (1080p, 30 fps)</div>
  </div>

  <div class="objective">
    <strong>Learning Objective:</strong> By the end of this video, the viewer will be able to interpret 2D contour plots as horizontal slices of a 3D surface $z = f(x, y)$, compute exact shifted circular level sets $(x-1)^2 + (y+2)^2 = c$ with radii $r = \\sqrt{c}$, explain why a zero gradient alone can be a saddle rather than a minimum, and prove a unique global minimum using nonnegative squares.
  </div>

  ${scenes.map(s => `
    <div class="scene">
      <div>
        <div class="scene-head">
          <div class="scene-title">${s.num}</div>
          <div class="scene-time">${s.time}</div>
        </div>
        <div class="row"><span class="lbl">Purpose:</span> ${s.purpose}</div>
        <div class="row"><span class="lbl">Visual &amp; Narration:</span> ${s.visual}</div>
        <div class="row"><span class="lbl">Key Math:</span> ${s.math}</div>
      </div>
      <img class="thumb" src="${s.img}" />
    </div>
  `).join("")}

  <div class="footer">
    Sources &amp; Tools: Human narration by Khushagra Rawal; WebGL2/Three.js, KaTeX, HTML5 Canvas2D, Playwright/Chrome, faster-whisper, Python/SciPy, FFmpeg, and Antigravity (Google DeepMind) AI coding/animation assistance.
  </div>

  <script>
    // Render inline $...$ with KaTeX
    document.body.innerHTML = document.body.innerHTML.replace(/\\$([^$]+)\\$/g, (_, tex) => {
      try { return katex.renderToString(tex, { throwOnError: false }); }
      catch { return tex; }
    });
  </script>
</body>
</html>`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
await page.pdf({ path: OUT_PDF, format: "A4", printBackground: true });
await browser.close();
console.log("Generated Storyboard PDF:", OUT_PDF, "bytes:", fs.statSync(OUT_PDF).size);
