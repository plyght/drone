// What the cloud can become. A target gives every point a position, a normal
// and three numbers: its class (which colour it takes), a tag (so a scene can
// pick out a part) and its place in the reveal order.
//
// Classes: 0 ink, 1 accent (electronics, what is live), 2 the orange TPU,
// 3 a stream in the accent, 4 a stream or part in amber. A stream point keeps
// its start in `pos` and its end in `nor`, and travels between them.

import type { Mesh } from "three";
import { asset } from "./asset";

export type Target = { pos: Float32Array; nor: Float32Array; meta: Float32Array };

type Three = typeof import("three");
type V3 = [number, number, number];

/** Points sampled from an aircraft's surface, centred and scaled to a unit radius. */
type Sample = { pos: Float32Array; nor: Float32Array; cls: Float32Array; n: number };

const CLASS: Record<string, number> = { Electronics: 1, "Flexible TPU": 2 };
const SAMPLE_SIZE = 84000;
const samples = new Map<string, Promise<Sample>>();

/** Load a model once and scatter points over its surface, by area. */
export function sample(THREE: Three, id: string): Promise<Sample> {
  let p = samples.get(id);
  if (p) return p;
  p = (async () => {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/libs/meshopt_decoder.module.js"),
    ]);
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(asset(`/models/${id}.glb`));
    gltf.scene.updateMatrixWorld(true);
    const tris: number[] = [];
    const meta: number[] = []; // weight, class
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

    const n = SAMPLE_SIZE;
    const out: Sample = { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), cls: new Float32Array(n), n };
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
        out.pos[i * 3 + k] = (tris[t + k] * w + tris[t + 3 + k] * u + tris[t + 6 + k] * v - centre.getComponent(k)) / radius;
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
  samples.set(id, p);
  return p;
}

