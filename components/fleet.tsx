"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { FAMILIES, FLEET, type Family } from "@/lib/fleet";
import { Resolve } from "./resolve";
import { Viewer } from "./viewer";

/**
 * The flight line: the whole fleet parked in one row that runs off the side
 * of the screen. Drag it, scroll it, or jump to a family. Every plate opens
 * the live 3D view of that aircraft.
 */
export function Fleet() {
  const [open, setOpen] = useState<number | null>(null);
  const [family, setFamily] = useState<Family>("Myrmidon");
  const rail = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean; trail: { x: number; t: number }[] } | null>(null);
  const glide = useRef(0);
  const close = useCallback(() => setOpen(null), []);

  // Which family sits at the rail's leading edge.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const edge = el.getBoundingClientRect().left + el.clientWidth * 0.3;
      let current: Family = "Myrmidon";
      for (const li of Array.from(el.children) as HTMLElement[]) {
        if (li.getBoundingClientRect().left <= edge) current = li.dataset.family as Family;
      }
      setFamily(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Let go: carry on at the release speed and coast to a stop, then let the
  // rail settle on a card again.
  const release = (el: HTMLUListElement) => {
    const d = drag.current;
    if (!d) return;
    setTimeout(() => (drag.current = null));
    const a = d.trail[0];
    const b = d.trail[d.trail.length - 1];
    let v = d.moved && a && b && b.t > a.t ? -(b.x - a.x) / (b.t - a.t) : 0; // px per ms
    let last = performance.now();
    const coast = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      el.scrollLeft += v * dt;
      v *= Math.pow(0.996, dt);
      if (Math.abs(v) > 0.02) glide.current = requestAnimationFrame(coast);
      else el.style.scrollSnapType = "";
    };
    glide.current = requestAnimationFrame(coast);
  };

  const jump = (name: Family) => {
    const el = rail.current;
    const first = el?.querySelector<HTMLElement>(`[data-family="${name}"]`);
    if (!el || !first) return;
    el.scrollTo({ left: first.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    el.scrollBy({ left: dir * (card.offsetWidth + 16) * (window.innerWidth < 640 ? 1 : 2), behavior: "smooth" });
  };

  return (
    <>
      <Resolve delay={140} className="mt-10 flex flex-wrap items-center justify-between gap-4 px-5 sm:mt-14 sm:px-8">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Jump to a family">
          {FAMILIES.map((f) => (
            <button
              key={f.name}
              type="button"
              aria-pressed={family === f.name}
              onClick={() => jump(f.name)}
              className={`pill ${family === f.name ? "bg-fg text-paper" : "bg-raised text-fg"}`}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="hidden gap-2 sm:flex">
          <button type="button" onClick={() => step(-1)} aria-label="Earlier in the line" className="pill w-11 justify-center bg-raised px-0 text-[20px] text-fg">
            ‹
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Further along the line" className="pill w-11 justify-center bg-raised px-0 text-[20px] text-fg">
            ›
          </button>
        </div>
      </Resolve>

      <Resolve delay={200} className="mt-5">
        <ul
          ref={rail}
          className="rail m-0 flex list-none snap-x snap-proximity gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 sm:gap-4 sm:scroll-px-8 sm:px-8"
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") return;
            // Grabbing the rail stops any glide where it is.
            cancelAnimationFrame(glide.current);
            e.currentTarget.style.scrollSnapType = "none";
            drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false, trail: [] };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > 6) d.moved = true;
            if (d.moved) e.currentTarget.scrollLeft = d.left - dx;
            // Keep the last 100ms of movement, to read the release speed from.
            const now = performance.now();
            d.trail.push({ x: e.clientX, t: now });
            while (d.trail.length > 2 && now - d.trail[0].t > 100) d.trail.shift();
          }}
          onPointerUp={(e) => release(e.currentTarget)}
          onPointerLeave={(e) => release(e.currentTarget)}
        >
          {FLEET.map((c, i) => (
            <li key={c.id} data-family={c.family} className="w-[min(82vw,560px)] shrink-0 snap-start">
              <button
                type="button"
                draggable={false}
                onClick={() => {
                  // A drag that ends on a card is not a click on it.
                  if (!drag.current?.moved) setOpen(i);
                }}
                aria-label={`${c.name}, ${c.role}. Open the 3D view.`}
                className="card group relative block aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-panel)] bg-plate text-left text-plate-fg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static plate */}
                <img
                  src={asset(`/img/fleet/${c.id}.webp`)}
                  alt=""
                  width={720}
                  height={540}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="card-img h-full w-full select-none object-cover"
                />
                <span className="absolute left-4 top-4 flex gap-1.5 sm:left-5 sm:top-5">
                  <span className="tag bg-plate-fg text-plate">{c.role}</span>
                </span>
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-[linear-gradient(to_top,#050607d9,#05060700)] p-4 pt-16 sm:p-5 sm:pt-20">
                  <span className="display text-[clamp(2rem,4.6vw,3.3rem)]">{c.name}</span>
                  <span className="pill shrink-0 bg-plate-fg/15 text-plate-fg backdrop-blur-sm transition-colors group-hover:bg-accent group-hover:text-plate">
                    Open in 3D
                  </span>
                </span>
              </button>
              <p className="mx-1 mt-3.5 max-w-[34ch] text-[16px] font-medium leading-[1.4] text-muted">{c.lead}</p>
            </li>
          ))}
        </ul>
      </Resolve>
      {open !== null ? <Viewer index={open} onIndex={setOpen} onClose={close} /> : null}
    </>
  );
}
