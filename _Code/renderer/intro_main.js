const bgCanvas = document.getElementById("bg-canvas");
const bgCtx = bgCanvas.getContext("2d");
const fgCanvas = document.getElementById("fg-canvas");
const ctx = fgCanvas.getContext("2d");

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const c = clamp(t); return c * c * (3 - 2 * c); };
const spring = (t) => {
  const c = clamp(t);
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return 1 - Math.exp(-7 * c) * Math.cos(10 * c);
};

// Exact RMS-verified spoken events (seconds)
const URN_CHARS = [
  { ch: "E", t: 8.38 },
  { ch: "2", t: 8.86 },
  { ch: "5", t: 9.18 },
  { ch: "B", t: 9.56 },
  { ch: "0", t: 9.94 },
  { ch: "7", t: 10.76 },
  { ch: "0", t: 11.22 },
  { ch: "5", t: 11.76 },
  { ch: "3", t: 12.28 },
  { ch: "1", t: 12.94 },
];

function drawRoundedBox(c, x, y, w, h, r, fill, stroke, lw = 2) {
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  c.restore();
}

// Draw silent Pip character waving cheerfully in 2D vector style matching the 3D Pip design
function drawPip2D(c, cx, cy, t, waveAmp) {
  c.save();
  const bob = Math.sin(t * 3.5) * 4;
  c.translate(cx, cy + bob);

  // Ground glow ring
  c.strokeStyle = "rgba(98, 242, 255, 0.55)";
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(0, 68, 42, 12, 0, 0, Math.PI * 2);
  c.stroke();

  // Legs
  c.fillStyle = "#1a263b";
  c.beginPath(); c.roundRect(-18, 32, 12, 34, 6); c.fill();
  c.beginPath(); c.roundRect(6, 32, 12, 34, 6); c.fill();

  // Left arm (resting) & Right arm (waving)
  c.fillStyle = "#e6a832";
  c.save(); c.translate(-30, -8); c.rotate(0.22);
  c.beginPath(); c.roundRect(-6, 0, 12, 34, 6); c.fill();
  c.restore();

  c.save(); c.translate(30, -8);
  const waveAng = -2.2 + Math.sin(t * 9.0) * 0.35 * waveAmp;
  c.rotate(waveAmp > 0.05 ? waveAng : -0.22);
  c.beginPath(); c.roundRect(-6, 0, 12, 36, 6); c.fill();
  c.restore();

  // Torso
  c.fillStyle = "#f0f4fa";
  c.beginPath(); c.roundRect(-26, -16, 52, 54, 24); c.fill();

  // Teal collar
  c.fillStyle = "#2ec4b6";
  c.beginPath(); c.roundRect(-28, -22, 56, 12, 6); c.fill();

  // Head
  c.fillStyle = "#f0f4fa";
  c.beginPath(); c.ellipse(0, -48, 30, 27, 0, 0, Math.PI * 2); c.fill();

  // Visor
  c.fillStyle = "#162238";
  c.beginPath(); c.roundRect(-21, -61, 42, 24, 12); c.fill();

  // Glowing blinking eyes
  const blink = (t % 3.6 > 3.45) ? 0.2 : 1.0;
  c.fillStyle = "#62f2ff";
  c.beginPath(); c.ellipse(-9, -49, 5, 5.5 * blink, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(9, -49, 5, 5.5 * blink, 0, 0, Math.PI * 2); c.fill();

  // Antenna
  c.strokeStyle = "#e6a832"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, -75); c.lineTo(0, -94); c.stroke();
  c.fillStyle = "#ffd166";
  c.beginPath(); c.arc(0, -98, 6, 0, Math.PI * 2); c.fill();

  c.restore();
}