/** Fills a target point by point; whatever is left over at the end stays hidden. */
class Builder {
  t: Target;
  i = 0;
  constructor(readonly n: number) {
    this.t = { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), meta: new Float32Array(n * 3).fill(9) };
  }
  add(p: V3, nor: V3, cls = 0, tag = 0, ord = 0) {
    if (this.i >= this.n) return;
    this.t.pos.set(p, this.i * 3);
    this.t.nor.set(nor, this.i * 3);
    this.t.meta.set([cls, tag, ord], this.i * 3);
    this.i++;
  }
  /** `count` points of a sampled aircraft, moved and scaled into the scene. */
  model(s: Sample, count: number, at: V3, scale: number, tag = 0, ord: (p: V3) => number = () => 0, cls?: number) {
    for (let k = 0; k < count; k++) {
      const j = (k % s.n) * 3;
      const p: V3 = [s.pos[j] * scale + at[0], s.pos[j + 1] * scale + at[1], s.pos[j + 2] * scale + at[2]];
      this.add(p, [s.nor[j], s.nor[j + 1], s.nor[j + 2]], cls ?? s.cls[k % s.n], tag, ord(p));
    }
  }
  /** The surface of a box. */
  box(count: number, c: V3, size: V3, cls = 0, tag = 0, ord: (p: V3) => number = () => 0) {
    const [w, h, d] = size;
    const areas = [h * d, h * d, w * d, w * d, w * h, w * h];
    const total = areas.reduce((a, b) => a + b, 0);
    for (let k = 0; k < count; k++) {
      let r = Math.random() * total;
      let f = 0;
      while (r > areas[f]) r -= areas[f++];
      const u = Math.random() - 0.5;
      const v = Math.random() - 0.5;
      const axis = f >> 1;
      const sign = f % 2 ? -1 : 1;
      const p: V3 = [0, 0, 0];
      const n: V3 = [0, 0, 0];
      p[axis] = (sign * size[axis]) / 2;
      p[(axis + 1) % 3] = u * size[(axis + 1) % 3];
      p[(axis + 2) % 3] = v * size[(axis + 2) % 3];
      n[axis] = sign;
      const q: V3 = [p[0] + c[0], p[1] + c[1], p[2] + c[2]];
      this.add(q, n, cls, tag, ord(q));
    }
  }
  /** A flat rectangle seen from one side only (a floor or a wall). */
  plane(count: number, c: V3, u: V3, v: V3, n: V3, cls = 0, tag = 0, ord: (p: V3) => number = () => 0) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * 2 - 1;
      const b = Math.random() * 2 - 1;
      const p: V3 = [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, c[2] + u[2] * a + v[2] * b];
      this.add(p, n, cls, tag, ord(p));
    }
  }
  /** A tube between two points. */
  tube(count: number, a: V3, b: V3, r: number, cls = 0, tag = 0, ord: (p: V3) => number = () => 0) {
    const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(...d);
    const z: V3 = [d[0] / len, d[1] / len, d[2] / len];
    const ref: V3 = Math.abs(z[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const x = norm(cross(ref, z));
    const y = cross(z, x);
    for (let k = 0; k < count; k++) {
      const t = Math.random();
      const ang = Math.random() * Math.PI * 2;
      const n: V3 = [
        x[0] * Math.cos(ang) + y[0] * Math.sin(ang),
        x[1] * Math.cos(ang) + y[1] * Math.sin(ang),
        x[2] * Math.cos(ang) + y[2] * Math.sin(ang),
      ];
      const p: V3 = [a[0] + d[0] * t + n[0] * r, a[1] + d[1] * t + n[1] * r, a[2] + d[2] * t + n[2] * r];
      this.add(p, n, cls, tag, ord(p));
    }
  }
  ball(count: number, c: V3, r: number, cls = 0, tag = 0, ord: (p: V3) => number = () => 0) {
    for (let k = 0; k < count; k++) {
      const n = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
      const p: V3 = [c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r];
      this.add(p, n, cls, tag, ord(p));
    }
  }
  /** Points that flow from a to b. cls 3 flows in the accent, 4 in amber. */
  stream(count: number, a: V3, b: V3, cls: 3 | 4, tag: number) {
    for (let k = 0; k < count; k++) this.add(a, b, cls, tag, 0);
  }
}

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** One aircraft, filling the cloud. It reveals from the ground up. */
export function aircraft(s: Sample, n: number): Target {
  const b = new Builder(n);
  b.model(s, n, [0, 0, 0], 1, 0, (p) => (p[1] + 1) * 0.5);
  return b.t;
}

/** The tool rack. Each of the six heads carries its own tag (1 to 6), left to right. */
export function rack(s: Sample, n: number): Target {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < s.n; i++) {
    lo = Math.min(lo, s.pos[i * 3]);
    hi = Math.max(hi, s.pos[i * 3]);
  }
  // The frame's uprights sit outside the row of heads.
  const from = lo + (hi - lo) * 0.06;
  const span = (hi - lo) * 0.88;
  const b = new Builder(n);
  for (let k = 0; k < n; k++) {
    const j = (k % s.n) * 3;
    const x = s.pos[j];
    const head = Math.min(6, Math.max(1, 1 + Math.floor(((x - from) / span) * 6)));
    // The top bar and the base belong to the rack, not to a head.
    const tag = s.pos[j + 1] > 0.3 || s.pos[j + 1] < -0.33 ? 0 : head;
    b.add([x, s.pos[j + 1], s.pos[j + 2]], [s.nor[j], s.nor[j + 1], s.nor[j + 2]], s.cls[k % s.n], tag, (s.pos[j + 1] + 1) * 0.5);
  }
  return b.t;
}

/** Where things sit in the scene of drones talking. Shared with the labels drawn over it. */
export const TALK = {
  ground: [-0.1, -0.52, 0.15] as V3,
  pad: [0.78, -0.6, -0.1] as V3,
  wall: [0.42, -0.25, 0.25] as V3,
  drones: [
    { id: "lynceus", name: "Lynceus", at: [-0.82, 0.22, 0.2] as V3, own: true },
    { id: "pallas", name: "Pallas", at: [-0.4, 0.58, -0.3] as V3, own: true },
    { id: "astraeus", name: "Astraeus", at: [-0.2, 0.08, 0.42] as V3, own: true },
    { id: "pollux", name: "Pollux", at: [0.3, 0.72, 0.1] as V3, own: false },
    { id: "perseus", name: "Perseus", at: [0.78, 0.18, -0.1] as V3, own: false },
    { id: "castor", name: "Castor", at: [0.72, -0.2, 0.48] as V3, own: false },
  ],
};

