import { SITE } from "@/lib/site";
import { Mark } from "./mark";
import { Resolve } from "./resolve";

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

/** The founder, where the work stands, and how to reach us. */
export function About() {
  return (
    <footer id="about" className="mx-auto max-w-[1400px] scroll-mt-10 px-5 pt-28 sm:px-10 sm:pt-40">
      <div className="grid gap-x-20 gap-y-14 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Resolve>
            <h2 className="sec-h">One person has built all of this so far.</h2>
          </Resolve>
          <Resolve delay={70} className="mt-4 max-w-[33em] space-y-4 text-muted">
            <p>
              Zain Kheraj founded Mercury in 2024. He flies FPV, has built his own drone and prints Mercury&rsquo;s
              parts himself, and the company is self-funded with family support.
            </p>
            <p>
              Mercury is part of IPN Momentum at Capital Factory in Austin, from 13 to 15 November 2026.
            </p>
          </Resolve>
        </div>

        <ol className="m-0 list-none space-y-6 p-0">
          {STANDS.map((s, i) => (
            <li key={s.title}>
              <Resolve delay={70 + i * 60} className="grid grid-cols-[1.6rem_1fr]">
                <span
                  aria-hidden
                  className={`mt-[0.52em] size-[9px] rounded-full ${s.done ? "bg-accent" : "bg-muted opacity-40"}`}
                />
                <span>
                  <span className="sr-only">{s.done ? "Done: " : "Ahead: "}</span>
                  <span className="block font-semibold tracking-[-0.02em]">{s.title}</span>
                  <span className="block max-w-[30em] text-muted">{s.text}</span>
                </span>
              </Resolve>
            </li>
          ))}
        </ol>
      </div>

      <div id="contact" className="scroll-mt-10 pt-28 sm:pt-40">
        <Resolve>
          <p className="m-0 max-w-[17em] text-[clamp(1.6rem,2.6vw,2.3rem)] font-[560] leading-[1.12] tracking-[-0.04em]">
            If you are a mentor, a partner, an investor or someone with a job a drone should be doing,{" "}
            <a href={`mailto:${SITE.email}`} className="link">
              we would like to hear from you
            </a>
            .
          </p>
        </Resolve>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 pb-8 pt-24 text-[16px] text-muted sm:pt-32">
        <span className="flex items-center gap-2.5 font-semibold text-fg">
          <Mark className="size-[16px]" />© 2026 {SITE.name}
        </span>
        <span>{SITE.footnote}</span>
        <a href="#top" className="link">
          Back to the top
        </a>
      </div>
    </footer>
  );
}