window.renderIntroAtTime = function (t) {
  // 1. Background: Deep indigo observatory grid + drifting contour rings matching main film
  bgCtx.clearRect(0, 0, 1920, 1080);
  const bgGrad = bgCtx.createRadialGradient(960, 500, 80, 960, 540, 1200);
  bgGrad.addColorStop(0, "#132240");
  bgGrad.addColorStop(1, "#060b16");
  bgCtx.fillStyle = bgGrad;
  bgCtx.fillRect(0, 0, 1920, 1080);

  // Subtle blueprint grid with gentle pan
  const gxOff = (t * 14) % 80;
  bgCtx.strokeStyle = "rgba(110, 195, 255, 0.08)";
  bgCtx.lineWidth = 1;
  for (let x = -80 + gxOff; x < 1920; x += 80) {
    bgCtx.beginPath(); bgCtx.moveTo(x, 0); bgCtx.lineTo(x, 1080); bgCtx.stroke();
  }
  for (let y = 0; y < 1080; y += 80) {
    bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(1920, y); bgCtx.stroke();
  }

  // Animated concentric contour rings centered subtly on right-bottom backdrop
  const cx = 1480, cy = 580;
  for (let i = 1; i <= 7; i++) {
    const r = i * 85 + Math.sin(t * 0.9 + i * 0.6) * 8;
    const op = Math.max(0.04, 0.22 - i * 0.024);
    bgCtx.strokeStyle = i % 2 === 0 ? `rgba(82, 214, 255, ${op})` : `rgba(255, 209, 102, ${op * 0.85})`;
    bgCtx.lineWidth = i === 3 ? 2.5 : 1.5;
    bgCtx.beginPath();
    bgCtx.ellipse(cx, cy, r * 1.15, r * 0.85, -0.18, 0, Math.PI * 2);
    bgCtx.stroke();
  }

  // 2. Foreground kinetic slide synchronized to speech
  ctx.clearRect(0, 0, 1920, 1080);

  // Fade out smoothly in the final 0.35s into the main video
  const endFade = t > 16.65 ? 1 - smooth((t - 16.65) / 0.40) : 1.0;
  ctx.save();
  ctx.globalAlpha = endFade;

  // Main sleek glass presentation frame
  drawRoundedBox(ctx, 110, 96, 1700, 888, 28, "rgba(9, 16, 30, 0.78)", "rgba(110, 215, 255, 0.26)", 2);

  // Pip character standing cleanly on right side
  const pipEnter = spring((t - 0.35) / 0.65);
  const waveAmp = t < 3.6 ? smooth((t - 0.5) / 0.3) : (t > 13.8 ? smooth((t - 13.8) / 0.5) : 0.1);
  if (pipEnter > 0.01) {
    ctx.save();
    ctx.translate(1540, 420 + (1 - pipEnter) * 40);
    ctx.scale(1.45 * pipEnter, 1.45 * pipEnter);
    drawPip2D(ctx, 0, 0, t, waveAmp);
    ctx.restore();
  }

  // Word-by-word: "Hello everyone" (0.58s, 0.88s)
  const pHello = smooth((t - 0.54) / 0.28);
  const pEveryone = smooth((t - 0.86) / 0.28);
  if (pHello > 0.01) {
    ctx.save();
    ctx.font = "700 28px -apple-system, sans-serif";
    ctx.fillStyle = `rgba(98, 242, 255, ${pHello})`;
    ctx.fillText("HELLO", 180, 185 - (1 - pHello) * 14);
    if (pEveryone > 0.01) {
      const wHello = ctx.measureText("HELLO ").width;
      ctx.fillStyle = `rgba(255, 209, 102, ${pEveryone})`;
      ctx.fillText("EVERYONE", 180 + wHello, 185 - (1 - pEveryone) * 14);
    }
    ctx.restore();
  }

  // "Myself" (1.66s) + "Khushagra" (2.46s) + "Rawal" (2.90s)
  const pMyself = smooth((t - 1.62) / 0.25);
  const pFirst = spring((t - 2.42) / 0.42);
  const pLast = spring((t - 2.86) / 0.42);
  if (pMyself > 0.01) {
    ctx.save();
    ctx.font = "600 22px -apple-system, sans-serif";
    ctx.fillStyle = `rgba(158, 197, 248, ${pMyself})`;
    ctx.fillText("PRESENTED BY", 180, 248);
    ctx.restore();
  }
  if (pFirst > 0.01) {
    ctx.save();
    ctx.font = "800 76px -apple-system, sans-serif";
    ctx.fillStyle = `rgba(255, 255, 255, ${clamp(pFirst)})`;
    ctx.fillText("Khushagra", 180, 328 + (1 - pFirst) * 18);
    if (pLast > 0.01) {
      const wFirst = ctx.measureText("Khushagra ").width;
      ctx.fillStyle = `rgba(255, 255, 255, ${clamp(pLast)})`;
      ctx.fillText("Rawal", 180 + wFirst, 328 + (1 - pLast) * 18);
    }
    ctx.restore();
  }

  // "I belong to" (3.78s) + "Hopper" (5.06s) + "Debugger" (5.64s) + "Batch" (6.24s)
  const pBelong = smooth((t - 3.76) / 0.30);
  const pHop = spring((t - 5.04) / 0.35);
  const pDeb = spring((t - 5.62) / 0.35);
  const pBat = spring((t - 6.22) / 0.35);
  if (pBelong > 0.01) {
    ctx.save();
    ctx.font = "600 22px -apple-system, sans-serif";
    ctx.fillStyle = `rgba(158, 197, 248, ${pBelong})`;
    ctx.fillText("BATCH", 180, 412);
    ctx.restore();
  }
  const batchWords = [
    { txt: "Hopper", p: pHop, x: 180, w: 170, col: "#52d6ff" },
    { txt: "Debugger", p: pDeb, x: 366, w: 210, col: "#48f0a8" },
    { txt: "Batch", p: pBat, x: 592, w: 145, col: "#ffd166" },
  ];
  for (const bw of batchWords) {
    if (bw.p <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = clamp(bw.p) * endFade;
    const sc = 0.85 + 0.15 * bw.p;
    ctx.translate(bw.x + bw.w / 2, 462);
    ctx.scale(sc, sc);
    drawRoundedBox(ctx, -bw.w / 2, -30, bw.w, 60, 14, "rgba(18, 32, 58, 0.92)", bw.col, 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 30px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(bw.txt, 0, 2);
    ctx.restore();
  }

  // "My URN is" (7.10s) + LETTER-BY-LETTER URN TILES: E 2 5 B 0 7 0 5 3 1
  const pUrnLbl = smooth((t - 7.08) / 0.30);
  if (pUrnLbl > 0.01) {
    ctx.save();
    ctx.font = "600 22px -apple-system, sans-serif";
    ctx.fillStyle = `rgba(255, 209, 102, ${pUrnLbl})`;
    ctx.fillText("UNIVERSITY ROLL NUMBER (URN)", 180, 566);
    ctx.restore();
  }

  for (let i = 0; i < URN_CHARS.length; i++) {
    const item = URN_CHARS[i];
    const dt = t - item.t;
    if (dt < -0.02) continue;
    const p = spring(dt / 0.30);
    const pulse = Math.exp(-Math.max(0, dt) * 4.5); // bright flash right on the spoken letter!
    const tileX = 180 + i * 96;
    const tileY = 635;
    ctx.save();
    ctx.globalAlpha = clamp(p) * endFade;
    const sc = 0.72 + 0.28 * p + 0.08 * pulse;
    ctx.translate(tileX + 41, tileY);
    ctx.scale(sc, sc);

    const fill = pulse > 0.25 ? "rgba(255, 209, 102, 0.24)" : "rgba(16, 28, 52, 0.94)";
    const stroke = pulse > 0.25 ? "#ffd166" : "rgba(98, 242, 255, 0.65)";
    if (pulse > 0.1) {
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 24 * pulse;
    }
    drawRoundedBox(ctx, -41, -46, 82, 92, 16, fill, stroke, pulse > 0.25 ? 3 : 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = pulse > 0.3 ? "#ffd166" : "#ffffff";
    ctx.font = "800 46px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.ch, 0, 3);
    ctx.restore();
  }

  // "and I would like to present you" (13.70s) + "my maths project" (15.42s)
  const pPres = smooth((t - 13.68) / 0.35);
  const pProj = spring((t - 15.42) / 0.45);
  if (pPres > 0.01) {
    ctx.save();
    ctx.font = "600 26px -apple-system, sans-serif";
    ctx.fillStyle = `rgba(199, 214, 236, ${pPres})`;
    ctx.fillText("Presenting...", 180, 754);
    ctx.restore();
  }
  if (pProj > 0.01) {
    ctx.save();
    ctx.globalAlpha = clamp(pProj) * endFade;
    const yOff = (1 - pProj) * 20;
    drawRoundedBox(ctx, 180, 782 + yOff, 1520, 128, 20, "rgba(24, 21, 14, 0.90)", "rgba(255, 209, 102, 0.65)", 2.2);
    ctx.fillStyle = "#ffd166";
    ctx.font = "700 18px -apple-system, sans-serif";
    ctx.fillText("MATHEMATICS PROJECT", 216, 822 + yOff);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 42px -apple-system, sans-serif";
    ctx.fillText("The Lowest Point — Contour Plots: Finding the Global Minimum", 216, 874 + yOff);
    ctx.restore();
  }

  ctx.restore();
};

window.renderIntroAtTime(0.0);