/**
 * The fleet in the air over the ground computer. Streams 10 to 19 are drones
 * talking directly, 20 to 29 go through the ground computer, 30 to 39 are
 * relayed overhead by Pollux past a wall that blocks the ground link.
 */
export function talk(parts: Sample[], n: number): Target {
  const b = new Builder(n);
  const each = Math.floor(n * 0.115);
  TALK.drones.forEach((d, i) => b.model(parts[i], each, d.at, 0.21, i + 1));
  b.box(Math.floor(n * 0.03), TALK.ground, [0.16, 0.1, 0.12], 1, 7);
  b.box(Math.floor(n * 0.02), TALK.pad, [0.3, 0.015, 0.26], 4, 8);
  b.plane(Math.floor(n * 0.03), [0, -0.61, 0], [1.25, 0, 0], [0, 0, 0.8], [0, 1, 0]);
  b.box(Math.floor(n * 0.05), TALK.wall, [0.04, 0.72, 0.5], 0, 9);
  const [lyn, pal, ast, pol, per, cas] = TALK.drones.map((d) => d.at);
  const s = Math.floor(n * 0.012);
  b.stream(s, lyn, pal, 3, 10);
  b.stream(s, pal, ast, 3, 11);
  b.stream(s, ast, lyn, 3, 12);
  b.stream(s, per, TALK.ground, 4, 20);
  b.stream(s, TALK.ground, per, 4, 21);
  b.stream(s, TALK.ground, lyn, 4, 22);
  b.stream(s, TALK.ground, pol, 4, 30);
  b.stream(s, pol, cas, 4, 31);
  return b.t;
}

/** Where things sit in the room a drone is scanning. */
export const ROOM = {
  drone: [-0.05, 0.12, 0.05] as V3,
  person: [0.62, -0.28, 0.2] as V3,
  valve: [-0.86, -0.02, -0.1] as V3,
  pad: [-0.05, -0.6, 0.05] as V3,
};

/**
 * A room, drawn in the order a spinning lidar on the drone would find it:
 * the reveal sweeps around the drone. Tags: 5 the person, 6 the valve, 7 the
 * pad. Stream 40 is the rangefinder's single beam down to the pad.
 */
export function room(drone: Sample, n: number): Target {
  const b = new Builder(n);
  const sweep = (p: V3) => {
    const a = Math.atan2(p[2] - ROOM.drone[2], p[0] - ROOM.drone[0]) / (Math.PI * 2) + 0.5;
    return 0.04 + a * 0.9;
  };
  b.model(drone, Math.floor(n * 0.26), ROOM.drone, 0.26, 1, () => 0);
  b.plane(Math.floor(n * 0.1), [0, -0.62, 0], [1.05, 0, 0], [0, 0, 0.8], [0, 1, 0], 0, 0, sweep);
  b.plane(Math.floor(n * 0.07), [-0.95, 0, 0], [0, 0.62, 0], [0, 0, 0.8], [1, 0, 0], 0, 0, sweep);
  b.plane(Math.floor(n * 0.07), [0, 0, -0.8], [1.05, 0, 0], [0, 0.62, 0], [0, 0, 1], 0, 0, sweep);
  // A pipe along the left wall with a valve wheel on it.
  b.tube(Math.floor(n * 0.04), [-0.88, -0.62, -0.1], [-0.88, 0.62, -0.1], 0.035, 0, 0, sweep);
  for (let k = 0; k < 10; k++) {
    const a0 = (k / 10) * Math.PI * 2;
    const a1 = ((k + 1) / 10) * Math.PI * 2;
    const ring = (a: number): V3 => [ROOM.valve[0] + 0.07, ROOM.valve[1] + Math.sin(a) * 0.1, ROOM.valve[2] + Math.cos(a) * 0.1];
    b.tube(Math.floor(n * 0.004), ring(a0), ring(a1), 0.014, 0, 6, sweep);
  }
  // A person: a body, a head and two legs.
  const [px, py, pz] = ROOM.person;
  b.tube(Math.floor(n * 0.09), [px, py - 0.02, pz], [px, py + 0.3, pz], 0.085, 0, 5, sweep);
  b.ball(Math.floor(n * 0.04), [px, py + 0.42, pz], 0.075, 0, 5, sweep);
  b.tube(Math.floor(n * 0.02), [px - 0.045, py - 0.34, pz], [px - 0.045, py - 0.02, pz], 0.035, 0, 5, sweep);
  b.tube(Math.floor(n * 0.02), [px + 0.045, py - 0.34, pz], [px + 0.045, py - 0.02, pz], 0.035, 0, 5, sweep);
  b.box(Math.floor(n * 0.05), ROOM.pad, [0.42, 0.02, 0.36], 4, 7, sweep);
  b.stream(Math.floor(n * 0.03), [ROOM.drone[0], ROOM.drone[1] - 0.06, ROOM.drone[2]], [ROOM.pad[0], ROOM.pad[1] + 0.02, ROOM.pad[2]], 3, 40);
  return b.t;
}

