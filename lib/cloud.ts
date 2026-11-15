// The lidar field: one cloud of points that the whole page is drawn with.
// Every scene is a "target": a position, a normal and three numbers for each
// point. Showing another scene sends every point from where it is to its
// place in the next, so the page re-forms instead of cutting.
//
// Plain three.js, no React. components/world.tsx owns the one instance.

import type { BufferAttribute, Color, Matrix3, PerspectiveCamera, Points, Scene, ShaderMaterial, WebGLRenderer } from "three";
import type { Target } from "./targets";

type Three = typeof import("three");

const VERT = /* glsl */ `
  attribute vec3 positionB;
  attribute vec3 normalB;
  attribute vec3 metaA;   // class, tag, reveal order
  attribute vec3 metaB;
  attribute float seed;
  uniform float uMorph;
  uniform float uReveal;  // points with order under this are shown
  uniform float uTime;
  uniform float uHi;      // tag to pick out, or -1
  uniform vec2 uStreams;  // tag range of the streams that are flowing
  uniform vec2 uShift;    // where the scene sits in the frame
  uniform float uSize;
  uniform float uPixel;
  uniform mat3 uSpin;
  varying float vShade;
  varying float vCls;
  varying float vGlow;

  float ease(float t) { return t * t * (3.0 - 2.0 * t); }

  void main() {
    // Each point leaves a little after its neighbours and swings wide on the way.
    float t = clamp(uMorph * 1.6 - seed * 0.6, 0.0, 1.0);
    float e = ease(t);
    vec3 meta = e < 0.5 ? metaA : metaB;
    float cls = meta.x;
    vec3 a = mix(position, positionB, e);
    vec3 b = mix(normal, normalB, e);
    vec3 p;
    vec3 n;
    float on = 1.0;
    if (cls > 2.5 && cls < 4.5) {
      // A stream: this point travels from a to b, over and over.
      p = mix(a, b, fract(uTime * 0.22 + seed));
      n = vec3(0.0);
      on = step(uStreams.x, meta.y) * step(meta.y, uStreams.y);
    } else {
      vec3 drift = vec3(sin(seed * 91.7), cos(seed * 47.3), sin(seed * 23.1 + 1.7));
      p = a + drift * sin(e * 3.14159) * 0.14;
      n = normalize(b);
    }
    p = uSpin * p;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    float light = 1.0;
    float front = 1.0;
    if (dot(n, n) > 0.5) {
      vec3 vn = normalize(normalMatrix * (uSpin * n));
      // Points that face away are let go, so a shape reads as solid.
      front = smoothstep(-0.05, 0.3, dot(vn, normalize(-mv.xyz)));
      light = 0.5 + 0.5 * clamp(dot(vn, normalize(vec3(0.45, 0.8, 0.5))), 0.0, 1.0);
    }
    float shown = step(meta.z, uReveal);
    vGlow = shown * smoothstep(0.07, 0.0, uReveal - meta.z) * step(uReveal, 1.0);
    float picked = uHi < -0.5 ? 1.0 : (abs(meta.y - uHi) < 0.5 ? 1.0 : 0.3);
    if (uHi > -0.5 && abs(meta.y - uHi) < 0.5) vGlow = max(vGlow, 0.55);
    vShade = front * light * shown * on * picked;
    vCls = cls;

    gl_Position = projectionMatrix * mv;
    gl_Position.xy += uShift * gl_Position.w;
    gl_PointSize = uSize * uPixel * (0.6 + 0.5 * light + vGlow) / -mv.z;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform vec3 uAmber;
  uniform vec3 uTpu;
  varying float vShade;
  varying float vCls;
  varying float vGlow;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25 || vShade < 0.02) discard;
    vec3 col = uInk;
    if (vCls > 0.5) col = uAccent;
    if (vCls > 1.5) col = uTpu;
    if (vCls > 2.5) col = uAccent;
    if (vCls > 3.5) col = uAmber;
    col = mix(col, uAccent, vGlow * step(vCls, 2.5));
    gl_FragColor = vec4(col, min(1.0, vShade * 1.1 + vGlow) * smoothstep(0.25, 0.16, d));
  }
`;

export class Cloud {
  readonly count: number;
  private three!: Three;
  private renderer!: WebGLRenderer;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private points!: Points;
  private material!: ShaderMaterial;
  private raf = 0;
  private last = 0;
  private time = 0;
  private dead = false;
  private still: boolean;
  private morph = 1; // progress of the running morph
  private reveal = { v: 1.1, to: 1.1 };
  private shift = { x: 0, y: 0, tx: 0, ty: 0 };
  private zoom = { v: 1, to: 1 };
  private yaw = 0.6;
  private pitch = 0.32;
  private spinV = 0;
  private idle = 0.00012;
  private dragging = false;
  private trail: { x: number; t: number }[] = [];
  private cleanup: (() => void)[] = [];
  /** Called after every frame, for labels that follow points. */
  onFrame: (() => void) | null = null;

