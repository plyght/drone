"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/*
 * "The workbench that designs them."
 *
 * Left, the arm study: two beam cross-sections of equal area on one print
 * bed. For a solid rectangle at constant area, bending stiffness goes as the
 * height squared, so the slider's far end is set to land exactly on the 1.43x
 * that Mercury's own study found for its real arm. Only that end is labelled
 * as a finding; values in between are just the drawn rectangle.
 *
 * Right, the workbench loop: five steps with a gate a person has to open. The
 * last step waits on first flights, so it is a dashed pill and the marker goes hollow.
 */

const STUDY = 1.43; // Mercury's study result, the only headline number
const H_END = Math.sqrt(STUDY); // height ratio that gives 1.43x at equal area
const ASPECT = 1.25; // baseline width over height: wider than tall

const STEPS = [
  { label: "Read the CAD", note: "Mercury reads the CAD on a laptop. Everything stays local." },
  { label: "Try variants", note: "It generates design variants. An AI partner can research and propose." },
  { label: "Check them", note: "Each variant is checked before anything is planned for the printer." },
  { label: "A person approves", note: "Nothing is printed, flown or changed without the founder's approval." },
  { label: "Plan the print", note: "Every part is planned for the 3D printer." },
  { label: "Compare the flight", note: "Real flights will be compared with predictions. No drone has flown yet." },
] as const;
const GATE = 3;
const WAIT_AT = GATE - 0.3; // where the marker stops, just short of the gate

// Seconds spent on each step, then a short fade before the loop restarts.
const DWELL = [1.6, 1.6, 1.6, 2.8, 1.8, 2.2, 0.6];
const START = DWELL.map((_, i) => DWELL.slice(0, i).reduce((a, b) => a + b, 0));
const CYCLE = DWELL.reduce((a, b) => a + b, 0);
const GATE_OPENS = 2.1; // seconds into the wait before the gate swings open
const RESUME_AFTER = 8; // seconds of no input before the handle drifts again

