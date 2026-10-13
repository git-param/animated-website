import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, SphereGeometry, Mesh, Group, ShaderMaterial,
  MeshStandardMaterial, MeshBasicMaterial, TextureLoader, CanvasTexture, SRGBColorSpace, HemisphereLight,
  DirectionalLight, PMREMGenerator, Vector2,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const VERT = /* glsl */ `
  uniform float uBend; uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin((uv.x - .5) * 3.14159) * .14 * uBend + sin(uv.y * 3. + uTime * .6) * .012;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  }`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap; uniform float uReveal; uniform float uSheen; uniform vec2 uLight;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    float wipe = smoothstep(0., .2, uReveal * 1.2 - vUv.y);
    vec2 d = vUv - uLight;
    float sheen = exp(-dot(d, d) * 11.) * uSheen * .2;
    vec3 col = clamp(t.rgb + sheen * t.a, 0., 1.);
    gl_FragColor = vec4(col, t.a * wipe);
    #include <colorspace_fragment>
  }`;

/** Soft blob used as a contact/drop shadow for the flat product planes. */
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Hero WebGL scene: three art-directed image planes (supplied photography only) at different depths,
 * plus two lit 3D spheres echoing the two-dot Two Good Co mark. Owns its full lifecycle.
 */
export class HeroScene {
  constructor(canvas, { images, quality = 'high', reduced = false, onLost, onRestored }) {
    this.canvas = canvas;
    this.images = images;
    this.quality = quality;
    this.reduced = reduced;
    this.onLost = onLost;
    this.onRestored = onRestored;
    this.pointer = new Vector2();
    this.pointerT = new Vector2();
    this.scroll = 0;
    this.active = false;
    this.lastInput = 0;
    this.intro = 0; // 0..1 camera push-in, driven by GSAP
    this.disposables = [];
    this.items = [];
    this.clock = {
      last: performance.now(), elapsedTime: 0,
      getDelta() { const n = performance.now(); const d = (n - this.last) / 1000; this.last = n; this.elapsedTime += Math.min(d, 0.05); return d; },
    };
    this.frameTimes = [];
  }

  async init() {
    const low = this.quality === 'low';
    this.renderer = new WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: !low, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.maxDpr = low ? 1.25 : 1.75;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0, 10);

    // Lighting
    this.scene.add(new HemisphereLight(0xfff6ea, 0x8a8472, 1.1));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 4, 5);
    this.scene.add(key);
    if (!low) {
      const pmrem = new PMREMGenerator(this.renderer);
      const env = new RoomEnvironment();
      this.scene.environment = pmrem.fromScene(env, 0.04).texture;
      this.scene.environmentIntensity = 0.55;
      env.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      pmrem.dispose();
      this.disposables.push(this.scene.environment);
    }

    // Textures
    const loader = new TextureLoader();
    const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
    const [book, bottle, tote] = await Promise.all([load(this.images.book), load(this.images.bottle), load(this.images.tote)]);
    const aniso = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    [book, bottle, tote].forEach((t) => { t.colorSpace = SRGBColorSpace; t.anisotropy = aniso; this.disposables.push(t); });

    this.sheenUniform = { value: new Vector2(0.5, 0.5) };
    const shTex = shadowTexture();
    this.disposables.push(shTex);
    this.world = new Group();
    this.scene.add(this.world);

    const seg = low ? 8 : 20;
    const makeItem = (tex, aspect, name) => {
      const group = new Group();
      const geo = new PlaneGeometry(aspect, 1, seg, seg);
      const mat = new ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
        uniforms: { uMap: { value: tex }, uReveal: { value: 0 }, uBend: { value: 0 }, uTime: { value: 0 }, uSheen: { value: low ? 0.3 : 0.55 }, uLight: this.sheenUniform },
      });
      const mesh = new Mesh(geo, mat);
      const shMat = new MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0 });
      const shadow = new Mesh(new PlaneGeometry(aspect * 1.25, 0.9), shMat);
      shadow.position.set(0.05, -0.55, -0.05);
      group.add(shadow, mesh);
      this.world.add(group);
      this.disposables.push(geo, mat, shadow.geometry, shMat);
      const item = { name, group, mesh, mat, shMat, aspect };
      this.items.push(item);
      return item;
    };
    this.book = makeItem(book, 980 / 1280, 'book');
    this.bottle = makeItem(bottle, 489 / 623, 'bottle');
    this.tote = makeItem(tote, 552 / 745, 'tote');

    // Two lit spheres: the "two" in Two Good
    const sGeo = new SphereGeometry(1, low ? 24 : 64, low ? 16 : 48);
    this.disposables.push(sGeo);
    const mkSphere = (color, rough) => {
      const m = new MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
      this.disposables.push(m);
      const mesh = new Mesh(sGeo, m);
      this.world.add(mesh);
      return mesh;
    };
    this.sphereA = mkSphere(0x0c8751, 0.38);
    this.sphereB = mkSphere(0x0b0b0a, 0.3);

    this.layout();
    this._bind();
    this.resize();
    this.render();
    return this;
  }

  /** Recompose for landscape vs portrait; positions in world units (camera z=10, fov 30). */
  layout() {
    const portrait = this.camera.aspect < 0.85;
    const L = portrait
      ? {
        book: { h: 2.1, x: 0.5, y: 1.15, z: -1.0, ry: -0.16 },
        bottle: { h: 1.45, x: -0.32, y: 0.5, z: 0.7, ry: 0.1 },
        tote: { h: 1.25, x: -0.5, y: 1.75, z: -0.5, ry: 0.18 },
        a: { r: 0.17, x: 0.9, y: 0.25, z: 1.6 }, b: { r: 0.12, x: -0.95, y: 0.2, z: 1.2 },
      }
      : {
        book: { h: 3.1, x: 2.8, y: 1.15, z: -1.2, ry: -0.2 },
        bottle: { h: 2.6, x: -0.15, y: 0.95, z: 0.8, ry: 0.12 },
        tote: { h: 2.45, x: -3.2, y: 1.3, z: -0.4, ry: 0.2 },
        a: { r: 0.36, x: 1.5, y: 1.55, z: 1.8 }, b: { r: 0.24, x: -1.75, y: 1.7, z: 1.2 },
      };
    [['book', this.book], ['bottle', this.bottle], ['tote', this.tote]].forEach(([k, it]) => {
      const c = L[k];
      it.base = c;
      it.mesh.scale.setScalar(c.h);
      it.group.scale.setScalar(1);
      it.group.children[0].scale.setScalar(c.h);
      it.group.children[0].position.set(0.04 * c.h, -0.5 * c.h, -0.05);
      it.group.position.set(c.x, c.y, c.z);
      it.group.rotation.set(0, c.ry, k === 'book' ? 0.04 : k === 'tote' ? -0.04 : 0);
    });
    this.sphereA.scale.setScalar(L.a.r); this.sphereA.base = L.a;
    this.sphereB.scale.setScalar(L.b.r); this.sphereB.base = L.b;
    this.sphereA.position.set(L.a.x, L.a.y, L.a.z);
    this.sphereB.position.set(L.b.x, L.b.y, L.b.z);
  }

  _bind() {
    this._onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointerT.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      this.lastInput = performance.now();
    };
    this._onLeave = () => { this.lastInput = 0; };
    this._onLost = (e) => { e.preventDefault(); this.setActive(false); this.onLost?.(); };
    this._onRestored = () => { this.onRestored?.(); this.render(); };
    this._onVis = () => { if (document.hidden) this._stop(); else if (this.active) this._start(); };
    if (!this.reduced) {
      window.addEventListener('pointermove', this._onMove, { passive: true });
      window.addEventListener('pointerleave', this._onLeave);
    }
    this.canvas.addEventListener('webglcontextlost', this._onLost);
    this.canvas.addEventListener('webglcontextrestored', this._onRestored);
    document.addEventListener('visibilitychange', this._onVis);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas.parentElement);
  }

  resize() {
    const p = this.canvas.parentElement;
    const w = p.clientWidth, h = p.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDpr));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.layout();
    if (!this.running) this.render();
  }

  setScroll(p) { this.scroll = p; if (!this.running) this.render(); }
  setIntro(v) { this.intro = v; if (!this.running) this.render(); }
  setReveal(i, v) { const it = this.items[i]; if (it) { it.mat.uniforms.uReveal.value = v; it.shMat.opacity = v * 0.2; if (!this.running) this.render(); } }

  setActive(on) {
    this.active = on;
    if (on && !document.hidden && !this.reduced) this._start(); else this._stop();
  }
  _start() { if (this.running) return; this.running = true; this.clock.getDelta(); this.renderer.setAnimationLoop(() => this._tick()); }
  _stop() { if (!this.running) return; this.running = false; this.renderer?.setAnimationLoop(null); }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._adapt(dt);
    this.render(dt);
  }

  /** If frames are consistently slow, drop to a lighter pixel ratio once. */
  _adapt(dt) {
    if (this.degraded) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length >= 90) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.frameTimes.length = 0;
      if (avg > 0.034) { this.degraded = true; this.maxDpr = 1; this.resize(); }
    }
  }

  render(dt = 0) {
    const t = this.clock.elapsedTime;
    const idle = !this.lastInput || performance.now() - this.lastInput > 2500;
    if (!this.reduced) {
      if (idle) this.pointerT.set(Math.sin(t * 0.35) * 0.5, Math.cos(t * 0.27) * 0.3);
      const k = 1 - Math.exp(-dt * 3.5);
      this.pointer.lerp(this.pointerT, dt ? k : 1);
    }
    const px = this.pointer.x, py = this.pointer.y, s = this.scroll;
    const push = (1 - this.intro) * 1.8;
    this.camera.position.set(px * 0.55, py * 0.3 + s * 1.2, 10 + push - s * 3.2);
    this.camera.lookAt(0, s * 0.9, 0);
    this.sheenUniform.value.set(0.5 + px * 0.45, 0.5 + py * 0.45);
    const bend = Math.abs(px) * 0.5 + s * 0.5;
    this.items.forEach((it, i) => {
      const f = this.reduced ? 0 : Math.sin(t * 0.6 + i * 1.7);
      it.group.position.y = it.base.y + f * 0.06 + s * (0.5 + i * 0.35);
      it.group.rotation.y = it.base.ry + px * 0.1 * (i % 2 ? 1 : -1);
      it.mat.uniforms.uBend.value = bend;
      it.mat.uniforms.uTime.value = t;
    });
    [this.sphereA, this.sphereB].forEach((m, i) => {
      m.position.y = m.base.y + (this.reduced ? 0 : Math.sin(t * 0.8 + i * 2.4) * 0.12) + s * 1.1;
      m.position.x = m.base.x + px * (0.25 + i * 0.15);
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._stop();
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerleave', this._onLeave);
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    document.removeEventListener('visibilitychange', this._onVis);
    this.ro?.disconnect();
    this.disposables.forEach((d) => d?.dispose?.());
    this.disposables.length = 0;
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }
}
