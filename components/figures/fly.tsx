"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * Three ways of seeing, one decision. A side-on scene (a wall, a pipe with a
 * valve handle, a charging pad, a person) read through one sensing layer at a
 * time: lidar builds a point map, the rangefinder reads one distance, vision
 * names things. The five-step loop steps underneath in time with the scene.
 */

const MODES = [
  {
    name: "Lidar",
    caption:
      "A spinning laser builds a 3D map of walls, wires, branches and people. It works in the dark and without GPS.",
  },
  {
    name: "Rangefinder",
    caption: "One precise beam gives the exact distance, to make the last few centimetres of a landing safe.",
  },
  {
    name: "Vision",
    caption: "Cameras recognise a person, a valve handle, a light fitting and the markers on a charging pad.",
  },
] as const;

const LOOP = ["sense", "map", "plan", "act", "check"] as const;

/** Seconds a layer stays up before the next one; one pass of the loop words. */
const PHASE = 4.8;
/** Seconds for one revolution of the lidar beam. */
const REV = 3.4;
/** The illustrative hover height, in metres, and how low the readout goes. */
const HOVER_M = 1.2;
const LOW_M = 0.2;

type Pt = { x: number; y: number };
type Seg = [Pt, Pt];
type Box = { x: number; y: number; w: number; h: number };
type Snap = { mode: number; t: number; sweep: number; drop: number };

const rectSegs = (b: Box): Seg[] => {
  const a = { x: b.x, y: b.y };
  const c = { x: b.x + b.w, y: b.y + b.h };
  const ab = { x: c.x, y: a.y };
  const ad = { x: a.x, y: c.y };
  return [
    [a, ab],
    [ab, c],
    [c, ad],
    [ad, a],
  ];
};

/** Everything in the scene, laid out in real pixels so text never scales. */
function layout(w: number, h: number) {
  const wide = w >= 720;
  // s sizes the drone, k the valve: generous, so they read as objects.
  const s = wide ? 2.2 : 1.4;
  const k = wide ? 1.5 : 1;
  const x0 = 4;
  const x1 = w - 4;
  const y0 = 4;
  // Room under the floor for the vision boxes, so nothing leaves the figure.
  const y1 = h - 12;
  const W = x1 - x0;
  const H = y1 - y0;
  // The ceiling stops short: indoors on the left, open on the right.
  const ceilX = x0 + W * 0.62;

  const pipeX = x0 + Math.min(120, Math.max(30, W * 0.1));
  const pipe: Box = { x: pipeX - 4 * k, y: y0, w: 8 * k, h: H };
  const valveY = y0 + H * 0.64;
  const wheelX = pipeX + 22 * k;
  const handle: Box = { x: pipeX + 11 * k, y: valveY - 14 * k, w: 14 * k, h: 28 * k };

  const padW = wide ? 210 : 112;
  const padH = wide ? 14 : 11;
  const padX = x0 + W * 0.46;
  const pad: Box = { x: padX - padW / 2, y: y1 - padH, w: padW, h: padH };

  const ph = Math.min(H * 0.56, 230);
  const px = x0 + W * (wide ? 0.82 : 0.85);
  const headR = ph * 0.1;
  const head: Pt = { x: px, y: y1 - ph + headR };
  const tw = ph * 0.3;
  const torso: Box = { x: px - tw / 2, y: y1 - ph + headR * 2 + ph * 0.03, w: tw, h: ph * 0.4 };
  const legs: Box = { x: torso.x + tw * 0.06, y: torso.y + torso.h, w: tw * 0.88, h: y1 - torso.y - torso.h };
  const person: Box = { x: torso.x, y: y1 - ph, w: tw, h: ph };

  const drone: Pt = { x: padX, y: y0 + H * 0.36 };
  // Body underside to pad top at hover: this many pixels reads as HOVER_M.
  const gap = pad.y - (drone.y + 5 * s);

  const segs: Seg[] = [
    [{ x: x0, y: y0 }, { x: x0, y: y1 }],
    [{ x: x0, y: y1 }, { x: x1, y: y1 }],
    [{ x: x0, y: y0 }, { x: ceilX, y: y0 }],
    [{ x: wheelX - 2.5 * k, y: valveY - 14 * k }, { x: wheelX - 2.5 * k, y: valveY + 14 * k }],
    ...rectSegs(pipe),
    ...rectSegs(pad),
    ...rectSegs(torso),
    ...rectSegs(legs),
  ];

  return { wide, s, k, x0, x1, y0, y1, ceilX, pipeX, pipe, valveY, wheelX, handle, pad, head, headR, torso, legs, person, drone, gap, segs };
}

type Scene = ReturnType<typeof layout>;
type Hit = { p: Pt | null; dot: boolean };