  constructor(private host: HTMLElement) {
    this.count = window.innerWidth < 700 ? 46000 : 84000;
    this.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** False if WebGL is not available. */
  async start(): Promise<boolean> {
    const THREE = (this.three = await import("three"));
    if (this.dead) return false;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return false;
    }
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
    this.host.appendChild(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

    const n = this.count;
    const geo = new THREE.BufferGeometry();
    for (const name of ["position", "positionB", "normal", "normalB", "metaA", "metaB"]) {
      geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    }
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) seed[i] = Math.random();
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    // Every point starts unrevealed.
    (geo.getAttribute("metaA").array as Float32Array).fill(9);
    (geo.getAttribute("metaB").array as Float32Array).fill(9);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMorph: { value: 1 },
        uReveal: { value: 1.1 },
        uTime: { value: 0 },
        uHi: { value: -1 },
        uStreams: { value: new THREE.Vector2(-1, -1) },
        uShift: { value: new THREE.Vector2() },
        uSize: { value: 6.6 },
        uPixel: { value: 1 },
        uSpin: { value: new THREE.Matrix3() },
        uInk: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color() },
        uAmber: { value: new THREE.Color() },
        uTpu: { value: new THREE.Color() },
      },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.readTheme();
    const mo = new MutationObserver(() => this.readTheme());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.host);
    const wake = () => this.kick();
    document.addEventListener("visibilitychange", wake);
    this.cleanup.push(
      () => mo.disconnect(),
      () => ro.disconnect(),
      () => document.removeEventListener("visibilitychange", wake),
    );
    this.bindDrag(canvas);
    this.resize();
    return true;
  }

  /**
   * Re-form the cloud into a target. With `scan`, the target is revealed in
   * its own order (a rising line for an aircraft, a sweep for a room).
   */
  show(target: Target, opts: { scan?: boolean; instant?: boolean } = {}) {
    if (!this.material) return;
    const g = this.points.geometry;
    this.settle();
    (g.getAttribute("positionB").array as Float32Array).set(target.pos);
    (g.getAttribute("normalB").array as Float32Array).set(target.nor);
    (g.getAttribute("metaB").array as Float32Array).set(target.meta);
    for (const name of ["positionB", "normalB", "metaB"]) g.getAttribute(name).needsUpdate = true;
    const instant = opts.instant || this.still;
    this.morph = instant ? 1 : 0;
    this.material.uniforms.uMorph.value = this.morph;
    if (opts.scan && !this.still) {
      this.reveal = { v: -0.05, to: 1.1 };
      // A scan draws the target in place rather than flying points to it.
      this.morph = 1;
      this.material.uniforms.uMorph.value = 1;
    } else {
      this.reveal = { v: 1.1, to: 1.1 };
    }
    this.material.uniforms.uReveal.value = this.reveal.v;
    this.kick();
  }

  /** Run the current target's reveal again. */
  rescan() {
    if (this.still || !this.material) return;
    this.reveal = { v: -0.05, to: 1.1 };
    this.kick();
  }

  /** Pick out the points carrying a tag, or pass -1 to let all of them show. */
  highlight(tag: number) {
    if (!this.material) return;
    this.material.uniforms.uHi.value = tag;
    this.kick();
  }

  /** Which streams flow: tags from lo to hi. */
  streams(lo: number, hi: number) {
    if (!this.material) return;
    (this.material.uniforms.uStreams.value as import("three").Vector2).set(lo, hi);
    this.kick();
  }

  /** Where the scene sits in the frame (in half-screens from the centre) and how large. */
  frame(x: number, y: number, zoom: number, idle = 0.00012) {
    this.shift.tx = x;
    this.shift.ty = y;
    this.zoom.to = zoom;
    this.idle = idle;
    this.kick();
  }

  /** Where a point of the scene lands on screen, in CSS pixels from the host's top left. */
  project(x: number, y: number, z: number): [number, number] {
    const v = new this.three.Vector3(x, y, z).applyMatrix3(this.material.uniforms.uSpin.value as Matrix3);
    v.project(this.camera);
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    return [((v.x + this.shift.x) * 0.5 + 0.5) * w, (1 - ((v.y + this.shift.y) * 0.5 + 0.5)) * h];
  }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.points?.geometry.dispose();
    this.material?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  // What is on screen becomes A, so the next morph starts from it, mid-flight or not.
  private settle() {
    const g = this.points.geometry;
    const u = this.material.uniforms.uMorph.value as number;
    const pa = g.getAttribute("position").array as Float32Array;
    const pb = g.getAttribute("positionB").array as Float32Array;
    const na = g.getAttribute("normal").array as Float32Array;
    const nb = g.getAttribute("normalB").array as Float32Array;
    if (u >= 0.999) {
      pa.set(pb);
      na.set(nb);
      (g.getAttribute("metaA").array as Float32Array).set(g.getAttribute("metaB").array as Float32Array);
    } else {
      const seed = g.getAttribute("seed").array as Float32Array;
      for (let i = 0; i < this.count; i++) {
        const t = Math.min(1, Math.max(0, u * 1.6 - seed[i] * 0.6));
        const e = t * t * (3 - 2 * t);
        for (let k = i * 3; k < i * 3 + 3; k++) {
          pa[k] += (pb[k] - pa[k]) * e;
          na[k] += (nb[k] - na[k]) * e;
        }
      }
    }
    for (const name of ["position", "normal", "metaA"]) (g.getAttribute(name) as BufferAttribute).needsUpdate = true;
  }

  private readTheme() {
    if (!this.material) return;
    const css = getComputedStyle(document.documentElement);
    for (const [name, token] of [
      ["uInk", "--color-fg"],
      ["uAccent", "--color-accent"],
      ["uAmber", "--color-amber"],
      ["uTpu", "--color-tpu"],
    ]) {
      const v = css.getPropertyValue(token).trim().slice(0, 7);
      if (v) (this.material.uniforms[name].value as Color).set(v);
    }
    this.kick();
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h || !this.renderer) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.place();
    this.material.uniforms.uPixel.value = (h * this.renderer.getPixelRatio()) / 900;
    this.kick();
  }

  private place() {
    // A unit-radius scene fills the frame's height at zoom 1.
    const half = (this.camera.fov * Math.PI) / 360;
    this.camera.position.set(0, 0, 1 / Math.sin(half) / this.zoom.v);
    this.camera.updateProjectionMatrix();
  }

  // Drag to turn. The cloud keeps the speed it was let go at and coasts down;
  // grabbing it again stops it where it is. Vertical drags are left to the page.
  private bindDrag(canvas: HTMLCanvasElement) {
    let sx = 0;
    let sy = 0;
    let startYaw = 0;
    let locked = false;
    const down = (e: PointerEvent) => {
      this.dragging = true;
      locked = false;
      this.spinV = 0;
      sx = e.clientX;
      sy = e.clientY;
      startYaw = this.yaw;
      this.trail = [{ x: e.clientX, t: performance.now() }];
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!locked) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          this.dragging = false;
          return;
        }
        locked = true;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      }
      this.yaw = startYaw + dx * 0.0085;
      const now = performance.now();
      this.trail.push({ x: e.clientX, t: now });
      while (this.trail.length > 2 && now - this.trail[0].t > 100) this.trail.shift();
      this.kick();
    };
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      canvas.style.cursor = "grab";
      const a = this.trail[0];
      const b = this.trail[this.trail.length - 1];
      if (locked && a && b && b.t > a.t) this.spinV = ((b.x - a.x) / (b.t - a.t)) * 0.0085;
      this.kick();
    };
    const events: [string, (e: PointerEvent) => void][] = [
      ["pointerdown", down],
      ["pointermove", move],
      ["pointerup", up],
      ["pointercancel", up],
      ["lostpointercapture", up],
    ];
    for (const [name, fn] of events) canvas.addEventListener(name, fn as EventListener);
    this.cleanup.push(() => {
      for (const [name, fn] of events) canvas.removeEventListener(name, fn as EventListener);
    });
  }

  private kick() {
    if (!this.raf && !this.dead && this.material) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.dead || document.hidden) return;
    const dt = Math.min(64, now - (this.last || now));
    this.last = now;
    this.time += dt / 1000;
    const u = this.material.uniforms;
    u.uTime.value = this.time;

    if (this.morph < 1) {
      this.morph = Math.min(1, this.morph + dt / 1500);
      u.uMorph.value = this.morph;
    }
    if (this.reveal.v < this.reveal.to) {
      this.reveal.v = Math.min(this.reveal.to, this.reveal.v + dt * 0.00048);
      u.uReveal.value = this.reveal.v;
    }
    // The scene glides to its place in the frame.
    const k = 1 - Math.pow(0.994, dt);
    this.shift.x += (this.shift.tx - this.shift.x) * k;
    this.shift.y += (this.shift.ty - this.shift.y) * k;
    this.zoom.v += (this.zoom.to - this.zoom.v) * k;
    (u.uShift.value as import("three").Vector2).set(this.shift.x, this.shift.y);
    this.place();

    if (!this.dragging) {
      const idle = this.still ? 0 : this.idle;
      this.spinV = idle + (this.spinV - idle) * Math.pow(0.996, dt);
      this.yaw += this.spinV * dt;
    }
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    (u.uSpin.value as Matrix3).set(cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy);

    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
    // With reduced motion and nothing in hand, one frame is the whole show.
    if (!this.still || this.dragging || this.morph < 1 || Math.abs(this.spinV) > 1e-6) {
      this.raf = requestAnimationFrame(this.loop);
    }
  };
}
