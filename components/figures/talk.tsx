"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * How the fleet stays connected, as one drawn scene with four modes.
 * Cyan solid = direct drone-to-drone traffic. Amber dashed = relayed traffic.
 */

type Pt = { x: number; y: number };
type Side = "above" | "below" | "left" | "right";
type DroneId =
  | "lynceus"
  | "pallas"
  | "astraeus"
  | "perseus"
  | "castor"
  | "pollux";

const MODES = [
  {
    label: "Drone to drone",
    caption:
      "Drones with their own computer share a radio mesh and exchange position, heading, battery and findings directly.",
    note: "Shared: RTK position, two-antenna heading (no compass), battery, task, findings.",
    dur: 3.2,
    still: 0.3,
    on: ["lynceus", "pallas", "astraeus"],
  },
  {
    label: "Through the ground computer",
    caption:
      "A drone with only a flight controller reports to the ground computer, which plans for it and forwards messages.",
    note: "That is how one drone hands a job to another: Lynceus finds it, Perseus fetches it.",
    dur: 3.4,
    still: 0.74,
    on: ["lynceus", "perseus", "castor"],
  },
  {
    label: "Relay in the air",
    caption:
      "When the ground link is blocked, Pollux is designed to hold station overhead and pass messages along.",
    note: "",
    dur: 3.4,
    still: 0.8,
    on: ["castor", "pollux"],
  },
  {
    label: "If the link drops",
    caption:
      "A drone is designed to hold position, then fly back to its charging pad on its own.",
    note: "A person approves every task.",
    dur: 4.6,
    still: 0.9,
    on: ["perseus"],
  },
] as const satisfies readonly {
  label: string;
  caption: string;
  note: string;
  dur: number;
  still: number;
  on: readonly DroneId[];
}[];

const DRONES: { id: DroneId; name: string; computer: boolean }[] = [
  { id: "lynceus", name: "Lynceus", computer: true },
  { id: "pallas", name: "Pallas", computer: true },
  { id: "astraeus", name: "Astraeus", computer: true },
  { id: "perseus", name: "Perseus", computer: false },
  { id: "castor", name: "Castor", computer: false },
  { id: "pollux", name: "Pollux", computer: false },
];

// Positions as fractions of the scene, one table per layout, so the phone
// scene is recomposed rather than shrunk and labels stay at 12px.
type Spot = [number, number, Side];
const WIDE: Record<DroneId, Spot> = {
  lynceus: [0.1, 0.34, "above"],
  pallas: [0.27, 0.17, "above"],
  astraeus: [0.3, 0.48, "below"],
  perseus: [0.9, 0.3, "above"],
  castor: [0.72, 0.64, "right"],
  pollux: [0.6, 0.13, "above"],
};
const NARROW: Record<DroneId, Spot> = {
  lynceus: [0.14, 0.3, "above"],
  pallas: [0.42, 0.12, "above"],
  astraeus: [0.36, 0.42, "below"],
  perseus: [0.85, 0.36, "above"],
  castor: [0.66, 0.62, "below"],
  pollux: [0.74, 0.1, "above"],
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (u: number) =>
  u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const lerp = (a: Pt, b: Pt, u: number): Pt => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
});
/** Pull a link's ends in so it stops short of the glyphs it joins. */
function trim(a: Pt, b: Pt, ra: number, rb: number): [Pt, Pt] {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return [lerp(a, b, ra / d), lerp(a, b, 1 - rb / d)];
}

const FG = "var(--color-fg)";
const CYAN = "var(--color-accent)";
const AMBER = "var(--color-amber)";
const FADE = "opacity 0.7s var(--ease-out), filter 0.7s var(--ease-out)";

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function Link({
  a,
  b,
  relayed,
  opacity,
}: {
  a: Pt;
  b: Pt;
  relayed?: boolean;
  opacity: number;
}) {
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={relayed ? AMBER : CYAN}
      strokeWidth={2.5}
      strokeDasharray={relayed ? "7 8" : undefined}
      strokeLinecap="round"
      style={{
        opacity,
        filter: opacity ? "blur(0)" : "blur(8px)",
        transition: FADE,
      }}
    />
  );
}

