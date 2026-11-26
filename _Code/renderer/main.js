import { MathWorld, bowlZ, visualZ, Z_VIS_SCALE_BOWL } from "./math_world.js";

const glCanvas = document.getElementById("gl-canvas");
const hudCanvas = document.getElementById("hud-canvas");
const hudCtx = hudCanvas.getContext("2d");
const compCanvas = document.getElementById("comp-canvas");
const compCtx = compCanvas.getContext("2d", { willReadFrequently: true });
const mathDom = document.getElementById("math-dom");

const world = new MathWorld(glCanvas);

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
const rangeT = (t, t0, t1) => smooth((t - t0) / Math.max(1e-5, t1 - t0));

function texHTML(tex) {
  return window.katex.renderToString(tex, { throwOnError: false, displayMode: false });
}

function setCamera(pos, look, up = [0, 1, 0]) {
  world.camera.position.set(pos[0], pos[1], pos[2]);
  world.camera.up.set(up[0], up[1], up[2]);
  world.camera.lookAt(look[0], look[1], look[2]);
  world.camera.updateMatrixWorld(true);
}

function lerpVec(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Cache rendered #math-dom PNG bitmaps by key so Playwright only captures DOM when discrete formula layout changes (~30 times total!)
window._domCardCache = {};
let currentDomHtml = "";
let currentDomKey = "";
let currentDomAlpha = 1.0;

function setStaticCard(key, html, alpha = 1.0) {
  currentDomKey = key;
  currentDomAlpha = clamp(alpha);
  if (html !== currentDomHtml) {
    mathDom.innerHTML = html;
    currentDomHtml = html;
  }
}

window.getPendingDomCapture = function () {
  if (!currentDomKey || !currentDomHtml || window._domCardCache[currentDomKey]) return null;
  return currentDomKey;
};

window.registerDomImage = function (key, dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      window._domCardCache[key] = img;
      resolve(true);
    };
    img.src = dataUrl;
  });
};

window.compositeAndGetRGBA = function () {
  compCtx.clearRect(0, 0, 1920, 1080);
  compCtx.drawImage(glCanvas, 0, 0);
  compCtx.drawImage(hudCanvas, 0, 0);
  if (currentDomKey && window._domCardCache[currentDomKey] && currentDomAlpha > 0.005) {
    compCtx.save();
    compCtx.globalAlpha = currentDomAlpha;
    compCtx.drawImage(window._domCardCache[currentDomKey], 0, 0);
    compCtx.restore();
  }
  return compCtx.getImageData(0, 0, 1920, 1080).data;
};

window.compositeAndSend = async function () {
  compCtx.clearRect(0, 0, 1920, 1080);
  compCtx.drawImage(glCanvas, 0, 0);
  compCtx.drawImage(hudCanvas, 0, 0);
  if (currentDomKey && window._domCardCache[currentDomKey] && currentDomAlpha > 0.005) {
    compCtx.save();
    compCtx.globalAlpha = currentDomAlpha;
    compCtx.drawImage(window._domCardCache[currentDomKey], 0, 0);
    compCtx.restore();
  }
  const blob = await new Promise((r) => compCanvas.toBlob(r, "image/jpeg", 0.98));
  await fetch("/frame", { method: "POST", body: await blob.arrayBuffer() });
};

function drawRoundedBox(ctx, x, y, w, h, r, fill, stroke, lw = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}

