// The lidar view: a drone drawn as a cloud of points sampled from its real
// surface, the way a scanner would see it. One cloud holds a fixed number of
// points; showing another aircraft sends every point from where it sits on
// one airframe to a place on the next, so the fleet re-forms rather than
// swaps. A scan line can sweep a model in from the ground up.
//
// Plain three.js, no React. The component in components/cloud.tsx owns one.

import type { BufferAttribute, Mesh, PerspectiveCamera, Points, Scene, ShaderMaterial, WebGLRenderer } from "three";
import { asset } from "./asset";

type Three = typeof import("three");

/** A sampled aircraft: positions, normals and a material class per point. */
type Sample = { pos: Float32Array; nor: Float32Array; cls: Float32Array };

// Material classes a point can carry. Electronics and the TPU feet keep their
// colour; everything else is drawn in the page's ink.
const CLASS: Record<string, number> = { Electronics: 1, "Flexible TPU": 2 };

const VERT = /* glsl */ `
  attribute vec3 positionB;
  attribute vec3 normalB;
  attribute float clsA;
  attribute float clsB;
  attribute float seed;
  uniform float uMorph;   // 0 shows A, 1 shows B
  uniform float uScan;    // height of the scan line, in model units (-1.2 hidden, 1.2 fully shown)
  uniform float uSize;
  uniform float uPixel;
  uniform mat3 uSpin;     // the model's rotation, applied here so the light stays put
  varying float vShade;
  varying float vCls;
  varying float vEdge;

  float ease(float t) { return t * t * (3.0 - 2.0 * t); }

  void main() {
    // Each point leaves a little after its neighbours, and swings wide on the way.
    float t = clamp((uMorph * 1.6) - seed * 0.6, 0.0, 1.0);
    float e = ease(t);
    vec3 p = mix(position, positionB, e);
    vec3 n = normalize(mix(normal, normalB, e));
    vec3 drift = vec3(sin(seed * 91.7), cos(seed * 47.3), sin(seed * 23.1 + 1.7));
    p += drift * sin(e * 3.14159) * 0.16;
    vCls = mix(clsA, clsB, step(0.5, e));

    p = uSpin * p;
    n = uSpin * n;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 vn = normalize(normalMatrix * n);

    // Points that face away are let go, so the cloud reads as a solid, not an x-ray.
    float facing = dot(vn, normalize(-mv.xyz));
    float front = smoothstep(-0.05, 0.3, facing);
    // Lit from above and to the right.
    float light = 0.5 + 0.5 * clamp(dot(vn, normalize(vec3(0.45, 0.8, 0.5))), 0.0, 1.0);
    // The scan: nothing above the line, and a bright band just under it.
    float under = step(p.y, uScan);
    vEdge = under * smoothstep(0.09, 0.0, uScan - p.y) * step(uScan, 1.15);
    vShade = front * light * under;

    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixel * (0.6 + 0.5 * light + vEdge) / -mv.z;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform vec3 uTpu;
  varying float vShade;
  varying float vCls;
  varying float vEdge;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25 || vShade < 0.02) discard;
    vec3 col = uInk;
    if (vCls > 0.5) col = uAccent;
    if (vCls > 1.5) col = uTpu;
    col = mix(col, uAccent, vEdge);
    gl_FragColor = vec4(col, min(1.0, vShade * 1.1 + vEdge) * smoothstep(0.25, 0.16, d));
  }
`;

export type CloudOptions = {
  /** Points in the cloud. */
  count?: number;
  /** Turn slowly when left alone. */
  turn?: boolean;
  /** Fired once the first model is on screen. */
  onReady?: () => void;
  onFail?: () => void;
};

export class Cloud {
  private three!: Three;
  private renderer!: WebGLRenderer;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private points!: Points;
  private material!: ShaderMaterial;
  private samples = new Map<string, Promise<Sample>>();
  private raf = 0;
  private last = 0;
  private visible = true;
  private dead = false;
  private count: number;
  private still: boolean;
  private wanted = "";
  private shown = "";

