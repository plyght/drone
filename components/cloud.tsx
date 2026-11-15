"use client";

import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import type { Cloud as Engine } from "@/lib/cloud";

/**
 * The lidar view of one aircraft: a live cloud of points you can drag to
 * turn. Changing `id` re-forms the cloud into the next aircraft. If WebGL is
 * not there, the studio render of the aircraft stands in.
 */
export function Cloud({ id, name, className }: { id: string; name: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const first = useRef(id);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    // Start only when the stage is near the screen: the model and three.js are not needed before.
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting || engine.current) return;
        io.disconnect();
        const { Cloud } = await import("@/lib/cloud");
        if (gone) return;
        const c = new Cloud(el, { onReady: () => setState("ready"), onFail: () => setState("failed") });
        engine.current = c;
        await c.start(first.current);
        // The selection may have moved on while the first model loaded.
        void c.show(first.current);
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      gone = true;
      io.disconnect();
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    first.current = id;
    void engine.current?.show(id);
  }, [id]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={host}
        role="img"
        aria-label={`${name}, drawn as a cloud of points. Drag to turn it.`}
        className={`h-full w-full transition-opacity duration-700 ease-[var(--ease-out)] ${state === "ready" ? "opacity-100" : "opacity-0"}`}
      />
      {state === "failed" ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized static plate
        <img
          src={asset(`/img/fleet/${id}.webp`)}
          alt={`Studio render of ${name}.`}
          className="absolute inset-0 h-full w-full rounded-[var(--radius-plate)] object-cover"
        />
      ) : null}
    </div>
  );
}
