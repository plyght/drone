import type { ReactNode } from "react";
import { FlyFigure } from "./figures/fly";
import { PlatformFigure } from "./figures/platform";
import { TalkFigure } from "./figures/talk";
import { Chapter } from "./chapter";
import { Resolve } from "./resolve";
import { SITE } from "@/lib/site";

function Panel({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <Resolve delay={140} className="mt-8 px-3 sm:mt-12 sm:px-8">
      <div className="rounded-[var(--radius-panel)] bg-raised p-4 sm:p-8 lg:p-10">{children}</div>
      {note ? <p className="mx-2 mt-4 text-[15px] font-medium text-muted">{note}</p> : null}
    </Resolve>
  );
}

/** How the fleet talks, how it sees, and the workbench that designs it. */
export function How() {
  return (
    <>
      <section id="talk" className="mx-auto max-w-[1500px] scroll-mt-10 pt-28 sm:pt-44">
        <Chapter title="Every drone knows what the others are doing.">
          Some drones carry their own computer and talk to each other directly. The rest carry only a flight
          controller, so the ground computer thinks for them and passes their messages on.
        </Chapter>
        <Panel note={SITE.footnote}>
          <TalkFigure />
        </Panel>
      </section>

      <section id="fly" className="mx-auto max-w-[1500px] scroll-mt-10 pt-28 sm:pt-44">
        <Chapter title="They see in three ways before they decide.">
          Lidar gives the shape of the space, a laser rangefinder gives the exact distance, and cameras say what
          things are.
        </Chapter>
        <Panel note={SITE.footnote}>
          <FlyFigure />
        </Panel>
      </section>

      <section id="platform" className="mx-auto max-w-[1500px] scroll-mt-10 pt-28 sm:pt-44">
        <Chapter title="We built the workbench that designs them.">
          Mercury is also an engineering platform that runs on a laptop. It reads the CAD, tries variants, plans
          every print and compares flights with its own predictions, and a person approves every step.
        </Chapter>
        <Panel>
          <PlatformFigure />
        </Panel>
      </section>
    </>
  );
}
