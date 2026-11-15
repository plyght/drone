"use client";

import { useState } from "react";
import { FAMILIES, FLEET } from "@/lib/fleet";
import { Cloud } from "./cloud";

const PAD_WORD = { S: "small", M: "medium", L: "large" } as const;

/**
 * The fleet as a roster and a lidar view. Every name re-forms the cloud of
 * points into that aircraft, and the sentences beside it say what it is for.
 */
export function Fleet() {
  const [at, setAt] = useState(() => FLEET.findIndex((c) => c.id === "perseus"));
  const craft = FLEET[at];

  return (
    <div className="grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      {/* The lidar view, with what the selected aircraft is for. On a phone it comes first. */}
      <div className="lg:order-2">
        <div className="lg:sticky lg:top-8">
          <Cloud id={craft.id} name={craft.name} className="aspect-[4/3] w-full sm:aspect-[16/10]" />
          <div key={craft.id} className="swap grid gap-x-12 gap-y-3 pt-2 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div>
              <p className="m-0 text-[clamp(1.8rem,2.6vw,2.3rem)] font-[560] leading-none tracking-[-0.04em]">
                {craft.name}
              </p>
              <p className="m-0 mt-2 font-semibold text-accent">{craft.role}</p>
            </div>
            <div className="max-w-[33em]">
              <p className="m-0 font-medium">{craft.lead}</p>
              <p className="m-0 mt-2 text-muted">{craft.purpose}</p>
              {craft.pad ? (
                <p className="m-0 mt-2 text-muted">
                  It is designed to charge on the {PAD_WORD[craft.pad]} pad, and it talks to the fleet{" "}
                  {craft.computer ? "directly, because it carries its own computer" : "through the ground computer"}.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <nav aria-label="The fleet" className="grid grid-cols-2 gap-x-6 gap-y-8 lg:order-1 lg:grid-cols-1">
        {FAMILIES.map((family) => (
          <div key={family.name}>
            <p className="m-0 text-[16px] font-medium text-muted">{family.name}</p>
            <ul className="m-0 mt-1.5 list-none p-0">
              {FLEET.map((c, i) =>
                c.family === family.name ? (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={i === at}
                      onClick={() => setAt(i)}
                      className={`roster flex min-h-10 w-full items-baseline justify-between gap-3 text-left text-[clamp(1.2rem,1.7vw,1.45rem)] font-[560] tracking-[-0.035em] ${
                        i === at ? "text-fg" : "text-muted"
                      }`}
                    >
                      <span className="roster-name">{c.name}</span>
                      <span className="hidden text-[16px] font-medium tracking-[-0.01em] lg:inline">{c.role}</span>
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