/** Where each lidar ray first meets a surface (null where it leaves the scene). */
function cast(sc: Scene, n: number): Hit[] {
  const o = { x: sc.drone.x, y: sc.drone.y - 10 * sc.s };
  const out: Hit[] = [];
  let kept: Pt | null = null;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const d = { x: Math.cos(a), y: Math.sin(a) };
    let best = Infinity;
    for (const [p, q] of sc.segs) {
      const e = { x: q.x - p.x, y: q.y - p.y };
      const den = d.x * e.y - d.y * e.x;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((p.x - o.x) * e.y - (p.y - o.y) * e.x) / den;
      const u = ((p.x - o.x) * d.y - (p.y - o.y) * d.x) / den;
      if (t > 1 && u >= 0 && u <= 1 && t < best) best = t;
    }
    // The head is the one round thing in the scene.
    const f = { x: o.x - sc.head.x, y: o.y - sc.head.y };
    const b = f.x * d.x + f.y * d.y;
    const disc = b * b - (f.x * f.x + f.y * f.y - sc.headR * sc.headR);
    if (disc >= 0) {
      const t = -b - Math.sqrt(disc);
      if (t > 1 && t < best) best = t;
    }
    const p = Number.isFinite(best) ? { x: o.x + d.x * best, y: o.y + d.y * best } : null;
    // Solid dots need air between them: drop a hit that lands on the last one.
    const dot = p !== null && (kept === null || Math.hypot(p.x - kept.x, p.y - kept.y) >= 11);
    if (dot) kept = p;
    out.push({ p, dot });
  }
  return out;
}

const mq = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(mq);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

const CSS = `
.fly-layer { opacity: 0; filter: blur(8px); transition: opacity .7s var(--ease-out), filter .7s var(--ease-out); }
.fly-layer[data-on="true"] { opacity: 1; filter: blur(0); transition-delay: var(--d, 0ms); }
@media (prefers-reduced-motion: reduce) { .fly-layer { transition: none; } }
`;

