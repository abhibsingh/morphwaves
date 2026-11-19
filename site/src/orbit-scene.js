// Morphwaves hero: a slowly rotating Earth with satellites in low, medium and
// geostationary orbit sending signals to ground stations.
// Source file. Bundled to site/assets/js/orbit-scene.js by scripts/bundle-scene.sh.
// Earth imagery: NASA Blue Marble and Black Marble (public domain).

import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, SphereGeometry, ShaderMaterial,
  TextureLoader, SRGBColorSpace, Vector3, Color, AdditiveBlending, BackSide, BufferGeometry,
  Float32BufferAttribute, Line, LineLoop, LineBasicMaterial, Points, PointsMaterial, BoxGeometry,
  MeshStandardMaterial, DirectionalLight, AmbientLight, ConeGeometry, RingGeometry, MeshBasicMaterial,
  DoubleSide, MathUtils, Quaternion, CylinderGeometry,
} from "three";
const UP = new Vector3(0, 1, 0);

const DEG = Math.PI / 180;
const R_LEO = 1.13, R_MEO = 2.45, R_GEO = 3.75; // compressed scale, labelled "not to scale"

const STAGES = [
  { id: "leo", dist: 4.9, elev: 14, title: "Low Earth orbit", alt: "Up to 2,000 km",
    text: "A satellite circles Earth in about 90 to 120 minutes, so each ground station sees it for only a few minutes per pass." },
  { id: "meo", dist: 9.4, elev: 18, title: "Medium Earth orbit", alt: "Around 20,000 km",
    text: "Navigation constellations such as GPS and Galileo fly here. Passes last hours, and stations track several satellites at once." },
  { id: "geo", dist: 13.6, elev: 16, title: "Geostationary orbit", alt: "35,786 km",
    text: "One orbit takes exactly a day, so the satellite holds still above one point on the equator and the link never drops." },
  { id: "all", dist: 13.6, elev: 22, title: "Every orbit, one ground segment", alt: "LEO, MEO and GEO",
    text: "Fast handovers, long tracks and constant links. Each orbit asks something different of the software on the ground." },
];
const HOLD = 8.5, MOVE = 2.6; // seconds per stage, seconds per camera move

const STATIONS = [ // illustrative ground station locations, unnamed
  [13.0, 77.6], [78.2, 15.4], [-53.0, -70.9], [64.8, -147.7], [-25.9, 27.7], [-35.4, 149.0],
  [40.4, -4.2], [21.4, -158.0], [-7.3, 72.4], [35.7, 139.7],
];