  // What the frame loop eases towards.
  private morph = { from: 0, to: 0, t: 1, ms: 1400 };
  private scan = { v: 1.2, to: 1.2 };
  private yaw = 0.6;
  private pitch = 0.32;
  private spinV = 0; // radians per ms, carried from a drag
  private dragging = false;
  private trail: { x: number; t: number }[] = [];
  private cleanup: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    private opts: CloudOptions = {},
  ) {
    this.count = opts.count ?? (window.innerWidth < 700 ? 45000 : 80000);
    this.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  async start(id: string, scanIn = true) {
    const THREE = (this.three = await import("three"));
    if (this.dead) return;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      this.opts.onFail?.();
      return;
    }
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab";
    this.host.appendChild(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

    const geo = new THREE.BufferGeometry();
    const n = this.count;
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) seed[i] = Math.random();
    for (const [name, size] of [
      ["position", 3],
      ["positionB", 3],
      ["normal", 3],
      ["normalB", 3],
      ["clsA", 1],
      ["clsB", 1],
    ] as const) {
      geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * size), size));
    }
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMorph: { value: 0 },
        uScan: { value: this.still || !scanIn ? 1.2 : -1.2 },
        uSize: { value: 6.6 },
        uPixel: { value: 1 },
        uSpin: { value: new THREE.Matrix3() },
        uInk: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color() },
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
    const io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible && !this.raf) this.loop(performance.now());
    });
    io.observe(this.host);
    this.cleanup.push(
      () => mo.disconnect(),
      () => ro.disconnect(),
      () => io.disconnect(),
    );
    this.bindDrag(canvas);
    this.resize();

    const first = await this.sample(id).catch(() => null);
    if (this.dead) return;
    if (!first) {
      this.opts.onFail?.();
      return;
    }
    this.write("position", "normal", "clsA", first);
    this.write("positionB", "normalB", "clsB", first);
    this.shown = this.wanted = id;
    this.scan.v = this.material.uniforms.uScan.value;
    this.scan.to = 1.2;
    this.opts.onReady?.();
    this.loop(performance.now());
  }

  /** Re-form the cloud into another aircraft. */
  async show(id: string) {
    if (id === this.wanted) return;
    this.wanted = id;
    const next = await this.sample(id).catch(() => null);
    if (!next || this.dead || this.wanted !== id || !this.material) return;
    // Whatever is on screen now becomes A, mid-flight or not.
    if (this.morph.t < 1 || this.material.uniforms.uMorph.value > 0) this.settle();
    this.write("positionB", "normalB", "clsB", next);
    this.shown = id;
    this.morph = { from: 0, to: 1, t: this.still ? 1 : 0, ms: 1500 };
    if (!this.raf && this.visible) this.loop(performance.now());
  }

  /** Warm the cache for an aircraft the visitor is likely to pick next. */
  preload(id: string) {
    void this.sample(id).catch(() => {});
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

  // The current B becomes A, so a new morph can start from what is shown.
  private settle() {
    const g = this.points.geometry;
    const u = this.material.uniforms.uMorph.value as number;
    const a = g.getAttribute("position") as BufferAttribute;
    const b = g.getAttribute("positionB") as BufferAttribute;
    if (u >= 0.999) {
      (a.array as Float32Array).set(b.array as Float32Array);
      (g.getAttribute("normal").array as Float32Array).set(g.getAttribute("normalB").array as Float32Array);
      (g.getAttribute("clsA").array as Float32Array).set(g.getAttribute("clsB").array as Float32Array);
    } else {
      // Caught mid-morph: freeze every point where the shader has it now.
      const pa = a.array as Float32Array;
      const pb = b.array as Float32Array;
      const seed = g.getAttribute("seed").array as Float32Array;
      for (let i = 0; i < this.count; i++) {
        const t = Math.min(1, Math.max(0, u * 1.6 - seed[i] * 0.6));
        const e = t * t * (3 - 2 * t);
        for (let k = 0; k < 3; k++) pa[i * 3 + k] += (pb[i * 3 + k] - pa[i * 3 + k]) * e;
      }
    }
    a.needsUpdate = true;
    g.getAttribute("normal").needsUpdate = true;
    g.getAttribute("clsA").needsUpdate = true;
    this.material.uniforms.uMorph.value = 0;
  }

  private write(pos: string, nor: string, cls: string, s: Sample) {
    const g = this.points.geometry;
    (g.getAttribute(pos).array as Float32Array).set(s.pos);
    (g.getAttribute(nor).array as Float32Array).set(s.nor);
    (g.getAttribute(cls).array as Float32Array).set(s.cls);
    g.getAttribute(pos).needsUpdate = true;
    g.getAttribute(nor).needsUpdate = true;
    g.getAttribute(cls).needsUpdate = true;
  }

  /** Load a model and scatter the cloud's points over its surface, by area. */
  private sample(id: string): Promise<Sample> {
    let p = this.samples.get(id);
    if (p) return p;
    p = (async () => {
      const THREE = this.three;
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(asset(`/models/${id}.glb`));
      gltf.scene.updateMatrixWorld(true);

      // Every triangle, in world space, with its area and material class.
      const tris: number[] = [];
      const meta: number[] = []; // area, class
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      const box = new THREE.Box3();
      gltf.scene.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        const pos = mesh.geometry.getAttribute("position");
        const index = mesh.geometry.getIndex();
        const name = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name.split(".")[0];
        const cls = CLASS[name] ?? 0;
        const total = index ? index.count : pos.count;
        for (let i = 0; i < total; i += 3) {
          const [i0, i1, i2] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
          a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
          box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
          tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
          // Small coloured parts get extra points, so they still read in the cloud.
          meta.push(area * (cls ? 2.4 : 1), cls);
        }
      });

      const centre = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      const nTri = meta.length / 2;
      const cdf = new Float64Array(nTri);
      let sum = 0;
      for (let i = 0; i < nTri; i++) cdf[i] = sum += meta[i * 2];

      const n = this.count;
      const out: Sample = { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), cls: new Float32Array(n) };
      for (let i = 0; i < n; i++) {
        const r = Math.random() * sum;
        let lo = 0;
        let hi = nTri - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cdf[mid] < r) lo = mid + 1;
          else hi = mid;
        }
        const t = lo * 9;
        let u = Math.random();
        let v = Math.random();
        if (u + v > 1) {
          u = 1 - u;
          v = 1 - v;
        }
        const w = 1 - u - v;
        for (let k = 0; k < 3; k++) {
          const centred = tris[t + k] * w + tris[t + 3 + k] * u + tris[t + 6 + k] * v - centre.getComponent(k);
          out.pos[i * 3 + k] = centred / radius;
        }
        a.set(tris[t], tris[t + 1], tris[t + 2]);
        b.set(tris[t + 3], tris[t + 4], tris[t + 5]).sub(a);
        c.set(tris[t + 6], tris[t + 7], tris[t + 8]).sub(a);
        b.cross(c).normalize();
        out.nor.set([b.x, b.y, b.z], i * 3);
        out.cls[i] = meta[lo * 2 + 1];
      }
      return out;
    })();
    this.samples.set(id, p);
    return p;
  }

  private readTheme() {
    if (!this.material) return;
    const css = getComputedStyle(document.documentElement);
    const set = (name: string, token: string) => {
      const v = css.getPropertyValue(token).trim().slice(0, 7);
      if (v) (this.material.uniforms[name].value as import("three").Color).set(v);
    };
    set("uInk", "--color-fg");
    set("uAccent", "--color-accent");
    set("uTpu", "--color-tpu");
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h || !this.renderer) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Hold the unit-radius model inside the narrower of the two frame axes.
    const half = (this.camera.fov * Math.PI) / 360;
    const fit = 1 / Math.sin(Math.atan(Math.tan(half) * Math.min(1, this.camera.aspect)));
    this.camera.position.set(0, 0, fit * 0.8);
    this.camera.updateProjectionMatrix();
    this.material.uniforms.uPixel.value = (h * this.renderer.getPixelRatio()) / 900;
  }

  // Drag to turn. The cloud keeps the speed it was let go at and coasts down;
  // grabbing it again stops it where it is. Vertical drags are left to the page.
  private bindDrag(canvas: HTMLCanvasElement) {
    let startX = 0;
    let startY = 0;
    let startYaw = 0;
    let locked = false;
    const down = (e: PointerEvent) => {
      this.dragging = true;
      locked = false;
      this.spinV = 0;
      startX = e.clientX;
      startY = e.clientY;
      startYaw = this.yaw;
      this.trail = [{ x: e.clientX, t: performance.now() }];
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!locked) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          this.dragging = false; // a vertical gesture is a scroll
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
    };
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      canvas.style.cursor = "grab";
      const a = this.trail[0];
      const b = this.trail[this.trail.length - 1];
      if (locked && a && b && b.t > a.t) this.spinV = ((b.x - a.x) / (b.t - a.t)) * 0.0085;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    this.cleanup.push(() => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
    });
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.dead || !this.visible || document.hidden) return;
    const dt = Math.min(64, now - (this.last || now));
    this.last = now;
    const u = this.material.uniforms;

    // Morph.
    if (this.morph.t < 1) {
      this.morph.t = Math.min(1, this.morph.t + dt / this.morph.ms);
      u.uMorph.value = this.morph.from + (this.morph.to - this.morph.from) * this.morph.t;
    }
    // Scan line rises at a steady pace.
    if (this.scan.v < this.scan.to) {
      this.scan.v = Math.min(this.scan.to, this.scan.v + dt * 0.0011);
      u.uScan.value = this.scan.v;
    }
    // Turn: carried speed coasts down to the idle drift.
    if (!this.dragging) {
      const idle = this.opts.turn === false || this.still ? 0 : 0.00012;
      this.spinV = idle + (this.spinV - idle) * Math.pow(0.996, dt);
      this.yaw += this.spinV * dt;
    }
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    // Yaw about the vertical, then tip towards the camera.
    (u.uSpin.value as import("three").Matrix3).set(cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy);

    this.renderer.render(this.scene, this.camera);
    const busy = this.morph.t < 1 || this.scan.v < this.scan.to || this.dragging;
    const drifting = Math.abs(this.spinV) > 1e-6;
    if (busy || drifting) this.raf = requestAnimationFrame(this.loop);
  };
}
