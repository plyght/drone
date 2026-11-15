"use client";

import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { FLEET } from "@/lib/fleet";

const pads = (size: "S" | "M" | "L") => FLEET.filter((c) => c.pad === size).length;

type Scene = { plate: string; alt: string; name: string; line: string; tags?: string[] };

const SCENES: Scene[] = [
  {
    plate: "perseus-claw",
    alt: "Close view under Perseus: a three-fingered claw with orange flexible pads, hanging below the airframe.",
    name: "Perseus",
    line: "It is designed to reach down with a claw that adjusts itself to what it finds, grip it and carry it back.",
  },
  {
    plate: "menoetius-rotor",
    alt: "Close view of one of Menoetius's rotors, mounted at a tilt on its arm.",
    name: "Menoetius",
    line: "Its rotors are tilted so that it can twist in mid-air, which is what lets a braced tool head turn a valve or a bolt.",
  },
  {
    plate: "prometheus-tool",
    alt: "Close view under Prometheus: a gripper head with orange pads hanging from the rail beneath the body.",
    name: "Prometheus",
    line: "The flagship carries one large tool on a rail under its body, and the head of that tool swaps between six.",
    tags: ["Gripper", "Torque head", "Camera gimbal", "Winch", "Blower", "Contact probe"],
  },
  {
    plate: "rack-heads",
    alt: "The Prometheus tool rack: tool heads hanging in a row from a frame, each on the same quick-change plate.",
    name: "The tool rack",
    line: "Every head shares one quick-change plate, so Prometheus is designed to land, leave one head here and take the next.",
  },
  {
    plate: "astraeus-low",
    alt: "Low view along Astraeus: a flying wing standing on rotor pylons with orange feet.",
    name: "Astraeus",
    line: "It is a flying wing designed to lift off like a drone and fly like a plane, so a family can check in on someone far away.",
  },
  {
    plate: "pad-corner",
    alt: "The medium charging pad: a low flat deck with square orange markers at its corners and centre.",
    name: "The charging pad",
    line: "Every drone is designed to charge through coils in its feet, so it lands on a pad and there is nothing to plug in.",
    tags: [`Small pad, ${pads("S")} drones`, `Medium pad, ${pads("M")} drones`, `Large pad, ${pads("L")} drones`],
  },
];

/**
 * The work, up close. The screen holds still while the page scrolls under it,
 * and one studio plate hands over to the next through a blur, each with the
 * name of the aircraft at full size and one sentence about its job.
 */
export function Scenes() {
  const root = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = Math.min(0.9999, Math.max(0, -r.top / travel));
      setAt(Math.floor(p * SCENES.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const go = (i: number) => {
    const el = root.current;
    if (!el) return;
    const travel = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((i + 0.5) / SCENES.length) * travel, behavior: "smooth" });
  };

  return (
    <div ref={root} style={{ height: `${SCENES.length * 85 + 100}svh` }} className="relative mt-10 sm:mt-14">
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-plate text-plate-fg">
        {SCENES.map((s, i) => (
          <figure key={s.plate} data-on={i === at} aria-hidden={i !== at} className="scene-layer absolute inset-0 m-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static plate */}
            <img
              src={asset(`/img/close/${s.plate}-1600.webp`)}
              srcSet={`${asset(`/img/close/${s.plate}-960.webp`)} 960w, ${asset(`/img/close/${s.plate}-1600.webp`)} 1600w`}
              sizes="100vw"
              alt={s.alt}
              width={1600}
              height={1000}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,#050607f2_0%,#050607b3_45%,#05060700_100%)] p-5 pt-32 sm:p-8 sm:pt-40">
              <span className="scene-words block">
              <span className="display block text-[clamp(3rem,9vw,8.4rem)]">{s.name}</span>
              <span className="mt-4 block max-w-[30em] text-[clamp(1.1rem,1.7vw,1.45rem)] font-normal leading-[1.35] tracking-[-0.02em] sm:mt-6">
                {s.line}
              </span>
              {s.tags ? (
                <span className="mt-5 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
                    <span key={t} className="tag bg-plate-fg text-plate">
                      {t}
                    </span>
                  ))}
                </span>
              ) : null}
              </span>
            </figcaption>
          </figure>
        ))}

        {/* Where you are in the sequence, and a way to jump. */}
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1 sm:right-6">
          {SCENES.map((s, i) => (
            <button
              key={s.plate}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${s.name}`}
              aria-current={i === at}
              className="grid h-7 w-7 place-items-center"
            >
              <span
                className={`block w-[5px] rounded-full transition-all duration-500 ease-[var(--ease-out)] ${
                  i === at ? "h-6 bg-accent" : "h-[5px] bg-plate-fg/55"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