/**
 * Two printed arms of equal cross-section area, each held at one end with
 * the same load on the other. `ratio` is how much stiffer the taller one is,
 * from 1 (the same arm) to Mercury's study result. Tags: 1 the wider arm,
 * 2 the taller one.
 */
export function arms(ratio: number, n: number): Target {
  const b = new Builder(n);
  const L = 1.5;
  const w0 = 0.2;
  const h0 = 0.11;
  // At constant area, stiffness goes with the square of the height.
  const h = h0 * Math.sqrt(ratio);
  const w = (w0 * h0) / h;
  const sag = 0.2;
  const arm = (z: number, width: number, height: number, tip: number, cls: number, tag: number) => {
    const count = Math.floor(n * 0.44);
    const areas = [height, height, width, width];
    const total = 2 * (width + height);
    for (let k = 0; k < count; k++) {
      const t = Math.random();
      let r = Math.random() * total;
      let f = 0;
      while (r > areas[f]) r -= areas[f++];
      const s = Math.random() - 0.5;
      const p: V3 = [-L / 2 + t * L, 0, z];
      const nor: V3 = [0, 0, 0];
      if (f < 2) {
        p[2] += (f ? -1 : 1) * (width / 2);
        p[1] += s * height;
        nor[2] = f ? -1 : 1;
      } else {
        p[1] += (f === 3 ? -1 : 1) * (height / 2);
        p[2] += s * width;
        nor[1] = f === 3 ? -1 : 1;
      }
      // A cantilever's curve under an end load.
      p[1] -= tip * (t * t * (3 - t)) * 0.5;
      b.add(p, nor, cls, tag, t);
    }
  };
  arm(0.32, w0, h0, sag, 0, 1);
  arm(-0.32, w, h, sag / ratio, 1, 2);
  // The wall both arms are fixed to.
  b.box(Math.floor(n * 0.07), [-L / 2 - 0.03, -0.05, 0], [0.06, 0.6, 1.1]);
  return b.t;
}

/** The Mercury mark, as a thin disc of points with the blade left empty. */
export function mark(n: number): Target {
  const b = new Builder(n);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const path = new Path2D(
    "M24 3a21 21 0 1 0 0 42a21 21 0 1 0 0-42ZM24 24C25.5 16.5 33 11.5 41.41 12.26C37.5 20 30.5 24.6 24 24ZM24 24C22.5 31.5 15 36.5 6.59 35.74C10.5 28 17.5 23.4 24 24Z",
  );
  while (b.i < n) {
    const x = 3 + Math.random() * 42;
    const y = 3 + Math.random() * 42;
    if (ctx && !ctx.isPointInPath(path, x, y, "evenodd")) continue;
    const front = Math.random() < 0.5;
    b.add([(x - 24) / 24, -(y - 24) / 24, front ? 0.03 : -0.03], [0, 0, front ? 1 : -1], 0, 0, 1 - y / 48);
  }
  return b.t;
}
