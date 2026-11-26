import * as THREE from "./node_modules/three/build/three.module.js";

// Coordinate mapping:
// Math (x, y, z) -> Three.js (x, z_visual, -y)
// Right-handed: +x right, +y north/up on 2D map (-Z in Three.js), +z upward elevation (+Y in Three.js).
export const Z_VIS_SCALE_TERRAIN = 0.68;
export const Z_VIS_SCALE_BOWL = 0.34;
export const Z_VIS_SCALE_SADDLE = 0.22;

export function hillsZ(x, y) {
  // Always >= 0.30 so sculpted landscape never clips below the z=0 baseMap
  const hill1 = 2.6 * Math.exp(-((x + 1.8) ** 2 + (y - 1.5) ** 2) / 3.2);
  const hill2 = 2.1 * Math.exp(-((x - 2.2) ** 2 + (y - 1.8) ** 2) / 2.8);
  const valley = -1.35 * Math.exp(-((x - 1.0) ** 2 + (y + 1.8) ** 2) / 3.4);
  const ridge = 0.45 * Math.sin(0.55 * x) * Math.cos(0.5 * y);
  return Math.max(0.32, 1.82 + hill1 + hill2 + valley + ridge);
}

export function bowlZ(x, y) {
  return (x - 1) ** 2 + (y + 2) ** 2;
}

export function saddleZ(x, y) {
  return x ** 2 - y ** 2;
}

export function visualZ(mode, x, y, lift = 1.0) {
  if (mode === "terrain") {
    return lift * Z_VIS_SCALE_TERRAIN * hillsZ(x, y);
  }
  if (mode === "bowl") {
    return lift * Z_VIS_SCALE_BOWL * bowlZ(x, y);
  }
  if (mode === "saddle") {
    return 1.85 + Z_VIS_SCALE_SADDLE * saddleZ(x, y);
  }
  return 0.0;
}

