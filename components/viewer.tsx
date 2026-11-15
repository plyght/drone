"use client";

import { useEffect, useRef } from "react";
import { FLEET } from "@/lib/fleet";
import { Stage } from "./stage";

const PAD_WORD = { S: "small", M: "medium", L: "large" } as const;

/**
 * One aircraft, full screen: the live model on the studio plate, and beside
 * it what the aircraft is for. Arrow keys and the two buttons move through
 * the fleet; Escape closes.
 */
export function Viewer({
  index,
  onIndex,
  onClose,
}: {
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const craft = FLEET[index];
  const prev = FLEET[(index - 1 + FLEET.length) % FLEET.length];
  const next = FLEET[(index + 1) % FLEET.length];
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onIndex((index - 1 + FLEET.length) % FLEET.length);
      else if (e.key === "ArrowRight") onIndex((index + 1) % FLEET.length);
      else if (e.key === "Tab" && panel.current) {
        // Keep focus inside the dialog.
        const stops = panel.current.querySelectorAll<HTMLElement>("button, a[href]");
        const first = stops[0];
        const last = stops[stops.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onIndex, onClose]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={`${craft.name}, ${craft.role}`}
      className="viewer fixed inset-0 z-50 flex flex-col bg-paper lg:flex-row"
    >
      <div className="relative h-[50svh] shrink-0 p-3 pb-0 sm:p-5 sm:pb-0 lg:h-auto lg:flex-1 lg:pb-5 lg:pr-0">
        <div className="relative h-full overflow-hidden rounded-[var(--radius-panel)] bg-plate">
          <Stage id={craft.id} label={craft.name} />
          <p className="pointer-events-none absolute bottom-4 left-5 text-[14px] font-semibold text-plate-fg/80">
            Drag to turn it
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:w-[460px] lg:flex-none">
        <div className="flex items-center justify-between px-5 pt-4 sm:px-8 lg:pt-6">
          <p className="text-[15px] font-semibold tabular-nums text-muted">
            {index + 1} of {FLEET.length}
          </p>
          <button ref={close} type="button" onClick={onClose} className="pill bg-raised text-fg hover:bg-fg hover:text-paper">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:px-8 lg:flex lg:flex-col lg:justify-end lg:pb-8">
          {/* Re-keyed per aircraft, so the words resolve in as the model does. */}
          <div key={craft.id} className="arrive" style={{ ["--resolve-delay" as string]: "120ms" }}>
            <p className="flex flex-wrap gap-1.5">
              <span className="tag bg-raised text-fg">{craft.family}</span>
              <span className="tag bg-accent text-paper">{craft.role}</span>
              {craft.pad ? <span className="tag bg-amber text-paper">Pad {craft.pad}</span> : null}
            </p>
            <h2 className="display mt-4 text-[clamp(2.8rem,5.4vw,4.4rem)]">{craft.name}</h2>
            <p className="mt-5 text-[21px] font-medium leading-[1.25] tracking-[-0.025em]">{craft.lead}</p>
            <p className="mt-3 max-w-[40ch] text-[17px] leading-[1.5] text-muted">{craft.purpose}</p>
            {craft.pad ? (
              <p className="mt-5 max-w-[40ch] text-[16px] font-medium leading-[1.45] text-muted">
                It is designed to charge on the {PAD_WORD[craft.pad]} pad, and it talks to the fleet{" "}
                {craft.computer ? "directly, because it carries its own computer" : "through the ground computer"}.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:p-5 sm:pt-0">
          <button
            type="button"
            onClick={() => onIndex((index - 1 + FLEET.length) % FLEET.length)}
            className="pill min-h-12 justify-start bg-raised text-fg hover:bg-fg hover:text-paper"
          >
            <span aria-hidden>‹</span>
            <span className="sr-only">Previous: </span>
            <span className="truncate">{prev.name}</span>
          </button>
          <button
            type="button"
            onClick={() => onIndex((index + 1) % FLEET.length)}
            className="pill min-h-12 justify-end bg-raised text-fg hover:bg-fg hover:text-paper"
          >
            <span className="sr-only">Next: </span>
            <span className="truncate">{next.name}</span>
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
