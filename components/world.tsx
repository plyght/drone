"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { asset } from "@/lib/asset";
import type { Cloud } from "@/lib/cloud";
import { FAMILIES, FLEET } from "@/lib/fleet";
import { SITE } from "@/lib/site";
import type { Target } from "@/lib/targets";
import { HeroFilm } from "./hero-film";
import { Mark } from "./mark";
import { Plate } from "./plate";

type Chapter = "hero" | "fleet" | "film" | "rack" | "talk" | "fly" | "arms" | "about";

const PAD_WORD = { S: "small", M: "medium", L: "large" } as const;

const HEADS = [
  { name: "Gripper", line: "to hold and carry" },
  { name: "Torque head", line: "to turn valves and bolts" },
  { name: "Camera gimbal", line: "to look closely" },
  { name: "Winch", line: "to lower and lift" },
  { name: "Blower", line: "to clear debris" },
  { name: "Contact probe", line: "to measure by touch" },
];

const TALK_MODES = [
  {
    name: "Drone to drone",
    streams: [10, 19],
    line: "Drones with their own computer share a radio mesh, and exchange position, heading, battery and findings with no ground station in the loop.",
  },
  {
    name: "Through the ground computer",
    streams: [20, 29],
    line: "A drone with only a flight controller reports to the ground computer, which plans for it and forwards anything another drone needs to know.",
  },
  {
    name: "Relay in the air",
    streams: [30, 39],
    line: "When a wall blocks the ground link, Pollux is designed to hold station overhead and pass the messages along.",
  },
] as const;

const FLY_MODES = [
  {
    name: "Lidar",
    line: "A spinning laser builds a 3D map of walls, pipes and people, and it works in the dark and without GPS.",
  },
  {
    name: "Rangefinder",
    line: "One precise beam gives the height above the pad, which is what makes the last few centimetres of a landing safe.",
  },
  {
    name: "Vision",
    line: "Cameras recognise what things are: a person, a valve handle, the markers on a charging pad.",
  },
] as const;

// Mercury's design study: arms about this much stiffer for the same material.
const STUDY = 1.43;

const STANDS = [
  { done: true, title: "The CAD exists.", text: "There is a real model behind every drone on this page." },
  {
    done: true,
    title: "The parts are printable.",
    text: "Most parts are designed to be 3D-printed. The motors, batteries and electronics in the models are stand-ins for size rather than chosen parts.",
  },
  {
    done: false,
    title: "The first flights come next.",
    text: "None of the drones has flown yet, so the next steps are printing, weighing and flying them.",
  },
  {
    done: false,
    title: "Then the loop closes.",
    text: "The real numbers go back into the platform to check its predictions.",
  },
];

/** A text choice: the chosen one is underlined in the accent, the rest wait a step back. */
function Choice({ on, onPick, children }: { on: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      onPointerEnter={(e) => e.pointerType === "mouse" && onPick()}
      onFocus={onPick}
      className={`choice min-h-10 text-left font-semibold tracking-[-0.02em] ${on ? "text-fg" : "text-muted"}`}
    >
      <span className="choice-name">{children}</span>
    </button>
  );
}

/**
 * The whole page is drawn with one field of points. It sits behind the text
 * (or, on a phone, in a band above it) and re-forms as the reader moves:
 * it scans in as the flagship, becomes whichever drone is picked, turns into
 * the tool rack, the fleet passing messages, a room under a lidar sweep, two
 * printed arms under load, and at the end the Mercury mark.
 */