export function FlyFigure() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sim = useRef({ mode: 0, t: 0, sweep: 0, drop: 0, held: false });
  const touch = useRef(false);
  const [snap, setSnap] = useState<Snap>({ mode: 0, t: 0, sweep: 0, drop: 0 });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(mq).matches,
    () => false,
  );

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    let frame = 0;
    let last: number | undefined;
    let inView = false;

    const tick = (now: number) => {
      frame = 0;
      // Clamp long gaps so nothing lurches after a pause.
      const dt = last === undefined ? 0 : Math.min(now - last, 64) / 1000;
      last = now;
      const s = sim.current;
      s.t += dt;
      if (s.t >= PHASE) {
        s.t -= PHASE;
        if (!s.held) {
          s.mode = (s.mode + 1) % MODES.length;
          if (s.mode === 0) s.sweep = 0;
        }
      }
      // The beam keeps turning while lidar is up; the map it left stays.
      if (s.mode === 0) s.sweep += dt / REV;
      // Rangefinder: one slow descent toward the pad and back, so the readout ticks.
      const p = Math.min(1, Math.max(0, (s.t - 0.4) / (PHASE - 0.8)));
      const target = s.mode === 1 ? 0.5 - 0.5 * Math.cos(p * Math.PI * 2) : 0;
      s.drop += (target - s.drop) * Math.min(1, dt * 8);
      setSnap({ mode: s.mode, t: s.t, sweep: s.sweep, drop: s.drop });
      wake();
    };
    // Only spin while the figure is on screen and the tab is visible.
    const wake = () => {
      const run = inView && document.visibilityState === "visible";
      if (run && !frame) frame = requestAnimationFrame(tick);
      if (!run) {
        cancelAnimationFrame(frame);
        frame = 0;
        last = undefined;
      }
    };
    const io = new IntersectionObserver(
      (es) => {
        inView = es.some((e) => e.isIntersecting);
        wake();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    document.addEventListener("visibilitychange", wake);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const select = useCallback((m: number, hold: boolean) => {
    const s = sim.current;
    s.held = hold;
    if (s.mode !== m) {
      s.mode = m;
      s.t = 0;
      if (m === 0) s.sweep = 0;
    }
    setSnap({ mode: s.mode, t: s.t, sweep: s.sweep, drop: s.drop });
  }, []);
  const release = useCallback(() => {
    sim.current.held = false;
  }, []);

  const scene = useMemo(() => (size && size.w > 0 ? layout(size.w, size.h) : null), [size]);
  const hits = useMemo(() => (scene ? cast(scene, 720) : []), [scene]);

  // Reduced motion: each layer shows its finished state, with no beam in flight.
  const v: Snap = reduced ? { mode: snap.mode, t: 0, sweep: 1, drop: 0 } : snap;
  const mode = v.mode;
  const step = Math.min(LOOP.length - 1, Math.floor((v.t / PHASE) * LOOP.length));

  const pill = "cursor-pointer rounded-full font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.97]";

  return (
    <div ref={root} className="flex flex-col overflow-hidden sm:h-[clamp(440px,48vw,600px)]">
      <style>{CSS}</style>
      <div ref={stage} className="relative h-[300px] sm:h-auto sm:min-h-0 sm:flex-1">
        {scene && size ? <SceneSvg sc={scene} w={size.w} h={size.h} hits={hits} v={v} beam={!reduced} /> : null}
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-3 sm:mt-7 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <div role="group" aria-label="Sensing layer" className="flex flex-wrap gap-2">
          {MODES.map((m, i) => (
            <button
              key={m.name}
              type="button"
              aria-pressed={mode === i}
              onPointerDown={(e) => {
                touch.current = e.pointerType !== "mouse";
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") select(i, true);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") release();
              }}
              onFocus={(e) => {
                if (e.currentTarget.matches(":focus-visible")) select(i, true);
              }}
              onBlur={release}
              // A tap holds the layer; tapping it again lets the loop run on.
              onClick={() => select(i, touch.current ? !(sim.current.held && sim.current.mode === i) : true)}
              className={`${pill} h-11 px-4 text-[16px] sm:h-10 ${mode === i ? "bg-fg text-paper" : "bg-paper text-fg"}`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Reserve the tallest caption's room so nothing shifts as layers change. */}
        <p className="m-0 min-h-[4.5em] max-w-[54ch] text-[18px] font-medium leading-[1.45] text-fg sm:min-h-[2.9em] sm:text-[18px]">
          <span key={mode} className="arrive block">
            {MODES[mode]!.caption}
          </span>
        </p>

        <ol aria-label="The loop: sense, map, plan, act, check" className="m-0 flex list-none flex-wrap gap-1 p-0 sm:gap-1.5">
          {LOOP.map((word, i) => (
            <li
              key={word}
              className={`flex h-8 items-center rounded-full px-2 text-[16px] font-semibold transition-colors duration-300 sm:px-3 sm:text-[16px] ${
                i === step ? "bg-accent text-paper" : "bg-paper text-fg"
              }`}
            >
              {word}
            </li>
          ))}
        </ol>
      </div>

      <p className="m-0 mt-4 text-[16px] font-medium leading-[1.45] text-muted">
        Outdoors, RTK positioning with two antennas gives position and heading. Near structures or indoors, lidar and
        vision take over.
      </p>
    </div>
  );
}

function SceneSvg({ sc, w, h, hits, v, beam }: { sc: Scene; w: number; h: number; hits: Hit[]; v: Snap; beam: boolean }) {
  const { s, k, wide, pad, drone, handle, person, head, headR, torso, pipe, pipeX, valveY, wheelX } = sc;
  const lidar = v.mode === 0;
  const fg = "var(--color-fg)";
  const cy = "var(--color-accent)";
  const paper = "var(--color-paper)";
  const label = wide ? 17 : 15;

  const low = sc.gap * (1 - LOW_M / HOVER_M);
  const dy = drone.y + v.drop * low;
  const metres = ((pad.y - (dy + 5 * s)) / sc.gap) * HOVER_M;

  const n = hits.length;
  const idx = Math.floor((v.sweep % 1) * n);
  const seen = v.sweep >= 1 ? n : idx;
  const origin = { x: drone.x, y: dy - 10 * s };
  const a = -Math.PI / 2 + (idx / Math.max(1, n)) * Math.PI * 2;
  // A ray that meets nothing still shows, running out of the open side.
  const end = hits[idx]?.p ?? { x: origin.x + Math.cos(a) * (w + h), y: origin.y + Math.sin(a) * (w + h) };

  const pb = 8;
  const tabH = label + 10;
  const boxes: { b: Box; label: string; end: boolean }[] = [
    { b: person, label: "person", end: true },
    { b: handle, label: "valve handle", end: false },
    { b: pad, label: "pad marker", end: false },
  ];
  const legW = torso.w * 0.4;
  const mark = pad.h - 6;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="absolute left-0 top-0 block overflow-hidden"
      role="img"
      aria-label="A drone drawn side-on hovering over a charging pad, beside a wall with a pipe and valve handle and a person. Three layers alternate: a lidar beam sweeps and leaves a point map of the space, a rangefinder beam reads an illustrative height above the pad, and vision boxes label the person, the valve handle and the pad marker."
    >
      <g aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${sc.ceilX} ${sc.y0}H${sc.x0}V${sc.y1}H${sc.x1}`} stroke={fg} strokeWidth={2} opacity={0.6} />

        {/* Pipe and valve: a bowtie body, a stem and a handwheel seen edge-on. */}
        <rect x={pipe.x} y={pipe.y} width={pipe.w} height={pipe.h} fill={fg} opacity={0.6} />
        <path d={`M${pipeX - 9 * k} ${valveY - 11 * k}H${pipeX + 9 * k}L${pipeX - 9 * k} ${valveY + 11 * k}H${pipeX + 9 * k}Z`} fill={fg} stroke={fg} strokeWidth={2} />
        <path d={`M${pipeX} ${valveY}H${wheelX}`} stroke={fg} strokeWidth={2.5 * k} />
        <rect x={wheelX - 2.5 * k} y={valveY - 14 * k} width={5 * k} height={28 * k} rx={2.5 * k} fill={fg} />

        <g fill={fg} opacity={0.85}>
          <circle cx={head.x} cy={head.y} r={headR} />
          <rect x={torso.x} y={torso.y} width={torso.w} height={torso.h} rx={torso.w * 0.32} />
          {[0.06, 0.54].map((f) => (
            <rect key={f} x={torso.x + torso.w * f} y={torso.y + torso.h * 0.7} width={legW} height={sc.y1 - torso.y - torso.h * 0.7} rx={Math.min(4, legW / 3)} />
          ))}
        </g>

        {/* Charging pad: the one amber thing, with its markers cut out. */}
        <rect x={pad.x} y={pad.y} width={pad.w} height={pad.h} rx={3} fill="var(--color-amber)" />
        {[0.1, 0.5, 0.9].map((f) => (
          <rect key={f} x={pad.x + pad.w * f - mark / 2} y={pad.y + 3} width={mark} height={mark} fill={paper} />
        ))}

        <g className="fly-layer" data-on={lidar}>
          {beam && lidar ? <line x1={origin.x} y1={origin.y} x2={end.x} y2={end.y} stroke={cy} strokeWidth={2.5} /> : null}
          <g fill={cy}>
            {hits.map((hit, i) => (hit.dot && hit.p && i < seen ? <circle key={i} cx={hit.p.x} cy={hit.p.y} r={3} /> : null))}
          </g>
        </g>

        <g className="fly-layer" data-on={v.mode === 1}>
          <path d={`M${drone.x} ${dy + 5 * s}V${pad.y}M${drone.x - 8} ${pad.y}H${drone.x + 8}`} stroke={cy} strokeWidth={2.5} />
          {/* The readout rides above the drone so it never crosses the scene. */}
          <g textAnchor="middle" fontWeight={600}>
            <text x={drone.x} y={dy - 10 * s - 32} fill={fg} fontSize={wide ? 24 : 20} style={{ fontVariantNumeric: "tabular-nums" }}>
              {metres.toFixed(2)} m
            </text>
            <text x={drone.x} y={dy - 10 * s - 12} fill="var(--color-muted)" fontSize={label}>
              illustrative
            </text>
          </g>
        </g>

        {/* The drone, side-on and solid: body, two rotors on masts, legs with TPU feet. */}
        <g transform={`translate(${drone.x} ${dy}) scale(${s})`}>
          <path d="M-16 0H-28V-7M16 0H28V-7M-9 4L-14 13M9 4L14 13" stroke={fg} strokeWidth={2 / s} />
          <rect x={-16} y={-5} width={32} height={10} rx={5} fill={fg} />
          <rect x={-40} y={-9.5} width={24} height={3} rx={1.5} fill={fg} />
          <rect x={16} y={-9.5} width={24} height={3} rx={1.5} fill={fg} />
          <path d="M-18 13H-10M10 13H18" stroke="var(--color-tpu)" strokeWidth={3 / s} />
          {/* Lidar puck on top: cyan while it is the layer in use. */}
          <rect x={-5} y={-10} width={10} height={5} rx={1.5} fill={lidar ? cy : fg} style={{ transition: "fill .4s" }} />
        </g>

        {boxes.map(({ b, label: text, end: toEnd }, i) => {
          // Tab width from the label's length: close enough for a short sans word.
          const tw = text.length * label * 0.56 + 18;
          const tx = toEnd ? b.x + b.w + pb + 1 - tw : b.x - pb - 1;
          return (
            <g key={text} className="fly-layer" data-on={v.mode === 2} style={{ ["--d" as string]: `${200 + i * 450}ms` }}>
              <rect x={b.x - pb} y={b.y - pb} width={b.w + pb * 2} height={b.h + pb * 2} stroke={cy} strokeWidth={2} strokeLinejoin="miter" />
              <rect x={tx} y={b.y - pb - tabH} width={tw} height={tabH} fill={cy} />
              <text x={tx + tw / 2} y={b.y - pb - tabH / 2 + label * 0.36} textAnchor="middle" fontSize={label} fontWeight={600} fill={paper}>
                {text}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
