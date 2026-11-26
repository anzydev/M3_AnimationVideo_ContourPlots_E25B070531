const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { const c = clamp(t); return c * c * (3 - 2 * c); };

function drawRoundedBox(c, x, y, w, h, r, fill, stroke, lw = 2) {
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  c.restore();
}

function wrapText(c, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (c.measureText(test).width > maxW && line) {
      c.fillText(line, x, cy);
      line = words[i];
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) c.fillText(line, x, cy);
}

window.renderCreditsAtTime = function (t) {
  // Duration: 6.0s (t = 0 .. 6.0s), completely silent
  ctx.clearRect(0, 0, 1920, 1080);

  // Background observatory gradient + subtle drifting grid & contour rings
  const grad = ctx.createRadialGradient(960, 500, 100, 960, 540, 1220);
  grad.addColorStop(0, "#12203c");
  grad.addColorStop(1, "#050a14");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1920, 1080);

  const gx = (t * 10) % 80;
  ctx.strokeStyle = "rgba(110, 195, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let x = -80 + gx; x < 1920; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke();
  }
  for (let y = 0; y < 1080; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1920, y); ctx.stroke();
  }

  for (let i = 1; i <= 6; i++) {
    const r = i * 125 + Math.sin(t * 0.8 + i) * 6;
    ctx.strokeStyle = i % 2 === 0 ? "rgba(82, 214, 255, 0.08)" : "rgba(255, 209, 102, 0.06)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(960, 540, r * 1.35, r * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Smooth fade-in (0.0 -> 0.55s) and gentle fade-out at very end (5.45 -> 6.0s)
  const masterAlpha = smooth(t / 0.55) * (1 - smooth((t - 5.45) / 0.55));
  ctx.save();
  ctx.globalAlpha = masterAlpha;

  // Header
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd166";
  ctx.font = "700 18px -apple-system, sans-serif";
  ctx.fillText("CREDITS, TOOLS & AI TRANSPARENCY DISCLOSURE", 960, 94);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 44px -apple-system, sans-serif";
  ctx.fillText("The Lowest Point — Contour Plots: Finding the Global Minimum", 960, 146);

  ctx.fillStyle = "#9ec5f8";
  ctx.font = "500 21px -apple-system, sans-serif";
  ctx.fillText("Khushagra Rawal  •  URN: E25B070531  •  Batch: Hopper-Debugger", 960, 186);

  // 2x2 Grid of crisp credit cards
  const cards = [
    {
      x: 130, y: 232, w: 805, h: 315,
      border: "rgba(255, 209, 102, 0.55)",
      eyebrow: "HUMAN VOICEOVER & STORY",
      eyebrowCol: "#ffd166",
      title: "Khushagra Rawal (Authentic Human Recording)",
      body: "All spoken narration across the Intro and Main film is 100% the student's real recorded voice (INTRO.mp4 & voiceover_master.m4a). Zero AI voice cloning, zero text-to-speech, and zero character dialogue were used.",
      delay: 0.15,
    },
    {
      x: 985, y: 232, w: 805, h: 315,
      border: "rgba(98, 242, 255, 0.58)",
      eyebrow: "AI CODING & ANIMATION ASSISTANT",
      eyebrowCol: "#62f2ff",
      title: "Antigravity (Google DeepMind)",
      body: "Used for speech-to-timestamp alignment, discrepancy auditing, storyboard synchronization, 3D WebGL/GLSL shader authoring, silent Pip character rigging, kinetic intro & credits rendering, procedural audio mixing, and QA.",
      delay: 0.28,
    },
    {
      x: 130, y: 575, w: 805, h: 325,
      border: "rgba(72, 240, 168, 0.52)",
      eyebrow: "3D GRAPHICS, MATH & RENDERING STACK",
      eyebrowCol: "#48f0a8",
      title: "Three.js  •  KaTeX  •  Canvas2D  •  Playwright / Chrome",
      body: "Three.js (MIT) for real-time 3D paraboloid, saddle & terrain meshes with custom GLSL contour shaders; KaTeX (MIT) for mathematical typesetting; HTML5 Canvas2D for HUD overlays & Pip 2D intro; Playwright + Headless Chrome (Metal WebGL2) at native 1920×1080 @ 30fps.",
      delay: 0.40,
    },
    {
      x: 985, y: 575, w: 805, h: 325,
      border: "rgba(158, 197, 248, 0.48)",
      eyebrow: "SPEECH ALIGNMENT, AUDIO & VIDEO PIPELINE",
      eyebrowCol: "#9ec5f8",
      title: "faster-whisper  •  Python / SciPy  •  FFmpeg",
      body: "faster-whisper (small.en, MIT) & 20 ms RMS envelope analysis for exact word and URN-letter alignment; Python, NumPy, SciPy & SoundFile for original speech-ducked D-major ambient pad & chimes; FFmpeg (LGPL/GPL) for lossless muxing, concatenation & QA.",
      delay: 0.52,
    },
  ];

  ctx.textAlign = "left";
  for (const cd of cards) {
    const p = smooth((t - cd.delay) / 0.45);
    const dy = (1 - p) * 18;
    ctx.save();
    ctx.globalAlpha = masterAlpha * p;
    drawRoundedBox(ctx, cd.x, cd.y + dy, cd.w, cd.h, 20, "rgba(10, 18, 34, 0.88)", cd.border, 1.8);

    ctx.fillStyle = cd.eyebrowCol;
    ctx.font = "700 15px -apple-system, sans-serif";
    ctx.fillText(cd.eyebrow, cd.x + 30, cd.y + 42 + dy);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 26px -apple-system, sans-serif";
    ctx.fillText(cd.title, cd.x + 30, cd.y + 84 + dy);

    ctx.fillStyle = "#c9d9ef";
    ctx.font = "400 20px -apple-system, sans-serif";
    wrapText(ctx, cd.body, cd.x + 30, cd.y + 132 + dy, cd.w - 60, 32);
    ctx.restore();
  }

  // Footer note
  ctx.textAlign = "center";
  ctx.fillStyle = "#8fa7c8";
  ctx.font = "500 18px -apple-system, sans-serif";
  ctx.fillText("All visual worlds, character rigs, shaders, and ambient sound effects are original creations for this project. No copyrighted third-party media used.", 960, 968);

  ctx.restore();
};

window.renderCreditsAtTime(0.0);

