import type { ReactNode } from "react";
import { Resolve } from "./resolve";

/**
 * The opening of a chapter: one loud line on the left and the sentence that
 * explains it on the right, both resting on the same baseline.
 */
export function Chapter({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid items-end gap-x-12 gap-y-5 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] ${className ?? ""}`}>
      <Resolve>
        <h2 className="title max-w-[11em]">{title}</h2>
      </Resolve>
      <Resolve delay={70}>
        <p className="lede m-0 lg:pb-2">{children}</p>
      </Resolve>
    </div>
  );
}
