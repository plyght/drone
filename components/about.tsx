import { SITE } from "@/lib/site";
import { Chapter } from "./chapter";
import { Mark } from "./mark";
import { Resolve } from "./resolve";

const STANDS = [
  { done: true, title: "The CAD exists", text: "There is a real model behind every drone on this page." },
  {
    done: true,
    title: "The parts are printable",
    text: "Most parts are designed to be 3D-printed. The motors, batteries and electronics in the models are stand-ins for size rather than chosen parts.",
  },
  {
    done: false,
    title: "First flights",
    text: "None of the drones has flown yet, so the next steps are printing, weighing and flying them.",
  },
  {
    done: false,
    title: "Closing the loop",
    text: "After that, the real numbers go back into the platform to check its predictions.",
  },
];

/** The founder, where the work stands, and how to reach us. */
export function About() {
  return (
    <footer id="about" className="mx-auto max-w-[1500px] scroll-mt-10 pt-28 sm:pt-44">
      <Chapter title="One person has built all of this so far.">
        Zain Kheraj founded Mercury in 2024. He flies FPV, has built his own drone and prints Mercury&rsquo;s parts
        himself, and the company is self-funded with family support.
      </Chapter>

      <ol className="m-0 mt-10 grid list-none gap-3 px-3 sm:mt-14 sm:grid-cols-2 sm:gap-4 sm:px-8 lg:grid-cols-4">
        {STANDS.map((s, i) => (
          <li key={s.title}>
            <Resolve
              delay={140 + i * 70}
              className={`flex h-full flex-col rounded-[var(--radius-panel)] p-5 sm:p-6 ${
                s.done ? "bg-fg text-paper" : "bg-raised text-fg"
              }`}
            >
              <span className={`tag self-start ${s.done ? "bg-paper text-fg" : "bg-paper text-fg"}`}>
                {s.done ? "Done" : "Next"}
              </span>
              <span className="display mt-10 block text-[clamp(1.6rem,2.1vw,2rem)] sm:mt-16">{s.title}</span>
              <span className={`mt-3 block text-[16px] font-medium leading-[1.42] ${s.done ? "opacity-80" : "text-muted"}`}>
                {s.text}
              </span>
            </Resolve>
          </li>
        ))}
      </ol>

      <Resolve className="px-5 pt-10 sm:px-8">
        <p className="m-0 max-w-[44ch] text-[17px] font-medium leading-[1.5] text-muted">
          Mercury is part of IPN Momentum at Capital Factory in Austin, from 13 to 15 November 2026.
        </p>
      </Resolve>

      <div id="contact" className="scroll-mt-10 px-5 pt-28 sm:px-8 sm:pt-44">
        <Resolve>
          <p className="lede m-0 max-w-[30ch]">
            If you are a mentor, a partner, an investor or someone with a job a drone should be doing, we would like
            to hear from you.
          </p>
        </Resolve>
        <Resolve delay={70}>
          <a
            href={`mailto:${SITE.email}`}
            className="display mt-6 inline-block text-[clamp(3.2rem,13vw,12.5rem)] transition-colors duration-200 hover:text-accent"
          >
            Write to us
          </a>
        </Resolve>
        <Resolve delay={140}>
          <p className="m-0 mt-4 text-[18px] font-semibold">{SITE.email}</p>
        </Resolve>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 pb-8 pt-24 text-[15px] font-medium text-muted sm:px-8 sm:pt-32">
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