function drawPillTag(ctx, x, y, text, borderColor = "rgba(110, 215, 255, 0.55)", textColor = "#f3f8ff", alpha = 1.0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "600 18px -apple-system, BlinkMacSystemFont, sans-serif";
  const tw = ctx.measureText(text).width;
  const w = tw + 28;
  const h = 36;
  ctx.shadowColor = "rgba(0,0,0,0.48)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  drawRoundedBox(ctx, x - w / 2, y - h / 2, w, h, 18, "rgba(9, 15, 28, 0.90)", borderColor, 1.6);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function drawArrow2D(ctx, x1, y1, x2, y2, color, lw = 4, head = 14) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
  ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

window.renderAtTime = function renderAtTime(t) {
  world.stars.rotation.y = t * 0.012;
  const blinkPhase = t % 4.1;
  const blink = (blinkPhase > 3.92 && blinkPhase < 4.06) ? 0.12 : 1.0;

  world.axesGroup.visible = false;
  world.glassGroup.visible = false;
  world.pillarsGroup.visible = false;
  world.centerBeacon.visible = false;
  world.originCross.visible = false;
  world.tapeX.visible = false;
  world.tapeY.visible = false;
  world.radiusBar.visible = false;
  world.mistakeRing.visible = false;
  world.xSliceCurve.visible = false;
  world.ySliceCurve.visible = false;
  world.tangentRodX.visible = false;
  world.tangentRodY.visible = false;
  world.saddleRiseLine.visible = false;
  world.saddleFallLine.visible = false;
  world.saddleFlatDisk.visible = false;
  world.surfUniforms.uSliceGlow.value = 0.0;
  world.surfUniforms.uContourAlpha.value = 0.0;
  world.surfUniforms.uSurfaceAlpha.value = 1.0;
  world.surfUniforms.uGridAlpha.value = 0.28;
  world.glassMat.color.setHex(0x62d9ff);
  world.glassFrameMat.color.setHex(0x7be8ff);
  for (const k of [1, 4, 9]) world.rings[k].group.visible = false;

  hudCtx.clearRect(0, 0, 1920, 1080);

  const vig = hudCtx.createRadialGradient(960, 540, 440, 960, 540, 1140);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(4,7,14,0.48)");
  hudCtx.fillStyle = vig;
  hudCtx.fillRect(0, 0, 1920, 1080);

  setStaticCard("", "", 0);

  // =========================================================================
  // ACT I (0.00 - 34.76): THE BLIND FLAT MAP
  // =========================================================================
  if (t < 34.76) {
    world.updateTerrain(0.0);
    const pan = Math.sin(t * 0.25) * 0.35;
    const camPos = [pan * 0.4, 11.2 - 0.6 * rangeT(t, 0, 10), 4.8 - 1.2 * rangeT(t, 6, 14)];
    setCamera(camPos, [0, 0, 0]);

    let px = 0, py = 0, yaw = 0, walkAmp = 0, walkPh = t * 11, armL = 0, armR = 0, headY = Math.sin(t * 1.4) * 0.35, headP = 0;
    let scale = smooth((t - 5.8) / 0.9) * 0.92;
    if (t < 5.8) scale = 0.001;

    if (t >= 19.8 && t < 24.8) {
      if (t < 21.8) {
        const u = rangeT(t, 20.6, 21.5);
        px = lerp(0, -1.6, u); yaw = -Math.PI / 2; walkAmp = Math.sin(u * Math.PI);
      } else if (t < 22.7) {
        const u = rangeT(t, 21.8, 22.5);
        px = lerp(-1.6, 1.5, u); yaw = Math.PI / 2; walkAmp = Math.sin(u * Math.PI);
      } else if (t < 23.6) {
        const u = rangeT(t, 22.65, 23.4);
        px = lerp(1.5, 0, u); py = lerp(0, 1.5, u); yaw = Math.PI; walkAmp = Math.sin(u * Math.PI);
      } else {
        const u = rangeT(t, 23.55, 24.4);
        py = lerp(1.5, -1.5, u); yaw = 0; walkAmp = Math.sin(u * Math.PI);
      }
    } else if (t >= 24.8) {
      const u = rangeT(t, 24.8, 26.2);
      px = 0; py = lerp(-1.5, 0, u);
      armL = 1.05 * rangeT(t, 26.0, 27.5);
      armR = 1.05 * rangeT(t, 26.0, 27.5);
      headY = Math.sin(t * 3.1) * 0.45;
      headP = -0.18;
    }

    world.posePip({
      x: px, y: py, zVis: 0.0, yaw, walkPhase: walkPh, walkAmp,
      headPitch: headP, headYaw: headY, armRaiseL: armL, armRaiseR: armR,
      blink, eyeColor: t > 31.2 ? 0xffd166 : 0x62f2ff, scale
    });

    if (t >= 31.3) {
      const wave = rangeT(t, 31.3, 34.7);
      const centerScr = world.projectToScreen(1, -2, 0.05);
      for (let k = 0; k < 4; k++) {
        const rad = ((wave * 320 + k * 70) % 340);
        const op = (1 - rad / 340) * 0.78 * rangeT(t, 31.3, 32.0);
        hudCtx.strokeStyle = `rgba(98, 242, 255, ${op})`;
        hudCtx.lineWidth = 3.5;
        hudCtx.beginPath();
        hudCtx.ellipse(centerScr.x, centerScr.y, rad * 1.15, rad * 0.85, 0, 0, Math.PI * 2);
        hudCtx.stroke();
      }
    }

    if (t < 13.0) {
      const op = rangeT(t, 0.2, 1.1) * (1 - rangeT(t, 11.6, 12.8));
      setStaticCard("act1_title", `
        <div class="title-banner">
          <div class="title-kicker">The Lowest Point</div>
          <div class="title-main">Contour Plots — Finding the Global Minimum</div>
          <div class="title-sub">Khushagra Rawal &nbsp;•&nbsp; URN E25B070531 &nbsp;•&nbsp; Batch: Hopper-Debugger</div>
        </div>`, op);
    } else if (t >= 11.6 && t < 31.0) {
      const op = rangeT(t, 11.6, 12.4) * (1 - rangeT(t, 29.8, 31.0));
      setStaticCard("act1_z_unknown", `
        <div class="glass-card" style="right:64px; top:70px; width:380px;">
          <div class="eyebrow">2D Map Limitation</div>
          <div class="eq-md">${texHTML("(x, y) \\;\\mapsto\\; z = \\text{???}")}</div>
          <div class="subnote">Roads &amp; coordinates visible, but elevation is hidden.</div>
        </div>`, op);
    }

    if (t >= 6.5 && t < 11.5) {
      const pScr = world.projectToScreen(px, py, 0.9);
      const op = rangeT(t, 6.5, 7.1) * (1 - rangeT(t, 10.6, 11.5));
      drawPillTag(hudCtx, pScr.x, pScr.y - 36, "Position (x, y) — Height Unknown", "rgba(110,215,255,0.5)", "#f3f8ff", op);
    }

    if (t >= 16.5 && t < 20.3) {
      const bScr = world.projectToScreen(1, -2, 0.05);
      const pulse = 0.5 + 0.5 * Math.sin((t - 16.5) * 6.5);
      const op = rangeT(t, 16.5, 17.2) * (1 - rangeT(t, 19.4, 20.3));
      hudCtx.save();
      hudCtx.fillStyle = `rgba(255, 209, 102, ${0.82 * op})`;
      hudCtx.beginPath();
      hudCtx.arc(bScr.x, bScr.y, 12 + 10 * pulse, 0, Math.PI * 2);
      hudCtx.fill();
      hudCtx.restore();
      drawPillTag(hudCtx, bScr.x, bScr.y - 38, "Lowest Point?", "#ffd166", "#ffd166", op);
    }

    if (t >= 20.5 && t < 29.8) {
      const pScr = world.projectToScreen(px, py, 0.2);
      const op = rangeT(t, 20.5, 21.0) * (1 - rangeT(t, 28.8, 29.8));
      const dirs = [
        { dx: -115, dy: 0, active: t >= 20.8 && t < 21.8 },
        { dx: 115, dy: 0, active: t >= 21.8 && t < 22.7 },
        { dx: 0, dy: -88, active: t >= 22.6 && t < 23.6 },
        { dx: 0, dy: 88, active: t >= 23.5 && t < 24.6 },
      ];
      for (const d of dirs) {
        const col = d.active ? `rgba(255, 209, 102, ${op})` : `rgba(130, 210, 255, ${0.60 * op})`;
        drawArrow2D(hudCtx, pScr.x + d.dx * 0.28, pScr.y + d.dy * 0.28, pScr.x + d.dx, pScr.y + d.dy, col, d.active ? 5.5 : 3.5);
      }
    }
  }

  // =========================================================================
  // ACT II (34.76 - 107.80): 3D LANDSCAPE & THE GLASS SLICE
  // =========================================================================
  else if (t < 107.80) {
    const lift = rangeT(t, 53.0, 56.5);
    world.updateTerrain(lift);
    world.surfUniforms.uSurfaceAlpha.value = t >= 85.6 ? lerp(1.0, 0.72, rangeT(t, 85.6, 88.0)) : 1.0;

    if (t >= 52.8) {
      world.axesGroup.visible = true;
      world.surfUniforms.uContourAlpha.value = 0.22 * rangeT(t, 56.5, 62.0);
    }

    if (t >= 47.2 && t < 56.8) {
      const pGrow = rangeT(t, 47.5, 51.8) * (1 - rangeT(t, 53.2, 55.8));
      world.pillarsGroup.visible = pGrow > 0.01;
      for (const m of world.pillars) {
        const h = Math.max(0.04, m.userData.h * pGrow);
        m.scale.set(1, h, 1);
        m.position.y = h * 0.5;
      }
    }

    let camPos = [0.45 * Math.sin(t * 0.35), 10.6, 3.6 + 0.35 * Math.cos(t * 0.3)];
    let camLook = [0, 0.5, 0];
    if (t < 52.8) {
      const u = rangeT(t, 46.5, 52.2);
      camPos = lerpVec(camPos, [5.8, 7.6, 7.6], u);
      camLook = lerpVec([0, 0, 0], [0, 0.8, 0], u);
    } else if (t < 61.0) {
      const u = rangeT(t, 53.0, 60.5);
      camPos = lerpVec([5.8, 7.6, 7.6], [8.8, 5.2, 6.4], u);
      camLook = [0, 1.4, 0];
    } else if (t < 68.5) {
      const u = rangeT(t, 61.0, 63.6);
      const uBack = rangeT(t, 65.5, 68.5);
      const sidePos = [11.2, 2.6 + 0.2 * Math.sin(t * 0.7), 0.4];
      camPos = uBack > 0 ? lerpVec(sidePos, [7.6, 6.4, 7.4], uBack) : lerpVec([8.8, 5.2, 6.4], sidePos, u);
      camLook = [0, 1.4, 0];
    } else if (t < 85.5) {
      const u = rangeT(t, 68.5, 75.0);
      camPos = lerpVec([7.6, 6.4, 7.4], [6.4 + 0.4 * Math.sin(t * 0.4), 5.8, 7.4], u);
      camLook = [0, 1.3, 0];
    } else if (t < 95.0) {
      const u = rangeT(t, 85.6, 88.0);
      camPos = lerpVec([6.4 + 0.4 * Math.sin(t * 0.4), 5.8, 7.4], [0.2 * Math.sin(t * 0.4), 14.0 - 0.5 * Math.sin(t * 0.3), 0.01], u);
      camLook = [0, 0.0, 0];
    } else if (t < 102.0) {
      const u = rangeT(t, 95.2, 97.6);
      camPos = lerpVec([0.2 * Math.sin(t * 0.4), 14.0, 0.01], [5.8 + 0.4 * Math.sin(t * 0.5), 8.8, 5.6], u);
      camLook = [0, 1.0, 0];
    } else {
      const u = rangeT(t, 102.0, 106.5);
      camPos = lerpVec([5.8, 8.8, 5.6], [7.2, 6.4, 7.6], u);
      camLook = [0, 1.2, 0];
    }
    setCamera(camPos, camLook);

    if (t >= 71.0) {
      world.glassGroup.visible = true;
      let sliceZ = 2.6;
      if (t < 79.5) sliceZ = lerp(3.5, 2.05, rangeT(t, 74.5, 79.2));
      else if (t < 95.3) sliceZ = 2.05;
      else sliceZ = lerp(2.05, 1.28, rangeT(t, 95.4, 98.4));

      world.glassGroup.position.y = sliceZ;
      world.surfUniforms.uSliceY.value = sliceZ;
      world.surfUniforms.uSliceGlow.value = rangeT(t, 73.0, 76.0);
      if (t >= 95.5) world.surfUniforms.uContourAlpha.value = lerp(0.22, 0.72, rangeT(t, 95.5, 99.5));
    }

    const pipZ = visualZ("terrain", 0.8, -1.2, lift);
    world.posePip({
      x: 0.8, y: -1.2, zVis: pipZ, yaw: 0.4,
      headPitch: t > 72 && t < 85 ? -0.35 : 0.0,
      headYaw: Math.sin(t * 1.1) * 0.25,
      armRaiseR: t > 74 && t < 82 ? 0.65 : 0.0, blink, eyeColor: 0x62f2ff,
    });

    if (t >= 35.0 && t < 52.8) {
      const op = rangeT(t, 35.0, 36.2) * (1 - rangeT(t, 51.8, 52.8));
      const stage = t >= 45.0 ? 2 : (t >= 41.0 ? 1 : 0);
      setStaticCard(`act2_fn_${stage}`, `
        <div class="glass-card" style="left:64px; top:64px; width:490px;">
          <div class="eyebrow">Function of Two Variables</div>
          <div class="eq-lg">${texHTML("f(x, y) = z")}</div>
          <div class="subnote">
            ${stage >= 1 ? `Inputs: <b style="color:#52d6ff">x</b>, <b style="color:#ff8fa3">y</b>` : "Two spatial inputs"}
            ${stage >= 2 ? ` &nbsp;→&nbsp; Output: <b style="color:#ffd166">z (Height)</b>` : ""}
          </div>
        </div>`, op);
    } else if (t >= 53.0 && t < 69.5) {
      const op = rangeT(t, 53.2, 54.4) * (1 - rangeT(t, 68.5, 69.5));
      setStaticCard("act2_3d", `
        <div class="glass-card" style="left:64px; top:64px; width:450px;">
          <div class="eyebrow">3D Space (x, y, z)</div>
          <div class="eq-md">${texHTML("z = f(x, y)")}</div>
          <div class="subnote">Three orthogonal dimensions: position <b style="color:#52d6ff">(x,y)</b> plus vertical elevation <b style="color:#ffd166">z</b>.</div>
        </div>`, op);
    } else if (t >= 71.0 && t < 107.8) {
      const op = rangeT(t, 71.2, 72.2) * (1 - rangeT(t, 106.8, 107.8));
      const modeK = t >= 95.4 ? 2 : (t >= 88.0 ? 1 : 0);
      setStaticCard(`act2_slice_${modeK}`, `
        <div class="glass-card" style="left:64px; top:64px; width:480px;">
          <div class="eyebrow">Horizontal Glass Slice</div>
          <div class="eq-md">${texHTML(modeK === 2 ? "f(x, y) = c_2 \\;\\;(< c_1)" : "z = c \\;\\;\\Longrightarrow\\;\\; f(x, y) = c")}</div>
          <div class="subnote">${modeK >= 1 ? "Top-down projection: every point on a contour shares one constant height." : "Points where the level glass meets the surface have equal height."}</div>
        </div>`, op);
    }
  }

  // =========================================================================
  // ACT III (107.80 - 144.20): WORKED EQUATION & DISCOVERING CENTER (1, -2)
  // =========================================================================
  else if (t < 144.20) {
    const fadeInBowl = rangeT(t, 108.0, 111.0);
    world.showBowl(0.84 * fadeInBowl, -99, 0, 0.28);
    world.axesGroup.visible = true;

    let camPos = lerpVec([7.2, 6.4, 7.6], [5.8, 8.2, 8.8], rangeT(t, 108.0, 114.0));
    if (t >= 126.0) camPos = lerpVec(camPos, [3.6, 8.8, 8.4], rangeT(t, 126.0, 138.0));
    const camLook = lerpVec([0, 1.2, 0], [0.8, 0.8, 1.4], rangeT(t, 108.0, 120.0));
    setCamera(camPos, camLook);

    if (t >= 129.5) {
      const tx = rangeT(t, 129.6, 132.0);
      const ty = rangeT(t, 132.6, 135.2);
      if (tx > 0.02) {
        world.tapeX.visible = true;
        world.tapeX.scale.set(1.8 * tx, 1, 1);
        world.tapeX.position.set(1 + 0.9 * tx, 0.06, 2.0);
      }
      if (ty > 0.02) {
        world.tapeY.visible = true;
        world.tapeY.scale.set(1, 1, 1.5 * ty);
        world.tapeY.position.set(1.0, 0.06, 2.0 - 0.75 * ty);
      }
    }

    if (t >= 137.3) {
      world.centerBeacon.visible = true;
      const drop = rangeT(t, 137.3, 139.6);
      world.centerBeacon.position.set(1, (1 - drop) * 2.4, 2);
      world.centerGem.rotation.y = t * 2.4;
    }
    if (t >= 141.2) world.originCross.visible = true;

    const walkToCenter = rangeT(t, 127.0, 136.5);
    const px = lerp(0.8, 0.2, walkToCenter);
    const py = lerp(-1.2, -1.7, walkToCenter);
    world.posePip({
      x: px, y: py, zVis: visualZ("bowl", px, py),
      yaw: 0.6, walkPhase: t * 9, walkAmp: Math.sin(walkToCenter * Math.PI),
      headPitch: 0.12, headYaw: Math.sin(t * 1.6) * 0.25,
      armRaiseR: t > 138 ? 0.85 : 0.2, blink, eyeColor: 0xffd166,
    });

    if (t >= 138.0) {
      const cScr = world.projectToScreen(1, -2, 1.65);
      drawPillTag(hudCtx, cScr.x, cScr.y, "Center: (1, -2)", "#ffd166", "#ffd166", 1.0);
    }
    if (t >= 141.4) {
      const oScr = world.projectToScreen(0, 0, 0.35);
      drawPillTag(hudCtx, oScr.x, oScr.y - 30, "Not (0, 0) ✗", "#ff5964", "#ff8fa3", 1.0);
    }

    const op = rangeT(t, 109.5, 111.5);
    const stage = t >= 137.0 ? 4 : (t >= 126.5 ? 3 : (t >= 118.8 ? 2 : (t >= 115.2 ? 1 : 0)));
    const eqTex = stage >= 2
      ? "f(x, y) = \\color{#52d6ff}{(x - 1)^2} + \\color{#ff8fa3}{(y + 2)^2}"
      : stage === 1 ? "f(x, y) = \\color{#52d6ff}{(x - 1)^2} + \\dots" : "f(x, y) = \\dots";

    setStaticCard(`act3_eq_${stage}`, `
      <div class="glass-card" style="left:60px; top:60px; width:620px;">
        <div class="eyebrow">Worked Function</div>
        <div class="eq-lg">${texHTML(eqTex)}</div>
        ${stage >= 3 ? `<div class="subnote">
          <span style="color:#52d6ff">x distance from 1</span> &nbsp;+&nbsp;
          <span style="color:#ff8fa3">y distance from -2</span>
          ${stage >= 4 ? `<br><b style="color:#ffd166">Center = (1, -2)</b> &nbsp;(shifted from (0, 0))` : ""}
        </div>` : ""}
      </div>`, op);
  }

  // =========================================================================
  // ACT IV (144.20 - 198.20): THREE CONTOURS & r vs c
  // =========================================================================
  else if (t < 198.20) {
    world.axesGroup.visible = true;
    world.centerBeacon.visible = true;
    world.centerGem.rotation.y = t * 2.2;

    const camBlend = rangeT(t, 144.5, 154.0);
    const topBlend = rangeT(t, 169.0, 174.0);
    let camPos = lerpVec([3.6, 8.8, 8.4], [2.4, 10.4, 6.4], camBlend);
    camPos = lerpVec(camPos, [1.2, 11.8, 4.8], topBlend);
    setCamera(camPos, [1.0, 0.5, 2.0]);

    let cVal = 2.5;
    if (t < 172.5) cVal = lerp(2.5, 1.0, rangeT(t, 168.0, 172.0));
    else if (t < 176.5) cVal = 1.0;
    else if (t < 179.4) cVal = lerp(1.0, 4.0, rangeT(t, 176.6, 178.0));
    else cVal = lerp(4.0, 9.0, rangeT(t, 179.5, 181.2));

    const sliceY = Z_VIS_SCALE_BOWL * cVal;
    const surfAlpha = lerp(0.84, 0.42, rangeT(t, 172.0, 175.0));
    world.showBowl(surfAlpha, sliceY, t >= 146.5 ? 1.0 : 0.0, 0.18);

    world.glassGroup.visible = t >= 146.5 && t < 187.5;
    world.glassGroup.position.y = sliceY;

    if (t >= 172.6) world.rings[1].group.visible = true;
    if (t >= 176.6) world.rings[4].group.visible = true;
    if (t >= 179.4) world.rings[9].group.visible = true;

    if (t >= 172.6 && t < 187.0) {
      const rCur = t < 176.6 ? 1.0 : (t < 179.4 ? lerp(1, 2, rangeT(t, 176.6, 178.0)) : lerp(2, 3, rangeT(t, 179.4, 181.2)));
      const ang = (t - 172.6) * 1.4;
      world.radiusBar.visible = true;
      world.radiusBar.scale.set(1, rCur, 1);
      world.radiusBar.rotation.set(0, ang, Math.PI / 2);
      world.radiusBar.position.set(1 + (rCur * 0.5) * Math.cos(ang), 0.07, 2 - (rCur * 0.5) * Math.sin(ang));
    }

    if (t >= 193.5) world.mistakeRing.visible = true;

    const px = -0.35, py = -2.3;
    world.posePip({
      x: px, y: py, zVis: visualZ("bowl", px, py),
      yaw: 1.2, headYaw: Math.sin(t * 1.5) * 0.25,
      armRaiseR: 0.5 + 0.3 * Math.sin(t * 2.5), blink, eyeColor: 0x52e5ff,
    });

    if (t >= 173.2) {
      const p1 = world.projectToScreen(2.05, -2.0, 0.15);
      drawPillTag(hudCtx, p1.x, p1.y, "c=1 → r=1", "#52e5ff", "#52e5ff");
    }
    if (t >= 177.2) {
      const p2 = world.projectToScreen(3.15, -2.0, 0.15);
      drawPillTag(hudCtx, p2.x, p2.y, "c=4 → r=2", "#48f0a8", "#48f0a8");
    }
    if (t >= 180.2) {
      const p3 = world.projectToScreen(4.3, -2.0, 0.15);
      drawPillTag(hudCtx, p3.x, p3.y, "c=9 → r=3", "#ffc857", "#ffc857");
    }
    if (t >= 194.2) {
      const pm = world.projectToScreen(1.0, 2.0, 0.12);
      drawPillTag(hudCtx, pm.x, pm.y, "Mistake if r = c (= 4) ✗", "#ff4757", "#ff8fa3");
    }

    const hasSqrt = t >= 168.5 ? 1 : 0;
    const hasCompare = t >= 186.8 ? (t >= 194.2 ? 2 : 1) : 0;
    const eqStr = hasSqrt ? "(x - 1)^2 + (y + 2)^2 = c \\quad\\Longrightarrow\\quad r = \\sqrt{c}" : "(x - 1)^2 + (y + 2)^2 = c";
    setStaticCard(`act4_${hasSqrt}_${hasCompare}`, `
      <div class="glass-card" style="left:56px; top:56px; width:640px;">
        <div class="eyebrow">Level Curve Equation</div>
        <div class="eq-md">${texHTML(eqStr)}</div>
        <div class="subnote">Circle centered at <b style="color:#ffd166">(1, -2)</b> with radius <b style="color:#52e5ff">r = √c</b></div>
      </div>
      ${hasCompare >= 1 ? `
      <div class="glass-card ${hasCompare === 2 ? "warn-card" : ""}" style="right:56px; top:56px; width:470px;">
        <div class="eyebrow ${hasCompare === 2 ? "warn-eyebrow" : ""}">Level Value (c) vs. Radius (r)</div>
        <div class="eq-sm" style="margin-bottom:10px">
          ${texHTML("c = 1 \\to 4 \\to 9 \\quad (\\Delta c = +3, +5)")}<br>
          ${texHTML("r = 1 \\to 2 \\to 3 \\quad (\\Delta r = +1, +1)")}
        </div>
        ${hasCompare === 2 ? `<div class="subnote" style="color:#ffb3bc">
          <b>Common Mistake:</b> treating ${texHTML("r = c")} ✗<br>
          <b style="color:#48f0a8">Actual Radius:</b> ${texHTML("r = \\sqrt{c}")} ✓
        </div>` : `<div class="subnote">Radius grows as the <b>square root</b> of height.</div>`}
      </div>` : ""}`, 1.0);
  }

  // =========================================================================
  // ACT V (198.20 - 213.90): c = 0 AND c < 0
  // =========================================================================
  else if (t < 213.90) {
    world.axesGroup.visible = true;
    world.centerBeacon.visible = true;
    // Lower camera angle with subtle drift so the glass plane passing BELOW z=0 is unmistakable!
    setCamera([5.0 + 0.45 * Math.sin((t - 198.2) * 0.5), 3.6 + 0.15 * Math.cos(t * 0.6), 7.6], [1.0, 0.2, 2.0]);

    let cVal = 1.0;
    if (t < 205.8) cVal = lerp(1.4, 0.0, rangeT(t, 200.5, 203.8));
    else cVal = lerp(0.0, -3.2, rangeT(t, 206.3, 209.6));

    const sliceY = Z_VIS_SCALE_BOWL * cVal;
    world.showBowl(0.76, sliceY, cVal >= -0.05 ? 1.0 : 0.0, 0.15);
    world.glassGroup.visible = true;
    world.glassGroup.position.y = sliceY;
    world.glassMat.color.setHex(cVal < 0 ? 0xff5c70 : 0x62d9ff);
    world.glassFrameMat.color.setHex(cVal < 0 ? 0xff5c70 : 0x7be8ff);

    world.posePip({
      x: -0.4, y: -2.2, zVis: visualZ("bowl", -0.4, -2.2),
      yaw: 1.1, headPitch: cVal < 0 ? 0.35 : 0.1, blink,
      eyeColor: cVal < 0 ? 0xff7b89 : 0xffd166,
    });

    const isNeg = t >= 206.3 ? 1 : 0;
    if (isNeg) {
      const gScr = world.projectToScreen(1.0, -2.0, sliceY);
      drawPillTag(hudCtx, gScr.x, gScr.y, `Plane z = ${cVal.toFixed(1)} < 0 — No Intersection (∅)`, "#ff5c70", "#ff8fa3");
    }
    setStaticCard(`act5_${isNeg}`, `
      <div class="glass-card ${isNeg ? "warn-card" : "gold-card"}" style="left:56px; top:56px; width:580px;">
        <div class="eyebrow ${isNeg ? "warn-eyebrow" : "gold-eyebrow"}">${isNeg ? "Negative Level: c < 0" : "Zero Level: c = 0"}</div>
        <div class="eq-md">${texHTML(isNeg
          ? "(x - 1)^2 + (y + 2)^2 = -2 \\;\\;\\Longrightarrow\\;\\; \\emptyset"
          : "(x - 1)^2 + (y + 2)^2 = 0 \\;\\;\\Longrightarrow\\;\\; (1, -2)")}</div>
        <div class="subnote">${isNeg
          ? "Sum of two squares can never be negative — <b>no real contour exists</b>."
          : "Circle shrinks to a <b>single point</b> at (1, -2)."}</div>
      </div>`, 1.0);
  }

  // =========================================================================
  // ACT VI (213.90 - 257.60): PARTIALS & SADDLE TRAP
  // =========================================================================
  else if (t < 257.60) {
    const isSaddlePhase = t >= 249.3;
    world.axesGroup.visible = true;

    if (!isSaddlePhase) {
      world.showBowl(0.68, -99, 0, 0.22);
      for (const k of [1, 4, 9]) world.rings[k].group.visible = t < 224.0;
      world.centerBeacon.visible = true;
      setCamera(lerpVec([5.0, 3.6, 7.6], [5.4, 5.2, 7.2], rangeT(t, 222.0, 226.0)), [1.0, 0.7, 2.0]);

      if (t >= 224.5) {
        world.xSliceCurve.visible = true;
        world.tangentRodX.visible = true;
        const xSample = lerp(2.5, 1.0, rangeT(t, 225.0, 238.5));
        const slopeX = 2 * (xSample - 1) * Z_VIS_SCALE_BOWL;
        world.tangentRodX.position.set(xSample, Z_VIS_SCALE_BOWL * bowlZ(xSample, -2) + 0.06, 2.0);
        world.tangentRodX.rotation.set(0, 0, Math.PI / 2 - Math.atan(slopeX));
      }
      if (t >= 230.0) {
        world.ySliceCurve.visible = true;
        world.tangentRodY.visible = true;
        const ySample = lerp(-0.5, -2.0, rangeT(t, 230.5, 241.5));
        const slopeY = 2 * (ySample + 2) * Z_VIS_SCALE_BOWL;
        world.tangentRodY.position.set(1.0, Z_VIS_SCALE_BOWL * bowlZ(1, ySample) + 0.06, -ySample);
        world.tangentRodY.rotation.set(Math.PI / 2 - Math.atan(slopeY), 0, 0);
      }

      world.posePip({
        x: 0.25, y: -2.0, zVis: visualZ("bowl", 0.25, -2.0),
        yaw: 1.5, armRaiseR: t > 243 ? 0.9 : 0.3, blink,
        eyeColor: t > 243 ? 0xffd166 : 0x62f2ff,
      });

      if (t < 222.2) {
        setStaticCard("act6_ev", `
          <div class="glass-card gold-card" style="left:56px; top:56px; width:560px;">
            <div class="eyebrow gold-eyebrow">Picture vs. Proof</div>
            <div class="eq-md">Visual Rings = Evidence &nbsp;≠&nbsp; Proof</div>
            <div class="subnote">We need calculus and algebra to be 100% certain.</div>
          </div>`, 1.0);
      } else {
        const stage = t >= 242.8 ? 3 : (t >= 235.0 ? 2 : (t >= 229.8 ? 1 : 0));
        setStaticCard(`act6_partials_${stage}`, `
          <div class="glass-card" style="left:56px; top:56px; width:590px;">
            <div class="eyebrow">Partial Derivatives &amp; Critical Point</div>
            <div class="eq-md">
              ${texHTML("\\frac{\\partial f}{\\partial x} = 2(x - 1)")} ${stage >= 2 ? texHTML("= 0 \\Rightarrow \\color{#52d6ff}{x = 1}") : ""}<br>
              ${stage >= 1 ? texHTML("\\frac{\\partial f}{\\partial y} = 2(y + 2)") + (stage >= 2 ? texHTML("= 0 \\Rightarrow \\color{#ff8fa3}{y = -2}") : "") : ""}
            </div>
            ${stage >= 3 ? `<div class="subnote"><b style="color:#ffd166">Gradient vanishes:</b> ${texHTML("\\nabla f(1,-2) = (0, 0)")}. Is that enough?</div>` : ""}
          </div>`, 1.0);
      }
    } else {
      world.showSaddle(0.92);
      const orbit = (t - 249.3) * 0.22;
      setCamera([6.4 * Math.cos(orbit + 0.65), 4.6, 6.4 * Math.sin(orbit + 0.65)], [0, 1.7, 0]);
      world.saddleRiseLine.visible = t >= 253.8;
      world.saddleFallLine.visible = t >= 255.6;
      world.saddleFlatDisk.visible = true;

      const wobble = Math.sin((t - 250) * 8) * 0.35;
      world.posePip({
        x: 0, y: 0, zVis: 1.85, yaw: 0.4,
        armRaiseL: 1.15, armRaiseR: 1.15,
        headYaw: wobble, headPitch: 0.1,
        squash: 0.92 + 0.08 * Math.sin(t * 10),
        blink, eyeColor: 0xff5c70,
      });

      if (t >= 254.2) {
        const rScr = world.projectToScreen(2.2, 0, 1.85 + 0.22 * 4.8);
        drawPillTag(hudCtx, rScr.x, rScr.y, "Rises (+x²) ▲", "#4ef0a2", "#4ef0a2");
      }
      if (t >= 255.8) {
        const fScr = world.projectToScreen(0, -1.6, 1.85 - 0.22 * 2.56);
        drawPillTag(hudCtx, fScr.x, fScr.y, "Falls (-y²) ▼", "#ff5c70", "#ff8fa3");
      }

      setStaticCard("act6_saddle", `
        <div class="glass-card warn-card" style="left:56px; top:56px; width:610px;">
          <div class="eyebrow warn-eyebrow">Counterexample: The Saddle Trap</div>
          <div class="eq-md">${texHTML("g(x, y) = x^2 - y^2 \\;\\Longrightarrow\\; \\nabla g(0,0) = (0,0)")}</div>
          <div class="subnote">
            <span style="color:#4ef0a2">▲ Rises along x</span> &nbsp;|&nbsp;
            <span style="color:#ff7b89">▼ Falls along y</span><br>
            Zero gradient alone does <b>not</b> guarantee a minimum!
          </div>
        </div>`, 1.0);
    }
  }

  // =========================================================================
  // ACT VII (257.60 - 287.40): SUM OF TWO SQUARES PROOF & UNIQUE GLOBAL MIN
  // =========================================================================
  else if (t < 287.40) {
    world.showBowl(0.74, 0.0, 1.0, 0.30);
    world.axesGroup.visible = true;
    world.centerBeacon.visible = true;
    world.centerGem.rotation.y = t * 2.8;

    world.glassGroup.visible = t >= 265.5;
    world.glassGroup.position.y = 0.0;
    world.glassMat.color.setHex(0xffd166);
    world.glassFrameMat.color.setHex(0xffd166);

    setCamera(lerpVec([5.4, 5.2, 7.2], [4.6, 5.0, 7.6], rangeT(t, 260.0, 276.0)), [1.0, 0.7, 2.0]);

    const reach = rangeT(t, 270.5, 276.5);
    const px = lerp(-0.5, 1.0, reach);
    const py = -2.0;
    world.posePip({
      x: px, y: py, zVis: visualZ("bowl", px, py),
      yaw: 0.2, walkPhase: t * 10, walkAmp: Math.sin(reach * Math.PI),
      armRaiseL: t > 282 ? 1.2 : 0.2, armRaiseR: t > 282 ? 1.2 : 0.2,
      blink, eyeColor: 0xffd166,
    });

    if (t >= 282.0) {
      const mScr = world.projectToScreen(1.0, -2.0, 1.75);
      drawPillTag(hudCtx, mScr.x, mScr.y, "Global Min: f(1,-2) = 0 ★", "#ffd166", "#ffd166");
    }

    const stage = t >= 279.0 ? 3 : (t >= 270.8 ? 2 : (t >= 267.0 ? 1 : 0));
    setStaticCard(`act7_proof_${stage}`, `
      <div class="glass-card gold-card" style="left:56px; top:56px; width:650px;">
        <div class="eyebrow gold-eyebrow">Rigorous Lower-Bound Proof</div>
        <div class="eq-md">
          ${texHTML("\\color{#52d6ff}{(x - 1)^2 \\ge 0} \\quad\\text{and}\\quad \\color{#ff8fa3}{(y + 2)^2 \\ge 0}")}<br>
          ${stage >= 1 ? texHTML("\\Longrightarrow\\; f(x, y) \\ge 0 \\quad \\forall\\,(x,y)\\in\\mathbb{R}^2") : ""}
        </div>
        <div class="subnote">
          ${stage >= 2 ? `At <b style="color:#ffd166">(1, -2)</b>: ${texHTML("0^2 + 0^2 = 0")} — lower bound achieved.` : "Square of any real number is never negative."}
          ${stage >= 3 ? `<br><b style="color:#48f0a8">PROVED:</b> Unique <b>Global Minimum</b> = <b>0</b> at <b>(1, -2)</b>.` : ""}
        </div>
      </div>`, 1.0);

    if (t >= 279.2) {
      drawRoundedBox(hudCtx, 1340, 62, 520, 250, 18, "rgba(10,17,32,0.88)", "rgba(72,240,168,0.58)", 2);
      hudCtx.fillStyle = "#48f0a8";
      hudCtx.font = "700 17px -apple-system, sans-serif";
      hudCtx.fillText("LOCAL vs. GLOBAL MINIMUM", 1370, 96);

      hudCtx.strokeStyle = "#9ec5f8"; hudCtx.lineWidth = 3;
      hudCtx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const gx = 1380 + u * 180;
        const gy = 215 - 35 * Math.sin(u * Math.PI * 2.2) - 45 * (1 - u);
        if (i === 0) hudCtx.moveTo(gx, gy); else hudCtx.lineTo(gx, gy);
      }
      hudCtx.stroke();
      hudCtx.fillStyle = "#ffd166"; hudCtx.font = "600 16px -apple-system, sans-serif";
      hudCtx.fillText("Local: lowest nearby", 1375, 285);

      hudCtx.strokeStyle = "#48f0a8"; hudCtx.lineWidth = 3.5;
      hudCtx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = (i / 60) * 2 - 1;
        const gx = 1620 + (i / 60) * 190;
        const gy = 240 - u * u * 90;
        if (i === 0) hudCtx.moveTo(gx, gy); else hudCtx.lineTo(gx, gy);
      }
      hudCtx.stroke();
      hudCtx.fillStyle = "#48f0a8";
      hudCtx.fillText("Global: lowest in all ℝ²", 1615, 285);
    }
  }

  // =========================================================================
  // ACT VIII (287.40 - 313.833): SYNTHESIS FINALE & END CARD
  // =========================================================================
  else {
    world.showBowl(0.54, -99, 0, 0.55);
    world.axesGroup.visible = true;
    world.centerBeacon.visible = true;
    world.centerGem.rotation.y = t * 2.4;
    for (const k of [1, 4, 9]) world.rings[k].group.visible = true;

    const pull = rangeT(t, 287.4, 300.5);
    const orbit = (t - 287.4) * 0.08;
    const camPos = lerpVec([4.6, 5.0, 7.6], [5.8 * Math.sin(orbit + 0.5), 10.2, 7.6 * Math.cos(orbit + 0.5)], pull);
    setCamera(camPos, [1.0, 0.6, 2.0]);

    world.posePip({
      x: 1.0, y: -2.0, zVis: 0.02, yaw: 0.3,
      armRaiseL: 0.7 + 0.3 * Math.sin(t * 4),
      armRaiseR: 0.7 + 0.3 * Math.cos(t * 4),
      headYaw: Math.sin(t * 1.8) * 0.2, blink, eyeColor: 0xffd166,
    });

    if (t >= 300.8 && t < 310.35) {
      const stage = t >= 305.4 ? 3 : (t >= 303.2 ? 2 : 1);
      const fadeOut = 1 - rangeT(t, 309.6, 310.35);
      setStaticCard(`act8_triad_${stage}`, `
        <div style="position:absolute; right:56px; top:80px; width:540px; display:flex; flex-direction:column; gap:18px;">
          <div class="glass-card" style="position:relative;">
            <div class="eyebrow">1. Discover</div>
            <div class="eq-sm">${texHTML("f(x, y) = c")} &nbsp;—&nbsp; Contour rings reveal candidate valleys</div>
          </div>
          ${stage >= 2 ? `<div class="glass-card" style="position:relative;">
            <div class="eyebrow">2. Verify</div>
            <div class="eq-sm">${texHTML("\\nabla f(1,-2) = (0,0)")} &nbsp;—&nbsp; Critical point located</div>
          </div>` : ""}
          ${stage >= 3 ? `<div class="glass-card gold-card" style="position:relative;">
            <div class="eyebrow gold-eyebrow">3. Prove</div>
            <div class="eq-sm">${texHTML("(x-1)^2 + (y+2)^2 \\ge 0 \\;\\Rightarrow\\; \\min = f(1,-2) = 0")}</div>
          </div>` : ""}
        </div>`, fadeOut);
    }

    if (t >= 310.25) {
      const op = rangeT(t, 310.25, 311.15);
      setStaticCard("act8_endcard", `
        <div class="end-card">
          <div class="eyebrow gold-eyebrow" style="font-size:18px; letter-spacing:4px; margin-bottom:16px">Key Mathematical Takeaway</div>
          <div style="font-size:44px; font-weight:800; color:#ffffff; margin-bottom:18px">
            Contour Plots Reveal Height — Proof Establishes the Global Minimum
          </div>
          <div class="glass-card gold-card" style="position:relative; padding:22px 42px; margin-bottom:34px">
            <div class="eq-lg">${texHTML("f(x, y) = (x - 1)^2 + (y + 2)^2 \\ge 0 \\quad\\Longrightarrow\\quad \\text{Unique Global Minimum: } 0 \\text{ at } (1, -2)")}</div>
          </div>
          <div style="font-size:24px; font-weight:600; color:#9ec5f8; margin-bottom:12px">
            Khushagra Rawal &nbsp;•&nbsp; URN E25B070531 &nbsp;•&nbsp; Batch: Hopper-Debugger
          </div>
          <div style="font-size:17px; color:#94a8c4; max-width:1100px; line-height:1.5">
            Voiceover Narration: Khushagra Rawal (Original Recording Preserved) &nbsp;|&nbsp;
            Visuals, 3D Shaders, Character Rig &amp; Procedural Ambient Sound: Original Creations (AI-Assisted Animation &amp; Audio Engineering) &nbsp;|&nbsp;
            Libraries: Three.js &amp; KaTeX (MIT License)
          </div>
        </div>`, op);
    }
  }

  world.render();
};

window.renderAtTime(0.0);