type Frame = { s: number; active: number; pos: number; gate: number; op: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const posOf = (i: number) => (i === GATE ? WAIT_AT : Math.min(i, STEPS.length - 1));

/** The finished state: shown under reduced motion and before the loop runs. */
function settle(active: number, s: number): Frame {
  return { s, active, pos: posOf(active), gate: active > GATE ? 1 : 0, op: 1 };
}

/** Idle drift of the handle: rest at baseline, rise to the study, rest, return. */
function drift(t: number) {
  const u = t % 11;
  if (u < 1.2) return 0;
  if (u < 4.8) return ease((u - 1.2) / 3.6);
  if (u < 9) return 1;
  return 1 - ease((u - 9) / 2);
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function PlatformFigure() {
  const rootRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const arm = useSize(armRef);
  const loop = useSize(loopRef);

  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const [frame, setFrame] = useState<Frame>(() => settle(GATE, 1));
  const [manual, setManual] = useState<number | null>(null); // slider value set by hand
  const [hover, setHover] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const held = hover ?? pin;

  // The loop reads these; handlers keep them in step with the state above.
  const input = useRef<{ v: number; idle: number } | null>(null);
  const dragging = useRef(false);
  const heldRef = useRef<number | null>(null);
  useEffect(() => {
    heldRef.current = held;
  }, [held]);
  // A tapped step holds for a while, then the loop carries on by itself.
  useEffect(() => {
    if (pin === null) return;
    const id = window.setTimeout(() => setPin(null), 6000);
    return () => window.clearTimeout(id);
  }, [pin]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || reduced) return;
    const sim = { t: 0, ta: 0, s: 0, pos: 0, gate: 0, op: 0 };
    let inView = false;
    let raf: number | undefined;
    let last: number | undefined;

    const tick = (now: number) => {
      raf = undefined;
      // Clamp long gaps so nothing lurches after a stall.
      const dt = last === undefined ? 0 : Math.min(now - last, 64) / 1000;
      last = now;

      // Workbench loop. Holding a step parks the clock at its start, so the
      // loop carries on from there when it is released.
      const h = heldRef.current;
      if (h !== null) sim.t = START[h];
      else sim.t = (sim.t + dt) % CYCLE;
      let i = DWELL.length - 1;
      while (START[i] > sim.t) i--;
      const local = sim.t - START[i];
      const leaving = i === STEPS.length;
      const active = Math.min(i, STEPS.length - 1);
      const open = !leaving && (i > GATE || (i === GATE && h === null && local > GATE_OPENS));
      const toward = (k: number) => 1 - Math.exp(-k * dt);
      sim.op += ((leaving ? 0 : 1) - sim.op) * toward(9);
      // The marker returns to the top while it is faded out, never by sliding back.
      if (sim.op < 0.06 && posOf(active) < sim.pos - 1) sim.pos = posOf(active);
      sim.pos += (posOf(active) - sim.pos) * toward(6);
      sim.gate += ((open ? 1 : 0) - sim.gate) * toward(8);

      // Arm study. A hand on the slider wins; after a rest the drift resumes.
      const inp = input.current;
      if (inp) {
        if (!dragging.current) inp.idle += dt;
        sim.s += (inp.v - sim.s) * toward(18);
        if (inp.idle > RESUME_AFTER) {
          input.current = null;
          sim.ta = 0;
          setManual(null);
        }
      } else {
        sim.ta += dt;
        sim.s += (drift(sim.ta) - sim.s) * toward(5);
      }

      setFrame({ s: sim.s, active, pos: sim.pos, gate: sim.gate, op: sim.op });
      wake();
    };
    const wake = () => {
      if (raf !== undefined) return;
      if (!inView || document.visibilityState !== "visible") {
        last = undefined;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        wake();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    document.addEventListener("visibilitychange", wake);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
      if (raf !== undefined) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const view = reduced ? settle(held ?? GATE, manual ?? 1) : frame;
  // Snap the last hair so the far end reads exactly as the study's number.
  const s = view.s > 0.997 ? 1 : view.s < 0.003 ? 0 : view.s;
  const hr = 1 + s * (H_END - 1); // height over baseline height
  const stiff = hr * hr;
  const atStudy = s === 1;

  const setSlider = (v: number) => {
    const c = clamp01(v);
    input.current = { v: c, idle: 0 };
    setManual(c);
  };
  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (r) setSlider((e.clientX - r.left) / r.width);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = input.current?.v ?? s;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? cur + 0.05
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? cur - 0.05
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setSlider(next);
  };

  // Arm study geometry, in pixels.
  const phone = arm.w > 0 && arm.w < 520;
  const gap = phone ? 20 : 56;
  const colW = Math.max(10, (arm.w - gap) / 2);
  const yBed = arm.h - 96;
  const u = Math.max(8, Math.min(colW * 0.72, (yBed - 8) / H_END)); // baseline height
  const cols = [0, colW + gap];
  const barMax = colW; // the bar's full length is the study's 1.43x
  const rect = (cx: number, hRatio: number) => {
    const rh = u * hRatio;
    const rw = (u * ASPECT) / hRatio; // equal area: width gives back what height takes
    return { x: cx - rw / 2, y: yBed - rh, width: rw, height: rh };
  };
  const label = { fontSize: phone ? 13 : 14, fontWeight: 600 };

  // Workbench loop geometry: six pills down a rail, with room under the last.
  const railX = 12;
  const top = 22;
  const pitch = Math.max(50, (loop.h - top - 50) / (STEPS.length - 1));
  const yAt = (p: number) => top + p * pitch;
  const hollow = view.pos > GATE + 1.2; // past the last finished step

  return (
    <div
      ref={rootRef}
      className="grid gap-y-12 font-sans lg:h-[clamp(420px,48vw,560px)] lg:grid-cols-[1.3fr_1fr] lg:gap-x-16"
    >
      <div className="flex h-[400px] min-w-0 flex-col lg:h-auto">
        <p className="flex flex-wrap items-baseline gap-x-3 text-[14px] font-semibold text-muted" aria-hidden="true">
          <span className="text-[48px] font-bold leading-none tracking-[-0.03em] text-accent tabular-nums">
            {stiff.toFixed(2)}x
          </span>
          the stiffness of the wider arm
        </p>

        <div ref={armRef} className="relative mt-4 min-h-0 flex-1">
          {arm.w > 0 && (
            <svg
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label={`Two arm cross-sections of equal area lying flat on a print bed. The wider one is the baseline at 1.00x stiffness. The taller one is at ${stiff.toFixed(2)}x. Mercury's study found about 1.43x for the same material.`}
            >
              <g aria-hidden="true" strokeLinecap="round">
                <rect {...rect(cols[0] + colW / 2, 1)} rx={4} fill="var(--color-fg)" fillOpacity={0.3} />
                <rect {...rect(cols[1] + colW / 2, hr)} rx={4} fill="var(--color-accent)" />
                {/* The baseline outline stays over the taller arm for comparison. */}
                <rect
                  {...rect(cols[1] + colW / 2, 1)}
                  rx={4}
                  fill="none"
                  stroke="var(--color-fg)"
                  strokeOpacity={0.65}
                  strokeWidth={2}
                  strokeDasharray="1 7"
                />
                <line x1={1} x2={arm.w - 1} y1={yBed + 1} y2={yBed + 1} stroke="var(--color-fg)" strokeOpacity={0.6} strokeWidth={2} />
                <text x={arm.w} y={yBed + 26} textAnchor="end" fill="var(--color-muted)" {...label}>
                  {phone ? "Print bed" : "Print bed, no supports"}
                </text>

                <rect x={cols[0]} y={yBed + 44} width={barMax / STUDY} height={13} rx={6.5} fill="var(--color-fg)" fillOpacity={0.3} />
                <text x={cols[0]} y={yBed + 82} fill="var(--color-fg)" {...label}>
                  Wider
                </text>
                <rect x={cols[1]} y={yBed + 44} width={(barMax * stiff) / STUDY} height={13} rx={6.5} fill="var(--color-accent)" />
                <text x={cols[1]} y={yBed + 82} fill="var(--color-fg)" {...label}>
                  Taller, same area
                </text>
              </g>
            </svg>
          )}
        </div>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Arm height at equal area"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(s * 100)}
          aria-valuetext={`${stiff.toFixed(2)} times the baseline stiffness${atStudy ? ", Mercury's study" : ""}`}
          className="relative mt-2 h-11 cursor-ew-resize touch-pan-y select-none px-[14px]"
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (dragging.current) fromPointer(e);
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* The track runs under the thumb's half width at both ends. */}
          <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-fg/30" />
          <div ref={trackRef} className="relative h-full">
            <div
              className="absolute -left-[14px] top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-accent"
              style={{ width: `calc(${s * 100}% + 14px)` }}
            />
            <div
              className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
              style={{ left: `${s * 100}%` }}
            />
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[13px] font-semibold text-muted sm:text-[14px]" aria-hidden="true">
          <span>Baseline</span>
          <span className={atStudy ? "text-fg" : undefined}>Mercury&apos;s study</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col lg:h-auto">
        <div ref={loopRef} className="relative h-[330px] min-h-0 lg:h-auto lg:flex-1">
          {loop.w > 0 && (
            <svg
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label="The workbench loop: read the CAD, try variants, check them, a person approves, plan the print, then compare the flight, which waits on first flights."
            >
              <g aria-hidden="true" fill="none" stroke="var(--color-fg)" strokeWidth={2} strokeLinecap="round">
                <line x1={railX} x2={railX} y1={yAt(0)} y2={yAt(4)} strokeOpacity={0.6} />
                <line x1={railX} x2={railX} y1={yAt(4) + 8} y2={yAt(5)} strokeOpacity={0.6} strokeDasharray="1 7" />
                {/* The gate: a bar across the rail that swings clear once approved. */}
                <line
                  x1={railX - 10}
                  x2={railX + 10}
                  y1={yAt(GATE)}
                  y2={yAt(GATE)}
                  strokeWidth={3}
                  stroke={view.gate > 0.5 ? "var(--color-accent)" : "var(--color-fg)"}
                  transform={`rotate(${-78 * view.gate} ${railX - 10} ${yAt(GATE)})`}
                />
                <circle
                  cx={railX}
                  cy={yAt(view.pos)}
                  r={hollow ? 7 : 8}
                  stroke={hollow ? "var(--color-accent)" : "none"}
                  strokeWidth={2.5}
                  fill={hollow ? "var(--color-raised)" : "var(--color-accent)"}
                  opacity={view.op}
                />
              </g>
            </svg>
          )}
          {loop.w > 0 &&
            STEPS.map((step, i) => {
              const on = view.active === i;
              const tone =
                i === GATE
                  ? "bg-fg text-paper"
                  : i === 5
                    ? `border-2 border-dashed text-fg ${on ? "border-accent" : "border-fg/60"}`
                    : on
                      ? "bg-accent text-paper"
                      : "bg-paper text-fg";
              return (
                <button
                  key={step.label}
                  type="button"
                  aria-pressed={pin === i}
                  // The 2px pad makes a 44px touch target around a 40px pill.
                  className="absolute left-10 cursor-pointer py-[2px] text-left"
                  style={{ top: yAt(i) - 22 }}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => setPin(pin === i ? null : i)}
                >
                  <span
                    className={`flex h-10 items-center whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-colors duration-300 ${tone}`}
                  >
                    {step.label}
                  </span>
                  {i === 5 && (
                    <span className="mt-1 block whitespace-nowrap px-4 text-[13px] font-semibold text-muted sm:text-[14px]">
                      After first flights
                    </span>
                  )}
                </button>
              );
            })}
        </div>
        <p className="mt-5 min-h-[3lh] max-w-[36ch] text-[16px] font-medium leading-[1.45] text-fg">
          {STEPS[view.active].note}
        </p>
      </div>
    </div>
  );
}