function latLonToVec(lat, lon, r = 1) {
  const la = lat * DEG, lo = lon * DEG;
  return new Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

const earthVert = /* glsl */`
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0); vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const earthFrag = /* glsl */`
  uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D waterMap;
  uniform vec3 sunDir;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    float ndl = dot(n, sunDir);
    float dayMix = smoothstep(-0.18, 0.22, ndl);
    vec3 day = texture2D(dayMap, vUv).rgb * (0.10 + 1.05 * max(ndl, 0.0));
    vec3 night = texture2D(nightMap, vUv).rgb;
    night = pow(night, vec3(1.35)) * 3.2 * vec3(1.0, 0.84, 0.58);
    vec3 viewDir = normalize(cameraPosition - vPosW);
    float water = texture2D(waterMap, vUv).r;
    float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 140.0) * water * 0.32 * dayMix;
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    vec3 c = mix(night, day, dayMix) + spec * vec3(1.0, 0.95, 0.85) + rim * vec3(0.25, 0.5, 0.9) * 0.35 * dayMix;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const atmoVert = /* glsl */`
  varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0); vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const atmoFrag = /* glsl */`
  uniform vec3 sunDir; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    float f = pow(1.0 - abs(dot(n, v)), 2.6);
    float lit = 0.35 + 0.65 * smoothstep(-0.3, 0.5, dot(n, sunDir));
    gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * f * lit * 0.85, f * lit);
  }`;
const beamVert = /* glsl */`
  varying float vT;
  void main() { vT = 1.0 - uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const beamFrag = /* glsl */`
  uniform float time; uniform float opacity; uniform vec3 color; varying float vT;
  void main() {
    float pulse = smoothstep(0.62, 1.0, fract(vT * 4.0 - time * 1.25));
    float base = 0.16;
    float fadeEnds = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.92, vT);
    gl_FragColor = vec4(color, (base + pulse * 0.9) * fadeEnds * opacity);
  }`;
const coneFrag = /* glsl */`
  uniform float opacity; varying vec2 vUv;
  void main() { float a = vUv.y * 0.85 + 0.15; gl_FragColor = vec4(0.09, 0.72, 0.83, a * 0.06 * opacity); }`;
const coneVert = /* glsl */`
  varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function makeSatellite() {
  const g = new Group();
  const body = new Mesh(new BoxGeometry(0.034, 0.034, 0.05), new MeshStandardMaterial({ color: 0xd2b06a, metalness: 0.7, roughness: 0.35 }));
  const panelMat = new MeshStandardMaterial({ color: 0x23457a, metalness: 0.35, roughness: 0.45, emissive: 0x0a1a33 });
  const panelGeo = new BoxGeometry(0.12, 0.003, 0.04);
  const p1 = new Mesh(panelGeo, panelMat); p1.position.x = 0.082;
  const p2 = new Mesh(panelGeo, panelMat); p2.position.x = -0.082;
  const dish = new Mesh(new ConeGeometry(0.014, 0.016, 12, 1, true), new MeshStandardMaterial({ color: 0xe8eef5, metalness: 0.2, roughness: 0.5, side: DoubleSide }));
  dish.position.y = -0.026; dish.rotation.x = Math.PI;
  const glint = new Mesh(new SphereGeometry(0.012, 8, 8), new MeshBasicMaterial({ color: 0x9fe8f3, transparent: true, opacity: 0.9 }));
  g.add(body, p1, p2, dish, glint);
  return g;
}

// Software rendering (no GPU) makes a 3D scene choppy and battery hungry, so
// those devices get the static poster instead. Add ?scene=force to override.
function hasHardwareGL() {
  if (/[?&]scene=force\b/.test(location.search)) return true;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch (e) { return false; }
}

export function mountOrbitScene(container, ui = {}) {
  if (!hasHardwareGL()) return null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return null; // no WebGL: caller keeps the static fallback
  }
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  const minFrameMs = small ? 1000 / 30 - 1 : 0; // 30 fps on phones and low power devices
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.05, 400);
  const sunDir = new Vector3(1, 0.28, 0.22).normalize();
  scene.add(new AmbientLight(0x6b7f99, 0.55));
  const sun = new DirectionalLight(0xffffff, 2.2); sun.position.copy(sunDir).multiplyScalar(30); scene.add(sun);

  // Stars: sparse and faint
  {
    const n = 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new Vector3().randomDirection().multiplyScalar(160 + Math.random() * 60);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    scene.add(new Points(g, new PointsMaterial({ color: 0xa9b7c8, size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0.55 })));
  }

  const system = new Group(); system.rotation.z = -16 * DEG; system.rotation.x = 8 * DEG; scene.add(system);
  const earth = new Group(); system.add(earth);

  const loader = new TextureLoader();
  const tex = (url) => { const t = loader.load(url, onTex); t.anisotropy = 4; return t; };
  let loaded = 0;
  function onTex() { if (++loaded >= 3) { container.classList.add("is-ready"); requestRender(); } }
  const base = ui.textureBase || "/assets/img/earth/";
  const day = tex(base + "earth-day-2k.jpg"); day.colorSpace = SRGBColorSpace;
  const night = tex(base + "earth-night-2k.jpg"); night.colorSpace = SRGBColorSpace;
  const water = tex(base + "earth-water-1k.jpg");

  const earthMat = new ShaderMaterial({ uniforms: { dayMap: { value: day }, nightMap: { value: night }, waterMap: { value: water }, sunDir: { value: sunDir } }, vertexShader: earthVert, fragmentShader: earthFrag });
  earth.add(new Mesh(new SphereGeometry(1, small ? 64 : 96, small ? 44 : 64), earthMat));
  const atmo = new Mesh(new SphereGeometry(1.035, 64, 48), new ShaderMaterial({ uniforms: { sunDir: { value: sunDir } }, vertexShader: atmoVert, fragmentShader: atmoFrag, blending: AdditiveBlending, side: BackSide, transparent: true, depthWrite: false }));
  system.add(atmo);
  earth.rotation.y = -55 * DEG; // start with India and the Indian Ocean facing the camera

  // Ground stations (children of Earth, so they rotate with it)
  const stations = STATIONS.map(([lat, lon]) => {
    const p = latLonToVec(lat, lon, 1.002);
    const marker = new Group();
    const dot = new Mesh(new SphereGeometry(0.009, 10, 10), new MeshBasicMaterial({ color: 0x16b8d4 }));
    const ring = new Mesh(new RingGeometry(0.016, 0.022, 28), new MeshBasicMaterial({ color: 0x16b8d4, transparent: true, opacity: 0.7, side: DoubleSide, depthWrite: false }));
    marker.add(dot, ring);
    marker.position.copy(p);
    marker.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), p.clone().normalize());
    earth.add(marker);
    return { marker, ring, local: p, world: new Vector3(), normal: new Vector3() };
  });

  // Orbits
  const ringMat = (op) => new LineBasicMaterial({ color: 0x6f8aa8, transparent: true, opacity: op, depthWrite: false });
  function circle(r) {
    const pts = []; for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push(r * Math.cos(a), 0, -r * Math.sin(a)); }
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(pts, 3)); return g;
  }
  const shells = { leo: [], meo: [], geo: [] };
  const sats = [];
  function addPlane(kind, r, incl, raan, count, period, phase = 0, parent = system) {
    const node = new Group(); node.rotation.y = raan * DEG;
    const tilt = new Group(); tilt.rotation.x = incl * DEG; node.add(tilt); parent.add(node);
    const ring = new LineLoop(circle(r), ringMat(0)); tilt.add(ring);
    shells[kind].push(ring);
    for (let i = 0; i < count; i++) {
      const s = makeSatellite(); tilt.add(s);
      sats.push({ kind, obj: s, r, period, u: phase + (i / count) * Math.PI * 2, world: new Vector3(), vis: 0 });
    }
  }
  // LEO: inclined, polar and sun synchronous style planes
  addPlane("leo", R_LEO, 53, 0, 3, 26, 0.0);
  addPlane("leo", R_LEO * 1.015, 97.5, 60, 3, 28, 1.1);
  addPlane("leo", R_LEO * 1.03, 30, 125, 2, 24, 2.3);
  // MEO: three planes at 55 degrees, like GPS and Galileo
  addPlane("meo", R_MEO, 55, 10, 3, 74, 0.2);
  addPlane("meo", R_MEO, 55, 130, 3, 74, 1.3);
  addPlane("meo", R_MEO, 55, 250, 3, 74, 2.4);
  // GEO: equatorial, attached to Earth so each holds still over one longitude
  const geoLongitudes = [83, 0, -75, 150];
  {
    const ring = new LineLoop(circle(R_GEO), ringMat(0)); system.add(ring); shells.geo.push(ring);
    for (const lon of geoLongitudes) {
      const s = makeSatellite(); s.position.copy(latLonToVec(0, lon, R_GEO)); earth.add(s);
      const sat = { kind: "geo", obj: s, r: R_GEO, period: 0, u: 0, world: new Vector3(), vis: 0, fixed: true };
      // coverage cone pointing at Earth's centre
      const d = R_GEO, half = Math.asin(1 / d), h = d - 0.45;
      const coneGeo = new ConeGeometry(h * Math.tan(half), h, 48, 1, true);
      coneGeo.translate(0, -h / 2, 0);
      const cone = new Mesh(coneGeo, new ShaderMaterial({ uniforms: { opacity: { value: 0 } }, vertexShader: coneVert, fragmentShader: coneFrag, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
      cone.position.copy(s.position);
      cone.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), s.position.clone().normalize());
      earth.add(cone);
      sat.cone = cone;
      sats.push(sat);
    }
  }

  // Signal beams, pooled
  const beams = [];
  const beamGeo = new CylinderGeometry(1, 1, 1, 8, 1, true); beamGeo.translate(0, 0.5, 0); // base at y=0 (station), tip at y=1 (satellite)
  function makeBeam() {
    const m = new ShaderMaterial({ uniforms: { time: { value: 0 }, opacity: { value: 0 }, color: { value: new Color(0x35d3ea) } }, vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const mesh = new Mesh(beamGeo, m); mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    return { mesh, m, op: 0, target: 0 };
  }
  for (let i = 0; i < 28; i++) beams.push(makeBeam());

  // Stage control
  let stageIndex = 0, stageStart = 0, stageWall = performance.now(), autoplay = !reduce, clock = 0, last = performance.now();
  const camFrom = { dist: STAGES[0].dist, elev: STAGES[0].elev }, camTo = { ...camFrom };
  const visibleKinds = () => {
    const id = STAGES[stageIndex].id;
    if (id === "leo") return ["leo"]; if (id === "meo") return ["leo", "meo"]; return ["leo", "meo", "geo"];
  };
  const emittingKinds = () => { const id = STAGES[stageIndex].id; return id === "all" ? ["leo", "meo", "geo"] : [id]; };

  function setStage(i, jump = false) {
    stageIndex = i; stageStart = clock; stageWall = performance.now();
    camFrom.dist = jump ? STAGES[i].dist : cam.dist; camFrom.elev = jump ? STAGES[i].elev : cam.elev;
    camTo.dist = STAGES[i].dist; camTo.elev = STAGES[i].elev;
    if (jump) { cam.dist = camTo.dist; cam.elev = camTo.elev; }
    ui.onStage && ui.onStage(i, STAGES[i]);
    requestRender();
  }
  const cam = { dist: STAGES[0].dist, elev: STAGES[0].elev };

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // On wide layouts push the Earth to the right so text sits on open space
    const shift = ui.shiftRight && w > 900 ? Math.min(0.26, (w / h - 1) * 0.2) : 0;
    const lift = w > 900 ? h * 0.06 : (ui.mobileOffsetY ? ui.mobileOffsetY(w, h) : 0);
    if (shift > 0 || lift) camera.setViewOffset(w, h, -w * shift, lift, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    requestRender();
  }
  new ResizeObserver(resize).observe(container);

  const tmp = new Vector3(), tmp2 = new Vector3(), q = new Quaternion();
  const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  function update(dt) {
    clock += dt;
    // stage timing
    const wall = (performance.now() - stageWall) / 1000;
    if (autoplay && stageIndex < STAGES.length - 1 && wall > HOLD + MOVE) setStage(stageIndex + 1);
    const k = ease(MathUtils.clamp(wall / MOVE, 0, 1));
    cam.dist = MathUtils.lerp(camFrom.dist, camTo.dist, k);
    cam.elev = MathUtils.lerp(camFrom.elev, camTo.elev, k);
    const el = cam.elev * DEG;
    camera.position.set(0, Math.sin(el) * cam.dist, Math.cos(el) * cam.dist);
    camera.lookAt(0, 0, 0);

    earth.rotation.y += dt * (Math.PI * 2 / 150); // one turn in 150 s, eastward
    const vk = visibleKinds(), ek = emittingKinds();
    const fadeSpeed = Math.min(1, dt * 2.2);

    for (const kind of ["leo", "meo", "geo"]) {
      const on = vk.includes(kind), focus = ek.includes(kind);
      for (const r of shells[kind]) r.material.opacity += ((on ? (focus ? 0.55 : 0.22) : 0) - r.material.opacity) * fadeSpeed;
    }
    const satScale = MathUtils.clamp(cam.dist / 4.3, 1.1, 3.0);
    for (const s of sats) {
      const on = vk.includes(s.kind);
      s.vis += ((on ? 1 : 0) - s.vis) * fadeSpeed;
      s.obj.visible = s.vis > 0.02;
      if (!s.fixed) {
        s.u += dt * (Math.PI * 2 / s.period);
        s.obj.position.set(s.r * Math.cos(s.u), 0, -s.r * Math.sin(s.u));
      }
      s.obj.scale.setScalar(satScale * Math.max(s.vis, 0.001));
      s.obj.getWorldPosition(s.world);
      // keep panels facing the sun, body facing Earth
      s.obj.lookAt(tmp.set(0, 0, 0).applyMatrix4(system.matrixWorld));
      if (s.cone) s.cone.material.uniforms.opacity.value += (((ek.includes("geo")) ? 1 : 0) - s.cone.material.uniforms.opacity.value) * fadeSpeed;
    }

    for (const st of stations) {
      st.marker.getWorldPosition(st.world);
      st.normal.copy(st.world).normalize();
      st.ring.scale.setScalar(1 + 0.35 * Math.sin(clock * 2.4 + st.local.x * 9));
    }

    // assign beams: each emitting satellite links to its best visible station
    let bi = 0;
    const camDir = tmp2.copy(camera.position).normalize();
    for (const s of sats) {
      if (!ek.includes(s.kind) || s.vis < 0.5) continue;
      let best = null, bestEl = 0.16;
      for (const st of stations) {
        tmp.copy(s.world).sub(st.world).normalize();
        const elv = tmp.dot(st.normal);
        if (elv > bestEl) { bestEl = elv; best = st; }
      }
      if (!best || bi >= beams.length) continue;
      const b = beams[bi++];
      const len = s.world.distanceTo(best.world);
      b.mesh.position.copy(best.world);
      b.mesh.quaternion.setFromUnitVectors(UP, tmp.copy(s.world).sub(best.world).normalize());
      const w = 0.0035 * MathUtils.clamp(cam.dist / 4.3, 1, 3.2);
      b.mesh.scale.set(w, len, w);
      // hide beams whose station is on the far side of the planet
      const facing = best.normal.dot(camDir) > -0.05 ? 1 : 0.15;
      b.target = facing;
      b.used = true;
    }
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      if (i >= bi) b.target = 0;
      b.op += (b.target - b.op) * Math.min(1, dt * 4);
      b.m.uniforms.opacity.value = b.op;
      b.m.uniforms.time.value = clock;
      b.mesh.visible = b.op > 0.01;
    }
  }

  let running = false, inView = true, frame = 0, needsRender = true;
  function requestRender() { needsRender = true; if (!running) loop(); }
  let lastDraw = 0;
  function loop() {
    const now = performance.now();
    if (minFrameMs && !needsRender && now - lastDraw < minFrameMs) { frame = requestAnimationFrame(loop); return; }
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const animate = !reduce && inView && !document.hidden;
    if (animate || needsRender) {
      update(animate ? dt : 0);
      renderer.render(scene, camera);
      needsRender = false;
    }
    running = animate;
    if (animate) frame = requestAnimationFrame(loop);
  }
  new IntersectionObserver((e) => { inView = e[0].isIntersecting; if (inView) { last = performance.now(); requestRender(); } }, { threshold: 0.01 }).observe(container);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = performance.now(); requestRender(); } });

  resize();
  if (reduce) setStage(STAGES.length - 1, true); else setStage(0, true);

  return {
    stages: STAGES,
    go(i) { autoplay = false; setStage(i); },
    replay() { autoplay = !reduce; setStage(0, true); },
  };
}