function Packet({
  a,
  b,
  u,
  relayed,
  show,
}: {
  a: Pt;
  b: Pt;
  u: number;
  relayed?: boolean;
  show: boolean;
}) {
  if (!show) return null;
  const p = lerp(a, b, u);
  return <circle cx={p.x} cy={p.y} r={5} fill={relayed ? AMBER : CYAN} />;
}

/** Side-on drone as a solid shape: two rotors on an arm, a body, two legs. */
function Drone({
  at,
  name,
  side,
  computer,
  active,
  hidden,
  small,
}: {
  at: Pt;
  name: string;
  side: Side;
  computer: boolean;
  active: boolean;
  hidden?: boolean;
  small: boolean;
}) {
  const label =
    side === "above"
      ? { x: 0, y: computer ? -24 : -19, anchor: "middle" as const }
      : side === "below"
        ? { x: 0, y: 33, anchor: "middle" as const }
        : side === "left"
          ? { x: -32, y: 6, anchor: "end" as const }
          : { x: 32, y: 6, anchor: "start" as const };
  return (
    <g
      transform={`translate(${at.x} ${at.y})`}
      style={{
        opacity: hidden ? 0 : 1,
        filter: hidden ? "blur(8px)" : "blur(0)",
        transition: FADE,
      }}
    >
      {/* Drones outside the current mode step back, but stay readable. */}
      <g style={{ opacity: active ? 1 : 0.6, transition: FADE }}>
        <g fill={FG}>
          <rect x={-26} y={-11} width={20} height={4} rx={2} />
          <rect x={6} y={-11} width={20} height={4} rx={2} />
          <rect x={-17.5} y={-9} width={3} height={7} />
          <rect x={14.5} y={-9} width={3} height={7} />
          <rect x={-19} y={-5} width={38} height={4} rx={2} />
          <rect x={-10} y={-6} width={20} height={13} rx={4} />
        </g>
        <path
          d="M-7 6L-11 14M7 6L11 14"
          stroke={FG}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
        {/* The cyan dome marks a drone that carries its own computer. */}
        {computer ? <path d="M-6 -6a6 6 0 0 1 12 0z" fill={CYAN} /> : null}
      </g>
      <text
        x={label.x}
        y={label.y}
        textAnchor={label.anchor}
        fontSize={small ? 15 : 17}
        fontWeight={600}
        fill={active ? FG : "var(--color-muted)"}
        style={{ transition: "fill 0.4s var(--ease-out)" }}
      >
        {name}
      </text>
    </g>
  );
}