export function World() {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const cloud = useRef<Cloud | null>(null);
  const [gl, setGl] = useState<"pending" | "on" | "off">("pending");
  const [chapter, setChapter] = useState<Chapter>("hero");
  const [craft, setCraft] = useState(() => FLEET.findIndex((c) => c.id === "perseus"));
  const [head, setHead] = useState(-1);
  const [talk, setTalk] = useState(0);
  const [fly, setFly] = useState(0);
  const [ratio, setRatio] = useState(STUDY);
  const selected = FLEET[craft];

  // Start the field.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    (async () => {
      const { Cloud } = await import("@/lib/cloud");
      if (gone) return;
      const c = new Cloud(el);
      const ok = await c.start();
      if (gone) return c.dispose();
      if (!ok) return setGl("off");
      cloud.current = c;
      setGl("on");
    })();
    return () => {
      gone = true;
      cloud.current?.dispose();
      cloud.current = null;
    };
  }, []);

  // Whichever chapter crosses the middle of the screen is the one on show.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setChapter((e.target as HTMLElement).dataset.chapter as Chapter);
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    document.querySelectorAll("[data-chapter]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Form the scene the chapter calls for.
  const first = useRef(true);
  useEffect(() => {
    const c = cloud.current;
    if (gl !== "on" || !c) return;
    let stale = false;
    (async () => {
      const THREE = await import("three");
      const T = await import("@/lib/targets");
      const n = c.count;
      let target: Target | null = null;
      let scan = false;
      if (chapter === "hero") {
        target = T.aircraft(await T.sample(THREE, "prometheus"), n);
        scan = first.current;
      } else if (chapter === "fleet") {
        target = T.aircraft(await T.sample(THREE, selected.id), n);
      } else if (chapter === "rack") {
        target = T.rack(await T.sample(THREE, "prometheus-tool-rack"), n);
      } else if (chapter === "talk") {
        target = T.talk(await Promise.all(T.TALK.drones.map((d) => T.sample(THREE, d.id))), n);
      } else if (chapter === "fly") {
        target = T.room(await T.sample(THREE, "lynceus"), n);
        scan = true;
      } else if (chapter === "arms") {
        target = T.arms(STUDY, n);
      } else if (chapter === "about") {
        target = T.mark(n);
      }
      if (stale || !target) return;
      first.current = false;
      c.show(target, { scan });
    })();
    return () => {
      stale = true;
    };
    // The fleet chapter also re-forms when another aircraft is picked.
  }, [gl, chapter, chapter === "fleet" ? selected.id : ""]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where the scene sits: to the right of the text on a wide screen, filling its band on a phone.
  useEffect(() => {
    const c = cloud.current;
    const el = host.current;
    if (gl !== "on" || !c || !el) return;
    const place = () => {
      const wide = window.innerWidth >= 1024;
      const aspect = el.clientWidth / el.clientHeight;
      const big = chapter === "hero" || chapter === "fleet";
      if (wide) c.frame(chapter === "about" ? 0.46 : 0.4, 0, Math.min(0.96, aspect * (big ? 0.6 : chapter === "about" ? 0.4 : 0.55)), chapter === "about" ? 0.00005 : 0.00012);
      else c.frame(0, 0, Math.min(0.95, aspect * 0.86));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [gl, chapter]);

  // Per-chapter controls reach into the scene.
  useEffect(() => {
    const c = cloud.current;
    if (gl !== "on" || !c) return;
    // Each chapter states both, so nothing carries over from the one before.
    c.highlight(chapter === "rack" && head >= 0 ? head + 1 : -1);
    if (chapter === "talk") c.streams(TALK_MODES[talk].streams[0], TALK_MODES[talk].streams[1]);
    else if (chapter === "fly" && fly === 1) c.streams(40, 40);
    else c.streams(-1, -1);
  }, [gl, chapter, head, talk, fly]);

  useEffect(() => {
    const c = cloud.current;
    if (gl !== "on" || !c || chapter !== "arms") return;
    let stale = false;
    import("@/lib/targets").then((T) => {
      if (!stale) c.show(T.arms(ratio, c.count), { instant: true });
    });
    return () => {
      stale = true;
    };
  }, [gl, chapter, ratio]);

  // Names that follow points in the scene.
  useEffect(() => {
    const c = cloud.current;
    const box = labels.current;
    if (gl !== "on" || !c || !box) return;
    let dead = false;
    import("@/lib/targets").then((T) => {
      if (dead) return;
      const marks: { text: string; at: [number, number, number] }[] =
        chapter === "talk"
          ? [
              ...T.TALK.drones.map((d) => ({ text: d.name, at: [d.at[0], d.at[1] + 0.17, d.at[2]] as [number, number, number] })),
              { text: "Ground computer", at: [T.TALK.ground[0], T.TALK.ground[1] - 0.14, T.TALK.ground[2]] },
            ]
          : chapter === "fly" && fly === 2
            ? [
                { text: "Person", at: [T.ROOM.person[0], T.ROOM.person[1] + 0.6, T.ROOM.person[2]] },
                { text: "Valve handle", at: [T.ROOM.valve[0] + 0.1, T.ROOM.valve[1] + 0.2, T.ROOM.valve[2]] },
                { text: "Pad marker", at: [T.ROOM.pad[0], T.ROOM.pad[1] - 0.1, T.ROOM.pad[2]] },
              ]
            : [];
      box.replaceChildren(
        ...marks.map((m) => {
          const el = document.createElement("span");
          el.textContent = m.text;
          el.className = "label";
          return el;
        }),
      );
      c.onFrame = marks.length
        ? () => {
            marks.forEach((m, i) => {
              const [x, y] = c.project(...m.at);
              (box.children[i] as HTMLElement).style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            });
          }
        : null;
    });
    return () => {
      dead = true;
      c.onFrame = null;
      box.replaceChildren();
    };
  }, [gl, chapter, fly]);

  const hidden = chapter === "film" || gl !== "on";

  return (
    <div className="relative">
      {/* The field. Full screen behind the text on a wide screen; a band above it on a phone. */}
      <div
        className={`field fixed inset-x-0 top-0 z-20 h-[46svh] bg-paper transition-opacity duration-700 ease-[var(--ease-out)] lg:z-0 lg:h-[100svh] lg:bg-transparent ${
          hidden ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-hidden={hidden}
      >
        <div ref={host} role="img" aria-label="A live cloud of points, drawing the scene each section describes. Drag to turn it." className="h-full w-full" />
        <div ref={labels} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-6">
        <a href="#top" className="arrive pointer-events-auto flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.03em]">
          <Mark className="size-[19px]" />
          {SITE.name}
        </a>
        <a href="#contact" className="arrive btn pointer-events-auto" style={{ ["--resolve-delay" as string]: "120ms" }}>
          Write to us
        </a>
      </header>

      <main id="top" className="pointer-events-none relative z-10">
        <Scene id="hero" first>
          <h1 className="arrive max-w-[11em] text-[clamp(2.1rem,3.6vw,3.2rem)] font-[560] leading-[1.04] tracking-[-0.04em]" style={{ ["--resolve-delay" as string]: "300ms" }}>
            {SITE.tagline}
          </h1>
          <p className="arrive mt-6 text-muted" style={{ ["--resolve-delay" as string]: "420ms" }}>
            Mercury designs aircraft that carry, reach and respond, so that a drone can check in on someone, help in a
            rescue or inspect what is hard to reach instead of only filming it.
          </p>
          <p className="arrive mt-4 text-muted" style={{ ["--resolve-delay" as string]: "510ms" }}>
            What you see on this page is drawn the way a lidar would see it, from the real CAD. Everything here is a
            design, and{" "}
            <a href="#about" className="link text-fg">
              none of it has flown yet
            </a>
            .
          </p>
        </Scene>

        <Scene id="fleet" title="Each drone is built for one job." tall>
          <p className="mt-3 text-muted">
            A drone that does one job well is lighter, cheaper and easier to trust than one that does everything. Pick
            a name and the points re-form into that aircraft.
          </p>
          <nav aria-label="The fleet" className="mt-8 grid grid-cols-2 gap-x-8 gap-y-7">
            {FAMILIES.map((family) => (
              <div key={family.name}>
                <p className="text-[16px] text-muted">{family.name}</p>
                <ul className="m-0 mt-1 list-none p-0">
                  {FLEET.map((c, i) =>
                    c.family === family.name ? (
                      <li key={c.id}>
                        <button
                          type="button"
                          aria-pressed={i === craft}
                          onClick={() => setCraft(i)}
                          className={`choice min-h-9 text-left text-[clamp(1.15rem,1.5vw,1.35rem)] font-[560] tracking-[-0.035em] ${
                            i === craft ? "text-fg" : "text-muted"
                          }`}
                        >
                          <span className="choice-name">{c.name}</span>
                        </button>
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            ))}
          </nav>
          <div key={selected.id} className="swap mt-9">
            <p className="font-semibold text-accent">{selected.role}</p>
            <p className="mt-1 font-medium">{selected.lead}</p>
            <p className="mt-2 text-muted">{selected.purpose}</p>
            {selected.pad ? (
              <p className="mt-2 text-muted">
                It is designed to charge on the {PAD_WORD[selected.pad]} pad, and it talks to the fleet{" "}
                {selected.computer ? "directly, because it carries its own computer" : "through the ground computer"}.
              </p>
            ) : null}
            {gl === "off" ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized static plate
              <img src={asset(`/img/fleet/${selected.id}.webp`)} alt={`Studio render of ${selected.name}.`} className="mt-6 w-full rounded-[var(--radius-plate)]" />
            ) : null}
          </div>
        </Scene>

        {/* The studio renders: the one place the points step aside for photographs. */}
        <section data-chapter="film" id="film" className="pointer-events-auto mx-auto max-w-[1400px] scroll-mt-10 px-5 py-28 sm:px-10 sm:py-40">
          <h2 className="sec-h">The tool goes where a camera would be.</h2>
          <p className="sec-p">
            We design each airframe to be printed in carbon-nylon and built on carbon tube, around the one piece of
            work it is for. These are studio renders of that CAD.
          </p>
          <div className="mt-10 overflow-hidden rounded-[var(--radius-plate)] bg-plate">
            <HeroFilm video={asset("/img/hero.mp4")} poster={asset("/img/hero.webp")} className="aspect-[16/10] w-full sm:aspect-[2/1]" />
          </div>
          <p className="mt-3.5 font-semibold tracking-[-0.02em]">Prometheus</p>
          <p className="max-w-[30em] text-muted">One rotor of eight on the flagship design.</p>
          <div className="mt-10 grid grid-cols-1 gap-x-4 gap-y-9 md:grid-cols-12">
            <Plate
              name="perseus-claw"
              alt="Close view under Perseus: a three-fingered claw with orange flexible pads, hanging below the airframe."
              title="Perseus"
              line="It is designed to reach down with a claw that adjusts itself to what it finds, grip it and carry it back."
              sizes="(min-width: 1400px) 760px, (min-width: 768px) 58vw, 100vw"
              className="md:col-span-7"
            />
            <Plate
              name="menoetius-rotor"
              alt="Close view of one of Menoetius's rotors, mounted at a tilt on its arm."
              title="Menoetius"
              line="Its rotors are tilted so that it can twist in mid-air and turn a valve or a bolt."
              sizes="(min-width: 1400px) 540px, (min-width: 768px) 42vw, 100vw"
              className="md:col-span-5"
              ratio="aspect-[16/10] md:aspect-[8/7]"
            />
            <Plate
              name="pad-corner"
              alt="The medium charging pad: a low flat deck with square orange markers at its corners and centre."
              title="The charging pad"
              line="Every drone is designed to charge through coils in its feet, so it lands on a pad and there is nothing to plug in."
              sizes="(min-width: 1400px) 540px, (min-width: 768px) 42vw, 100vw"
              className="md:col-span-5"
              ratio="aspect-[16/10] md:aspect-[8/7]"
            />
            <Plate
              name="astraeus-low"
              alt="Low view along Astraeus: a flying wing standing on rotor pylons with orange feet."
              title="Astraeus"
              line="It is a flying wing designed to lift off like a drone and fly like a plane, so a family can check in on someone far away."
              sizes="(min-width: 1400px) 760px, (min-width: 768px) 58vw, 100vw"
              className="md:col-span-7"
            />
          </div>
        </section>

        <Scene id="rack" title="The flagship swaps its tools.">
          <p className="mt-3 text-muted">
            Prometheus is a large octocopter with one rail under its body. The rail carries one large tool, and its
            head swaps between six at this rack, where every head shares one quick-change plate.
          </p>
          <ul className="m-0 mt-7 grid list-none grid-cols-2 gap-x-8 p-0" onPointerLeave={() => setHead(-1)}>
            {HEADS.map((h, i) => (
              <li key={h.name}>
                <Choice on={i === head} onPick={() => setHead(i)}>
                  {h.name}
                </Choice>
                <span className="-mt-1.5 block pb-3 text-muted">{h.line}</span>
              </li>
            ))}
          </ul>
        </Scene>

        <Scene id="talk" title="Every drone knows what the others are doing.">
          <p className="mt-3 text-muted">
            Some drones carry their own computer and talk to each other directly. The rest carry only a flight
            controller, so the ground computer thinks for them and passes their messages on.
          </p>
          <div className="mt-7 flex flex-col items-start">
            {TALK_MODES.map((m, i) => (
              <Choice key={m.name} on={i === talk} onPick={() => setTalk(i)}>
                {m.name}
              </Choice>
            ))}
          </div>
          <p key={talk} className="swap mt-5 font-medium">
            {TALK_MODES[talk].line}
          </p>
          <p className="mt-5 text-[16px] text-muted">{SITE.footnote}</p>
        </Scene>

        <Scene id="fly" title="They see in three ways before they decide.">
          <p className="mt-3 text-muted">
            Lidar gives the shape of the space, a laser rangefinder gives the exact distance, and cameras say what
            things are. Near structures or indoors, these take over from satellite positioning.
          </p>
          <div className="mt-7 flex flex-col items-start">
            {FLY_MODES.map((m, i) => (
              <Choice
                key={m.name}
                on={i === fly}
                onPick={() => {
                  if (i === 0 && fly !== 0) cloud.current?.rescan();
                  setFly(i);
                }}
              >
                {m.name}
              </Choice>
            ))}
          </div>
          <p key={fly} className="swap mt-5 font-medium">
            {FLY_MODES[fly].line}
          </p>
          <p className="mt-5 text-[16px] text-muted">{SITE.footnote}</p>
        </Scene>

        <Scene id="arms" anchor="platform" title="We built the workbench that designs them.">
          <p className="mt-3 text-muted">
            Mercury is also an engineering platform that runs on a laptop. It reads the CAD, tries variants, plans
            every print and compares flights with its own predictions, and a person approves every step.
          </p>
          <p className="mt-4 text-muted">
            One early result is in front of you. Two printed arms use the same material, and the taller one sags less
            under the same load, because stiffness grows with the cube of the height.
          </p>
          <p className="mt-7 text-[clamp(2.4rem,4vw,3.4rem)] font-[560] leading-none tracking-[-0.04em] tabular-nums text-accent">
            {ratio.toFixed(2)}x
          </p>
          <p className="mt-1 font-medium">the stiffness of the wider arm</p>
          <label className="mt-5 block">
            <span className="sr-only">How much taller the second arm is</span>
            <input
              type="range"
              min={1}
              max={STUDY}
              step={0.01}
              value={ratio}
              onChange={(e) => setRatio(Number(e.target.value))}
              aria-valuetext={`${ratio.toFixed(2)} times as stiff`}
              className="slider w-full max-w-[22rem]"
            />
          </label>
          <p className="mt-1 flex max-w-[22rem] justify-between text-[16px] text-muted">
            <span>The same arm</span>
            <span>Mercury&rsquo;s study</span>
          </p>
        </Scene>

        <Scene id="about" title="One person has built all of this so far." tall>
          <p className="mt-3 text-muted">
            Zain Kheraj founded Mercury in 2024. He flies FPV, has built his own drone and prints Mercury&rsquo;s
            parts himself, and the company is self-funded with family support. Mercury is part of IPN Momentum at
            Capital Factory in Austin, from 13 to 15 November 2026.
          </p>
          <ol className="m-0 mt-8 list-none space-y-5 p-0">
            {STANDS.map((s) => (
              <li key={s.title} className="grid grid-cols-[1.6rem_1fr]">
                <span aria-hidden className={`mt-[0.52em] size-[9px] rounded-full ${s.done ? "bg-accent" : "bg-muted opacity-40"}`} />
                <span>
                  <span className="sr-only">{s.done ? "Done: " : "Ahead: "}</span>
                  <span className="block font-semibold tracking-[-0.02em]">{s.title}</span>
                  <span className="block text-muted">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p id="contact" className="mt-16 scroll-mt-[50svh] text-[clamp(1.5rem,2.3vw,2rem)] font-[560] leading-[1.14] tracking-[-0.04em]">
            If you are a mentor, a partner, an investor or someone with a job a drone should be doing,{" "}
            <a href={`mailto:${SITE.email}`} className="link">
              we would like to hear from you
            </a>
            .
          </p>
          <p className="mt-12 text-[16px] text-muted">
            © 2026 {SITE.name}. {SITE.footnote}
          </p>
        </Scene>
      </main>
    </div>
  );
}

/**
 * One chapter of the page: a column of text that holds the left of a wide
 * screen (the points have the right), or the lower half of a phone (the
 * points have the band above).
 */
function Scene({
  id,
  anchor,
  title,
  first,
  tall,
  children,
}: {
  id: Chapter;
  /** A second id for links that predate the chapter's name. */
  anchor?: string;
  title?: string;
  first?: boolean;
  tall?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      data-chapter={id}
      id={id === "hero" ? undefined : id}
      className={`flex scroll-mt-0 px-5 sm:px-10 lg:min-h-[100svh] lg:items-center ${
        first ? "min-h-[100svh] items-end pb-10 pt-[50svh] lg:pb-0 lg:pt-0" : "min-h-[90svh] items-start pb-24 pt-[52svh] lg:py-28"
      } ${tall ? "lg:items-start lg:pt-36" : ""}`}
    >
      {anchor ? <span id={anchor} /> : null}
      <div className="pointer-events-auto w-full lg:w-[min(31rem,40vw)]">
        {title ? <h2 className="sec-h">{title}</h2> : null}
        {children}
      </div>
    </section>
  );
}
