import { asset } from "@/lib/asset";
import { SITE } from "@/lib/site";
import { HeroFilm } from "./hero-film";
import { Mark } from "./mark";

const at = (ms: number) => ({ style: { ["--resolve-delay" as string]: `${ms}ms` } });

/**
 * The opening: the mark, one studio film close on a rotor, then the line
 * that says what Mercury is and a few sentences of what follows from it.
 */
export function Hero() {
  return (
    <div id="top" className="mx-auto max-w-[1400px] px-5 pt-6 sm:px-10 sm:pt-7">
      <header className="flex items-center justify-between">
        <a href="#top" {...at(0)} className="arrive flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.03em]">
          <Mark className="size-[19px]" />
          {SITE.name}
        </a>
        <a href="#fleet" {...at(120)} className="arrive btn">
          See the fleet
        </a>
      </header>

      <div
        {...at(200)}
        className="arrive relative mt-6 overflow-hidden rounded-[var(--radius-plate)] bg-plate sm:mt-7"
      >
        <HeroFilm
          video={asset("/img/hero.mp4")}
          poster={asset("/img/hero.webp")}
          className="h-[min(62svh,600px)] min-h-[300px] w-full"
        />
      </div>

      <section aria-labelledby="hero-title" className="grid gap-x-20 gap-y-8 pt-10 sm:pt-12 lg:grid-cols-[1.2fr_1fr]">
        <h1
          id="hero-title"
          {...at(420)}
          className="arrive max-w-[13em] text-[clamp(2rem,3.3vw,2.9rem)] font-[560] leading-[1.06] tracking-[-0.04em]"
        >
          {SITE.tagline}
        </h1>
        <div className="max-w-[34em] space-y-4 text-muted">
          <p {...at(510)} className="arrive">
            Mercury designs aircraft that carry, reach and respond, so that a drone can check in on someone, help in a
            rescue or inspect what is hard to reach instead of only filming it.
          </p>
          <p {...at(600)} className="arrive">
            We are designing{" "}
            <a href="#fleet" className="link text-fg">
              a family of single-job drones
            </a>{" "}
            on the way to{" "}
            <a href="#prometheus" className="link text-fg">
              one flagship
            </a>
            , along with{" "}
            <a href="#platform" className="link text-fg">
              the platform that designs them
            </a>
            . Everything here is a design, and{" "}
            <a href="#about" className="link text-fg">
              none of it has flown yet
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