function Scene({
  w,
  h,
  mode,
  p,
}: {
  w: number;
  h: number;
  mode: number;
  p: number;
}) {
  const wide = w >= 640;
  const table = wide ? WIDE : NARROW;
  const at = (id: DroneId): Pt => ({
    x: Math.round(table[id][0] * w),
    y: Math.round(table[id][1] * h),
  });
  const gy = h - 34;
  const gcX = Math.round(w * (wide ? 0.42 : 0.3));
  const gc: Pt = { x: gcX, y: gy - 52 }; // antenna tip, where ground links land
  const home = at("perseus");
  const pad: Pt = { x: home.x, y: gy - 20 };
  const wall = wide
    ? { x: w * 0.57, y: h * 0.44, w: Math.max(40, w * 0.045) }
    : { x: w * 0.46, y: h * 0.61, w: 26 };

  const on = (id: DroneId) =>
    (MODES[mode]!.on as readonly DroneId[]).includes(id);
  const L = at("lynceus");
  const P = at("pallas");
  const A = at("astraeus");
  const C = at("castor");
  const X = at("pollux");
  const R = 36;
  const mesh = [trim(L, P, R, R), trim(P, A, R, R), trim(A, L, R, R)];
  const lg = trim(L, gc, R, 12);
  const gp = trim(gc, home, 12, R);
  const gcC = trim(gc, C, 12, R);
  const gx = trim(gc, X, 12, R);
  const xc = trim(X, C, R, R);
  // Where the straight ground link to Castor meets the obstacle's near face.
  const hitU = (wall.x - gc.x) / (C.x - gc.x);
  const hit = lerp(gc, C, hitU - 10 / Math.hypot(C.x - gc.x, C.y - gc.y));
  const stub = trim(gc, hit, 12, 0);

  // Mode 4: the link fades, Perseus holds, then descends to its pad.
  const m4 = mode === 3;
  const linkGone = m4 ? seg(p, 0.2, 0.32) : 0;
  const holdRing = m4 ? seg(p, 0.26, 0.34) * (1 - seg(p, 0.5, 0.56)) : 0;
  const drop = m4 ? ease(seg(p, 0.54, 0.86)) : 0;
  const perseusAt = lerp(home, pad, drop);
  const landed = m4 && p >= 0.86;
  const status =
    !m4 || p < 0.24
      ? ""
      : p < 0.54
        ? "link lost, holding"
        : p < 0.86
          ? "returning to pad"
          : "on its pad";
  // Perseus leaves the pad by fading, then resolves back in the air.

  const up = ease(seg(p, 0.06, 0.4));
  const down = ease(seg(p, 0.56, 0.9));
  const thinking = mode === 1 && p > 0.38 && p < 0.58;
  const text = {
    fontSize: wide ? 17 : 15,
    fontWeight: 600,
    fill: "var(--color-muted)",
  };

  return (
    <>
      <line
        x1={1}
        y1={gy}
        x2={w - 1}
        y2={gy}
        stroke={FG}
        strokeOpacity={0.6}
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Obstacle: only present while it is blocking the ground link. */}
      <g
        style={{
          opacity: mode === 2 ? 1 : 0,
          filter: mode === 2 ? "blur(0)" : "blur(8px)",
          transition: FADE,
        }}
      >
        <rect
          x={wall.x}
          y={wall.y}
          width={wall.w}
          height={gy - wall.y}
          rx={3}
          fill={FG}
          fillOpacity={0.6}
        />
        {wide ? (
          <text
            x={wall.x + wall.w / 2}
            y={gy + 22}
            textAnchor="middle"
            {...text}
          >
            obstacle
          </text>
        ) : null}
        <Link a={stub[0]} b={stub[1]} relayed opacity={mode === 2 ? 0.65 : 0} />
        <path
          d={`M${hit.x - 5} ${hit.y - 5}l10 10m0 -10l-10 10`}
          stroke={FG}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {mesh.map(([a, b], i) => (
        <Link key={i} a={a} b={b} opacity={mode === 0 ? 1 : 0} />
      ))}
      <Link a={lg[0]} b={lg[1]} relayed opacity={mode === 1 ? 1 : 0} />
      <Link a={gcC[0]} b={gcC[1]} relayed opacity={mode === 1 ? 1 : 0} />
      <Link
        a={gp[0]}
        b={gp[1]}
        relayed
        opacity={mode === 1 ? 1 : m4 ? 1 - linkGone : 0}
      />
      <Link a={gx[0]} b={gx[1]} relayed opacity={mode === 2 ? 1 : 0} />
      <Link a={xc[0]} b={xc[1]} relayed opacity={mode === 2 ? 1 : 0} />

      {/* The way home, drawn once the drone is on its own. */}
      <line
        x1={home.x}
        y1={perseusAt.y + 24}
        x2={pad.x}
        y2={pad.y - 4}
        stroke={FG}
        strokeOpacity={0.65}
        strokeWidth={2.5}
        strokeDasharray="0.1 9"
        strokeLinecap="round"
        style={{
          opacity: m4 && p > 0.5 && p < 0.84 ? 1 : 0,
          transition: "opacity 0.4s var(--ease-out)",
        }}
      />
      <circle
        cx={home.x}
        cy={home.y}
        r={wide ? 50 : 44}
        fill="none"
        stroke={FG}
        strokeOpacity={0.65}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="0.1 8"
        opacity={holdRing}
      />
      {/* On phones the status sits above the drone, where there is room. */}
      {status ? (
        <text
          x={wide ? home.x - 62 : w - 2}
          y={wide ? home.y + 5 : home.y - 54}
          textAnchor="end"
          {...text}
          fill={FG}
        >
          {status}
        </text>
      ) : null}

      {/* Ground computer: a solid case on the ground with a mast. */}
      <rect x={gcX - 22} y={gy - 26} width={44} height={25} rx={4} fill={FG} />
      <rect x={gcX - 1.25} y={gy - 46} width={2.5} height={22} fill={FG} />
      <circle
        cx={gcX}
        cy={gy - 48}
        r={5}
        fill={thinking ? AMBER : FG}
        style={{ transition: "fill 0.3s var(--ease-out)" }}
      />
      <text
        x={Math.max(gcX, wide ? 0 : 54)}
        y={gy + 22}
        textAnchor="middle"
        {...text}
      >
        ground computer
      </text>

      <rect
        x={pad.x - 24}
        y={gy - 7}
        width={48}
        height={6}
        rx={2}
        fill={landed ? AMBER : FG}
        style={{ transition: "fill 0.3s var(--ease-out)" }}
      />
      <text
        x={Math.min(pad.x, w - (wide ? 46 : 42))}
        y={gy + 22}
        textAnchor="middle"
        {...text}
      >
        charging pad
      </text>

      {DRONES.map((d) => (
        <Drone
          key={d.id}
          at={d.id === "perseus" ? perseusAt : at(d.id)}
          name={d.name}
          side={table[d.id][2]}
          computer={d.computer}
          active={on(d.id)}
          hidden={d.id === "perseus" && m4 && p > 0.95}
          small={!wide}
        />
      ))}

      {/* Packets: constant speed around the mesh, eased hops through the ground. */}
      {mesh.map(([a, b], i) => (
        <Packet
          key={i}
          a={i % 2 ? b : a}
          b={i % 2 ? a : b}
          u={(p * 2 + i * 0.37) % 1}
          show={mode === 0}
        />
      ))}
      <Packet
        a={lg[0]}
        b={lg[1]}
        u={up}
        relayed
        show={mode === 1 && p > 0.06 && p < 0.4}
      />
      <Packet
        a={gcC[1]}
        b={gcC[0]}
        u={up}
        relayed
        show={mode === 1 && p > 0.06 && p < 0.4}
      />
      <Packet
        a={gp[0]}
        b={gp[1]}
        u={down}
        relayed
        show={mode === 1 && p > 0.56 && p < 0.9}
      />
      <Packet
        a={gcC[0]}
        b={gcC[1]}
        u={down}
        relayed
        show={mode === 1 && p > 0.56 && p < 0.9}
      />
      <Packet
        a={stub[0]}
        b={stub[1]}
        u={ease(seg(p, 0.02, 0.2))}
        relayed
        show={mode === 2 && p > 0.02 && p < 0.22}
      />
      <Packet
        a={gx[0]}
        b={gx[1]}
        u={ease(seg(p, 0.3, 0.58))}
        relayed
        show={mode === 2 && p > 0.3 && p < 0.58}
      />
      <Packet
        a={xc[0]}
        b={xc[1]}
        u={ease(seg(p, 0.62, 0.9))}
        relayed
        show={mode === 2 && p > 0.62 && p < 0.9}
      />
      <Packet
        a={gp[0]}
        b={gp[1]}
        u={ease(seg(p, 0, 0.18))}
        relayed
        show={m4 && p < 0.18}
      />
    </>
  );
}