export class MathWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(1920, 1080, false);
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070d1a);
    this.scene.fog = new THREE.FogExp2(0x070d1a, 0.018);

    this.camera = new THREE.PerspectiveCamera(40, 1920 / 1080, 0.1, 140);
    this.camera.position.set(0, 12, 10);
    this.camera.lookAt(0, 0, 0);

    this._buildLights();
    this._buildStars();
    this._buildBaseMap();
    this._buildTerrainSurface();
    this._buildBowlSurface();
    this._buildSaddleSurface();
    this._buildGlassPlane();
    this._buildAxes();
    this._buildContourProjections();
    this._buildTangentSlices();
    this._buildMarkers();
    this._buildPip();
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xb8dcff, 0x162238, 0.95);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff4e0, 1.85);
    key.position.set(8, 18, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x45c4ff, 0.95);
    rim.position.set(-10, 8, -9);
    this.scene.add(rim);

    const warmBounce = new THREE.PointLight(0xffb74d, 0.8, 26);
    warmBounce.position.set(1, 3, 2);
    this.scene.add(warmBounce);
  }

  _buildStars() {
    const count = 420;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i * 137.508) % 360;
      const r = 18 + ((i * 29.3) % 30);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -3 + ((i * 17.7) % 24);
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x7ab8ff, size: 0.08, transparent: true, opacity: 0.42 });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  _buildBaseMap() {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 2048;
    const g = c.getContext("2d");

    const grad = g.createRadialGradient(1024, 1024, 80, 1024, 1024, 1250);
    grad.addColorStop(0, "#162848");
    grad.addColorStop(1, "#0b1426");
    g.fillStyle = grad;
    g.fillRect(0, 0, 2048, 2048);

    const toPx = (u) => ((u + 6) / 12) * 2048;

    // Fine coordinate grid
    for (let v = -6; v <= 6; v += 0.5) {
      const p = toPx(v);
      const isInt = Math.abs(v - Math.round(v)) < 0.01;
      g.strokeStyle = isInt ? "rgba(115, 205, 255, 0.28)" : "rgba(115, 205, 255, 0.08)";
      g.lineWidth = isInt ? 2.2 : 1;
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 2048); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(2048, p); g.stroke();
    }

    // Stylized cartographic roads & intersections
    g.strokeStyle = "rgba(255, 209, 102, 0.36)";
    g.lineWidth = 12;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(toPx(-5.6), toPx(3.6));
    g.bezierCurveTo(toPx(-2.0), toPx(1.6), toPx(0.4), toPx(-1.4), toPx(5.6), toPx(-2.7));
    g.stroke();

    g.strokeStyle = "rgba(98, 242, 255, 0.28)";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(toPx(-3.4), toPx(-5.6));
    g.bezierCurveTo(toPx(-1.0), toPx(-1.0), toPx(1.5), toPx(1.6), toPx(3.8), toPx(5.6));
    g.stroke();

    // Dashed secondary trail
    g.save();
    g.setLineDash([16, 18]);
    g.strokeStyle = "rgba(255, 160, 180, 0.24)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(toPx(-5.5), toPx(-2.5));
    g.quadraticCurveTo(toPx(0), toPx(0.2), toPx(5.2), toPx(2.8));
    g.stroke();
    g.restore();

    // Principal axes
    g.strokeStyle = "rgba(255, 255, 255, 0.52)";
    g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(toPx(0), 0); g.lineTo(toPx(0), 2048); g.stroke();
    g.beginPath(); g.moveTo(0, toPx(0)); g.lineTo(2048, toPx(0)); g.stroke();

    // Coordinate labels
    g.fillStyle = "rgba(205, 232, 255, 0.78)";
    g.font = "700 30px -apple-system, sans-serif";
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      g.fillText(String(i), toPx(i) + 8, toPx(0) - 10);
      g.fillText(String(-i), toPx(0) + 10, toPx(i) - 10);
    }
    g.fillStyle = "rgba(255, 230, 150, 0.88)";
    g.fillText("(0,0)", toPx(0) + 12, toPx(0) - 12);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    const planeGeo = new THREE.PlaneGeometry(12, 12);
    const planeMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.82,
      metalness: 0.08,
    });
    this.baseMap = new THREE.Mesh(planeGeo, planeMat);
    this.baseMap.rotation.x = -Math.PI / 2;
    this.baseMap.position.y = -0.02;
    this.baseMap.receiveShadow = true;
    this.scene.add(this.baseMap);
  }

  _makeShaderMaterial(uniforms) {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.12,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vWorldPos;`)
        .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           varying vec3 vWorldPos;
           uniform float uSliceY;
           uniform float uSliceGlow;
           uniform float uContourStep;
           uniform float uContourAlpha;
           uniform float uSurfaceAlpha;
           uniform float uGridAlpha;`
        )
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
           float gx = abs(fract(vWorldPos.x + 0.5) - 0.5) / max(fwidth(vWorldPos.x), 0.001);
           float gz = abs(fract(vWorldPos.z + 0.5) - 0.5) / max(fwidth(vWorldPos.z), 0.001);
           float gridLine = 1.0 - min(min(gx, gz), 1.0);
           gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.45, 0.85, 1.0), gridLine * uGridAlpha);

           float ch = vWorldPos.y / max(uContourStep, 0.05);
           float cline = 1.0 - min(abs(fract(ch + 0.5) - 0.5) / max(fwidth(ch), 0.001), 1.0);
           gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.38, 0.94, 1.0), cline * uContourAlpha);

           float distSlice = abs(vWorldPos.y - uSliceY);
           float ring = smoothstep(0.065, 0.008, distSlice) * uSliceGlow;
           gl_FragColor.rgb += vec3(1.0, 0.82, 0.24) * ring * 1.5;
           gl_FragColor.a *= uSurfaceAlpha;`
        );
    };
    return mat;
  }

  _buildTerrainSurface() {
    this.terrainGeo = new THREE.PlaneGeometry(11, 11, 150, 150);
    this.terrainGeo.rotateX(-Math.PI / 2);
    this.terrainGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.terrainGeo.attributes.position.count * 3), 3));

    this.surfUniforms = {
      uSliceY: { value: -99.0 },
      uSliceGlow: { value: 0.0 },
      uContourStep: { value: 0.45 },
      uContourAlpha: { value: 0.0 },
      uSurfaceAlpha: { value: 1.0 },
      uGridAlpha: { value: 0.28 },
    };

    this.terrainMat = this._makeShaderMaterial(this.surfUniforms);
    this.terrainMesh = new THREE.Mesh(this.terrainGeo, this.terrainMat);
    this.terrainMesh.castShadow = true;
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  _buildBowlSurface() {
    // Smooth circular polar mesh centered at (1, -2) -> Three.js (1, 0, 2), radius 3.35 (covers c=1, 4, 9 cleanly!)
    const rSeg = 72;
    const tSeg = 128;
    const maxR = 3.35;
    const positions = [];
    const colors = [];
    const indices = [];
    const col = new THREE.Color();

    for (let ir = 0; ir <= rSeg; ir++) {
      const r = (ir / rSeg) * maxR;
      const zMath = r * r; // f(x,y) = r^2
      const yVis = Z_VIS_SCALE_BOWL * zMath;
      const norm = Math.min(1, yVis / 3.8);
      if (norm < 0.25) col.setRGB(0.08 + 0.08 * (norm / 0.25), 0.26 + 0.28 * (norm / 0.25), 0.54 + 0.16 * (norm / 0.25));
      else if (norm < 0.6) { const u = (norm - 0.25) / 0.35; col.setRGB(0.16 + 0.18 * u, 0.54 + 0.24 * u, 0.70 - 0.26 * u); }
      else { const u = (norm - 0.6) / 0.4; col.setRGB(0.34 + 0.56 * u, 0.78 + 0.08 * u, 0.44 - 0.22 * u); }
      if (yVis < 0.12) col.lerp(new THREE.Color(0xffd166), 0.55 * (1 - yVis / 0.12));

      for (let it = 0; it <= tSeg; it++) {
        const th = (it / tSeg) * Math.PI * 2;
        const x = 1.0 + r * Math.cos(th);
        const yMath = -2.0 + r * Math.sin(th);
        positions.push(x, yVis, -yMath);
        colors.push(col.r, col.g, col.b);
      }
    }
    for (let ir = 0; ir < rSeg; ir++) {
      for (let it = 0; it < tSeg; it++) {
        const a = ir * (tSeg + 1) + it;
        const b = (ir + 1) * (tSeg + 1) + it;
        const c = (ir + 1) * (tSeg + 1) + (it + 1);
        const d = ir * (tSeg + 1) + (it + 1);
        indices.push(a, b, d, b, c, d);
      }
    }

    this.bowlGeo = new THREE.BufferGeometry();
    this.bowlGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.bowlGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.bowlGeo.setIndex(indices);
    this.bowlGeo.computeVertexNormals();

    this.bowlUniforms = {
      uSliceY: { value: -99.0 },
      uSliceGlow: { value: 0.0 },
      uContourStep: { value: Z_VIS_SCALE_BOWL * 1.0 },
      uContourAlpha: { value: 0.25 },
      uSurfaceAlpha: { value: 0.86 },
      uGridAlpha: { value: 0.24 },
    };
    this.bowlMat = this._makeShaderMaterial(this.bowlUniforms);
    this.bowlMesh = new THREE.Mesh(this.bowlGeo, this.bowlMat);
    this.bowlMesh.visible = false;
    this.scene.add(this.bowlMesh);
  }

  _buildSaddleSurface() {
    // Smooth circular disk saddle g(x,y) = x^2 - y^2 centered at (0,0), radius 3.3
    const rSeg = 64;
    const tSeg = 128;
    const maxR = 3.25;
    const positions = [];
    const colors = [];
    const indices = [];
    const col = new THREE.Color();

    for (let ir = 0; ir <= rSeg; ir++) {
      const r = (ir / rSeg) * maxR;
      for (let it = 0; it <= tSeg; it++) {
        const th = (it / tSeg) * Math.PI * 2;
        const x = r * Math.cos(th);
        const yMath = r * Math.sin(th);
        const sVal = saddleZ(x, yMath);
        const yVis = 1.85 + Z_VIS_SCALE_SADDLE * sVal;
        const t = Math.max(-1, Math.min(1, sVal / 5.5));
        if (t >= 0) col.setRGB(0.14 + 0.26 * t, 0.56 + 0.34 * t, 0.48 - 0.16 * t);
        else { const u = -t; col.setRGB(0.22 + 0.72 * u, 0.34 - 0.10 * u, 0.54 - 0.26 * u); }
        positions.push(x, yVis, -yMath);
        colors.push(col.r, col.g, col.b);
      }
    }
    for (let ir = 0; ir < rSeg; ir++) {
      for (let it = 0; it < tSeg; it++) {
        const a = ir * (tSeg + 1) + it;
        const b = (ir + 1) * (tSeg + 1) + it;
        const c = (ir + 1) * (tSeg + 1) + (it + 1);
        const d = ir * (tSeg + 1) + (it + 1);
        indices.push(a, b, d, b, c, d);
      }
    }

    this.saddleGeo = new THREE.BufferGeometry();
    this.saddleGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.saddleGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.saddleGeo.setIndex(indices);
    this.saddleGeo.computeVertexNormals();

    this.saddleUniforms = {
      uSliceY: { value: -99.0 },
      uSliceGlow: { value: 0.0 },
      uContourStep: { value: 0.45 },
      uContourAlpha: { value: 0.20 },
      uSurfaceAlpha: { value: 0.92 },
      uGridAlpha: { value: 0.28 },
    };
    this.saddleMat = this._makeShaderMaterial(this.saddleUniforms);
    this.saddleMesh = new THREE.Mesh(this.saddleGeo, this.saddleMat);
    this.saddleMesh.visible = false;
    this.scene.add(this.saddleMesh);
  }

  updateTerrain(lift) {
    this.terrainMesh.visible = lift > 0.005;
    this.bowlMesh.visible = false;
    this.saddleMesh.visible = false;
    if (!this.terrainMesh.visible) return;

    const pos = this.terrainGeo.attributes.position;
    const col = this.terrainGeo.attributes.color;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const yMath = -pos.getZ(i);
      const yVis = lift * Z_VIS_SCALE_TERRAIN * hillsZ(x, yMath);
      pos.setY(i, yVis);
      const norm = Math.max(0, Math.min(1, yVis / 4.2));
      if (norm < 0.25) c.setRGB(0.08 + 0.08 * (norm / 0.25), 0.24 + 0.28 * (norm / 0.25), 0.50 + 0.18 * (norm / 0.25));
      else if (norm < 0.6) { const u = (norm - 0.25) / 0.35; c.setRGB(0.16 + 0.18 * u, 0.52 + 0.24 * u, 0.68 - 0.25 * u); }
      else { const u = (norm - 0.6) / 0.4; c.setRGB(0.34 + 0.58 * u, 0.76 + 0.08 * u, 0.43 - 0.22 * u); }
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.terrainGeo.computeVertexNormals();
  }

  showBowl(alpha = 0.86, sliceY = -99, sliceGlow = 0, contourAlpha = 0.25) {
    this.terrainMesh.visible = false;
    this.saddleMesh.visible = false;
    this.bowlMesh.visible = true;
    this.bowlUniforms.uSurfaceAlpha.value = alpha;
    this.bowlUniforms.uSliceY.value = sliceY;
    this.bowlUniforms.uSliceGlow.value = sliceGlow;
    this.bowlUniforms.uContourAlpha.value = contourAlpha;
  }

  showSaddle(alpha = 0.92) {
    this.terrainMesh.visible = false;
    this.bowlMesh.visible = false;
    this.saddleMesh.visible = true;
    this.saddleUniforms.uSurfaceAlpha.value = alpha;
  }

  _buildGlassPlane() {
    this.glassGroup = new THREE.Group();
    const geo = new THREE.PlaneGeometry(11.4, 11.4);
    geo.rotateX(-Math.PI / 2);
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x62d9ff,
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.glassGroup.add(new THREE.Mesh(geo, this.glassMat));

    const pts = [
      new THREE.Vector3(-5.7, 0, -5.7),
      new THREE.Vector3(5.7, 0, -5.7),
      new THREE.Vector3(5.7, 0, 5.7),
      new THREE.Vector3(-5.7, 0, 5.7),
      new THREE.Vector3(-5.7, 0, -5.7),
    ];
    this.glassFrameMat = new THREE.LineBasicMaterial({ color: 0x7be8ff, transparent: true, opacity: 0.85 });
    this.glassGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.glassFrameMat));
    this.glassGroup.visible = false;
    this.scene.add(this.glassGroup);
  }

  _buildAxes() {
    this.axesGroup = new THREE.Group();
    const mkAxis = (from, to, color) => {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 });
      return new THREE.Line(geo, mat);
    };
    this.axesGroup.add(mkAxis(new THREE.Vector3(-5.6, 0.02, 0), new THREE.Vector3(5.6, 0.02, 0), 0x5cc8ff));
    this.axesGroup.add(mkAxis(new THREE.Vector3(0, 0.02, 5.6), new THREE.Vector3(0, 0.02, -5.6), 0xff7b89));
    this.axesGroup.add(mkAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 4.4, 0), 0xffd166));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 16), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    cone.position.set(0, 4.45, 0);
    this.axesGroup.add(cone);
    this.axesGroup.visible = false;
    this.scene.add(this.axesGroup);
  }

  _buildContourProjections() {
    this.ringsGroup = new THREE.Group();
    this.rings = {};
    const specs = [
      { c: 1, r: 1, color: 0x52e5ff },
      { c: 4, r: 2, color: 0x48f0a8 },
      { c: 9, r: 3, color: 0xffc857 },
    ];
    for (const s of specs) {
      const group = new THREE.Group();
      const segs = 128;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const th = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(1 + s.r * Math.cos(th), 0.04, 2 - s.r * Math.sin(th)));
      }
      const floorLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.98 })
      );
      const elevPts = pts.map((p) => new THREE.Vector3(p.x, Z_VIS_SCALE_BOWL * s.c + 0.02, p.z));
      const elevLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(elevPts),
        new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.92 })
      );
      const rayMat = new THREE.LineDashedMaterial({ color: s.color, dashSize: 0.14, gapSize: 0.10, transparent: true, opacity: 0.55 });
      const rays = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const th = (k / 4) * Math.PI * 2 + 0.4;
        const rx = 1 + s.r * Math.cos(th);
        const rz = 2 - s.r * Math.sin(th);
        const rg = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(rx, 0.04, rz),
          new THREE.Vector3(rx, Z_VIS_SCALE_BOWL * s.c, rz),
        ]);
        const rl = new THREE.Line(rg, rayMat);
        rl.computeLineDistances();
        rays.add(rl);
      }
      group.add(floorLine, elevLine, rays);
      group.visible = false;
      this.ringsGroup.add(group);
      this.rings[s.c] = { group, floorLine, elevLine, rays, spec: s };
    }
    this.scene.add(this.ringsGroup);

    this.radiusBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.radiusBar.rotation.z = Math.PI / 2;
    this.radiusBar.visible = false;
    this.scene.add(this.radiusBar);

    // Bright dashed red mistake ring (r = 4 when c = 4) implemented as 32 glowing red segments on the floor
    this.mistakeRing = new THREE.Group();
    const mMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
    const nDash = 36;
    for (let i = 0; i < nDash; i++) {
      const a0 = (i / nDash) * Math.PI * 2;
      const a1 = ((i + 0.55) / nDash) * Math.PI * 2;
      const p0 = new THREE.Vector3(1 + 4.0 * Math.cos(a0), 0.06, 2 - 4.0 * Math.sin(a0));
      const p1 = new THREE.Vector3(1 + 4.0 * Math.cos(a1), 0.06, 2 - 4.0 * Math.sin(a1));
      const seg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 2, 0.045, 8, false), mMat);
      this.mistakeRing.add(seg);
    }
    this.mistakeRing.visible = false;
    this.scene.add(this.mistakeRing);
  }

  _buildTangentSlices() {
    const mkTube = (fn, color, radius = 0.042) => {
      const pts = [];
      for (let i = -30; i <= 30; i++) pts.push(fn(i * 0.1));
      const curve = new THREE.CatmullRomCurve3(pts);
      return new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 8, false), new THREE.MeshBasicMaterial({ color }));
    };

    this.xSliceCurve = mkTube((x) => new THREE.Vector3(x + 1, Z_VIS_SCALE_BOWL * (x * x) + 0.03, 2), 0x52d6ff, 0.035);
    this.ySliceCurve = mkTube((y) => new THREE.Vector3(1, Z_VIS_SCALE_BOWL * (y * y) + 0.03, 2 - y), 0xff7b89, 0.035);
    this.xSliceCurve.visible = false;
    this.ySliceCurve.visible = false;
    this.scene.add(this.xSliceCurve, this.ySliceCurve);

    this.tangentRodX = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 12), new THREE.MeshBasicMaterial({ color: 0x7be8ff }));
    this.tangentRodX.rotation.z = Math.PI / 2;
    this.tangentRodX.visible = false;

    this.tangentRodY = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 12), new THREE.MeshBasicMaterial({ color: 0xff8fa3 }));
    this.tangentRodY.rotation.x = Math.PI / 2;
    this.tangentRodY.visible = false;
    this.scene.add(this.tangentRodX, this.tangentRodY);

    // Thick glowing tubes for saddle rise (green along x) and fall (coral along y)
    this.saddleRiseLine = mkTube((x) => new THREE.Vector3(x, 1.88 + Z_VIS_SCALE_SADDLE * (x * x), 0), 0x4ef0a2, 0.052);
    this.saddleFallLine = mkTube((y) => new THREE.Vector3(0, 1.88 + Z_VIS_SCALE_SADDLE * (-y * y), -y), 0xff5c70, 0.052);
    this.saddleRiseLine.visible = false;
    this.saddleFallLine.visible = false;
    this.scene.add(this.saddleRiseLine, this.saddleFallLine);

    // Flat tangent disk at saddle origin (0,0)
    this.saddleFlatDisk = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    this.saddleFlatDisk.rotation.x = -Math.PI / 2;
    this.saddleFlatDisk.position.set(0, 1.87, 0);
    this.saddleFlatDisk.visible = false;
    this.scene.add(this.saddleFlatDisk);
  }

  _buildMarkers() {
    this.centerBeacon = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.04, 32),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffaa00, emissiveIntensity: 0.75 })
    );
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.25, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe49c, metalness: 0.6, roughness: 0.25 })
    );
    pole.position.y = 0.62;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 0.9, roughness: 0.15 })
    );
    gem.position.y = 1.32;
    this.centerBeacon.add(disc, pole, gem);
    this.centerBeacon.position.set(1, 0, 2);
    this.centerBeacon.visible = false;
    this.centerGem = gem;
    this.scene.add(this.centerBeacon);

    this.originCross = new THREE.Group();
    const barGeo = new THREE.BoxGeometry(0.7, 0.06, 0.12);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xff5964 });
    const b1 = new THREE.Mesh(barGeo, barMat); b1.rotation.y = Math.PI / 4;
    const b2 = new THREE.Mesh(barGeo, barMat); b2.rotation.y = -Math.PI / 4;
    this.originCross.add(b1, b2);
    this.originCross.position.set(0, 0.05, 0);
    this.originCross.visible = false;
    this.scene.add(this.originCross);

    this.tapeX = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.09), new THREE.MeshBasicMaterial({ color: 0x52d6ff }));
    this.tapeY = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0xff7b89 }));
    this.tapeX.visible = false;
    this.tapeY.visible = false;
    this.scene.add(this.tapeX, this.tapeY);

    this.pillarsGroup = new THREE.Group();
    this.pillars = [];
    const pMat = new THREE.MeshStandardMaterial({ color: 0x52d6ff, emissive: 0x165a8a, emissiveIntensity: 0.45, transparent: true, opacity: 0.85 });
    for (let ix = -3; ix <= 3; ix += 1.5) {
      for (let iy = -3; iy <= 3; iy += 1.5) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 12), pMat);
        m.position.set(ix, 0.5, -iy);
        m.userData = { x: ix, y: iy, h: Z_VIS_SCALE_TERRAIN * hillsZ(ix, iy) };
        this.pillarsGroup.add(m);
        this.pillars.push(m);
      }
    }
    this.pillarsGroup.visible = false;
    this.scene.add(this.pillarsGroup);
  }

  _buildPip() {
    this.pip = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0f4fa, roughness: 0.32, metalness: 0.15 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xe6a832, roughness: 0.28, metalness: 0.72 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a263b, roughness: 0.4, metalness: 0.3 });
    const tealMat = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.35, metalness: 0.2 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x62f2ff });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.24, 12, 20), bodyMat);
    torso.position.y = 0.48;
    torso.castShadow = true;
    this.pip.add(torso);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 10, 24), tealMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.65;
    this.pip.add(collar);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.14), brassMat);
    pack.position.set(0, 0.49, -0.17);
    this.pip.add(pack);

    this.pipHead = new THREE.Group();
    this.pipHead.position.y = 0.84;
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 20), bodyMat);
    helm.scale.set(1.06, 0.96, 1.0);
    helm.castShadow = true;
    this.pipHead.add(helm);

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16, 0, Math.PI * 2, 0.35, 1.15), darkMat);
    visor.rotation.x = Math.PI / 2 - 0.85;
    visor.position.set(0, 0.0, 0.05);
    this.pipHead.add(visor);

    this.eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), this.eyeMat);
    this.eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), this.eyeMat);
    this.eyeL.position.set(-0.068, 0.02, 0.195);
    this.eyeR.position.set(0.068, 0.02, 0.195);
    this.pipHead.add(this.eyeL, this.eyeR);

    this.antenna = new THREE.Group();
    this.antenna.position.set(0, 0.20, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 8), brassMat);
    stem.position.y = 0.09;
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 0.8 }));
    tip.position.y = 0.20;
    this.antenna.add(stem, tip);
    this.pipHead.add(this.antenna);
    this.pip.add(this.pipHead);

    this.armL = new THREE.Group();
    this.armL.position.set(-0.22, 0.58, 0);
    const armMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 8, 12), brassMat);
    armMeshL.position.y = -0.11;
    this.armL.add(armMeshL);

    this.armR = new THREE.Group();
    this.armR.position.set(0.22, 0.58, 0);
    const armMeshR = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 8, 12), brassMat);
    armMeshR.position.y = -0.11;
    this.armR.add(armMeshR);

    this.legL = new THREE.Group();
    this.legL.position.set(-0.09, 0.26, 0);
    const legMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.18, 8, 12), darkMat);
    legMeshL.position.y = -0.12;
    this.legL.add(legMeshL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.09, 0.26, 0);
    const legMeshR = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.18, 8, 12), darkMat);
    legMeshR.position.y = -0.12;
    this.legR.add(legMeshR);

    this.pip.add(this.armL, this.armR, this.legL, this.legR);

    this.pipShadowDot = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.24, 32),
      new THREE.MeshBasicMaterial({ color: 0x62f2ff, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    this.pipShadowDot.rotation.x = -Math.PI / 2;
    this.pipShadowDot.position.y = 0.02;
    this.pip.add(this.pipShadowDot);

    this.scene.add(this.pip);
  }

  posePip({ x, y, zVis, yaw = 0, walkPhase = 0, walkAmp = 0, headPitch = 0, headYaw = 0, armRaiseL = 0, armRaiseR = 0, squash = 1, blink = 1, eyeColor = 0x62f2ff, scale = 0.88 }) {
    this.pip.position.set(x, zVis, -y);
    this.pip.rotation.y = yaw;
    this.pip.scale.set(scale / Math.sqrt(squash), scale * squash, scale / Math.sqrt(squash));
    this.legL.rotation.x = Math.sin(walkPhase) * 0.65 * walkAmp;
    this.legR.rotation.x = -Math.sin(walkPhase) * 0.65 * walkAmp;
    this.armL.rotation.x = -Math.sin(walkPhase) * 0.45 * walkAmp - armRaiseL;
    this.armR.rotation.x = Math.sin(walkPhase) * 0.45 * walkAmp - armRaiseR;
    this.armL.rotation.z = armRaiseL * 0.28;
    this.armR.rotation.z = -armRaiseR * 0.28;
    this.pipHead.rotation.x = headPitch;
    this.pipHead.rotation.y = headYaw;
    this.eyeL.scale.y = blink;
    this.eyeR.scale.y = blink;
    this.eyeMat.color.setHex(eyeColor);
  }

  projectToScreen(mathX, mathY, zVis) {
    const v = new THREE.Vector3(mathX, zVis, -mathY);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * 1920,
      y: (-v.y * 0.5 + 0.5) * 1080,
      visible: v.z < 1.0,
    };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