export function TalkFigure() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState({ mode: 0, p: 0 });
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  // The loop's own state lives in refs so the handlers never restart it.
  const clock = useRef({ mode: 0, t: 0, hold: null as number | null });

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e)
        setSize({
          w: Math.round(e.contentRect.width),
          h: Math.round(e.contentRect.height),
        });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    let frame = 0;
    let last: number | undefined;
    let seen = false;
    const tick = (now: number) => {
      // Clamp long gaps so nothing lurches after a stalled frame.
      const dt = last === undefined ? 0 : Math.min(now - last, 64) / 1000;
      last = now;
      const c = clock.current;
      c.t += dt;
      const dur = MODES[c.mode]!.dur;
      if (c.t >= dur) {
        c.t = 0;
        if (c.hold !== c.mode) c.mode = (c.mode + 1) % MODES.length;
      }
      setView({ mode: c.mode, p: c.t / MODES[c.mode]!.dur });
      frame = requestAnimationFrame(tick);
    };
    // Run only while on screen and the tab is visible.
    const sync = () => {
      const run = seen && document.visibilityState === "visible";
      if (run && !frame) {
        last = undefined;
        frame = requestAnimationFrame(tick);
      } else if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const io = new IntersectionObserver(([e]) => {
      seen = !!e?.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const hold = (i: number) => {
    const c = clock.current;
    c.hold = i;
    if (c.mode !== i) {
      c.mode = i;
      c.t = 0;
      setView({ mode: i, p: 0 });
    }
  };
  const release = () => {
    clock.current.hold = null;
  };

  const mode = view.mode;
  // Reduced motion: each mode is one finished frame.
  const p = reduced ? MODES[mode]!.still : view.p;
  const m = MODES[mode]!;

  return (
    <div ref={root} className="talk-fig w-full">
      <style>{`@media (prefers-reduced-motion: reduce){.talk-fig *{transition:none!important}}`}</style>
      <div
        ref={stage}
        className="h-[430px] w-full sm:h-[clamp(350px,34vw,460px)]"
      >
        {size ? (
          <svg
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            className="block select-none font-sans"
            role="img"
            aria-label="A fleet of drones above a ground computer. Drones with their own computer exchange messages directly; drones with only a flight controller are reached through the ground computer, or through Pollux overhead when the ground link is blocked. If the link drops, a drone is designed to hold, then return to its charging pad."
          >
            <g aria-hidden>
              <Scene w={size.w} h={size.h} mode={mode} p={p} />
            </g>
          </svg>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {MODES.map((it, i) => (
          <button
            key={it.label}
            type="button"
            aria-pressed={i === mode}
            onMouseEnter={() => hold(i)}
            onMouseLeave={release}
            onFocus={() => hold(i)}
            onBlur={release}
            onClick={() => hold(i)}
            className={`h-10 cursor-pointer rounded-full px-4 text-[16px] font-semibold transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.97] max-sm:h-11 ${
              i === mode ? "bg-fg text-paper" : "bg-paper text-fg"
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>

      {/* Reserved height, so the pills and legend do not jump between modes. */}
      <div className="mt-5 min-h-[136px] max-w-[66ch] sm:min-h-[84px]">
        <p
          key={mode}
          className="arrive m-0 text-[18px] font-medium leading-[1.45] text-fg sm:text-[18px]"
        >
          {m.caption}
          {m.note ? (
            <span className="mt-1.5 block text-[16px] font-semibold text-muted">
              {m.note}
            </span>
          ) : null}
        </p>
      </div>

      <ul className="m-0 mt-4 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-[16px] font-semibold text-fg">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-[3px] bg-accent" />
          Direct
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-[3px] bg-amber" />
          Relayed
        </li>
      </ul>
    </div>
  );
}
