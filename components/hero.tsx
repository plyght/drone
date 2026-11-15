import { asset } from "@/lib/asset";
import { SITE } from "@/lib/site";
import { HeroFilm } from "./hero-film";
import { Mark } from "./mark";

const HEADLINE = SITE.tagline;
// The headline resolves a character at a time, once the film has begun to appear.
const HEAD_AT = 320;
const PER_CHAR = 14;
const HEAD_DONE = HEAD_AT + HEADLINE.length * PER_CHAR + 300;

const at = (ms: number) => ({ style: { ["--resolve-delay" as string]: `${ms}ms` } });

/**
 * The opening scene fills the screen: a studio film, close on a rotor, with
 * the one line that says what Mercury is set across it at full size.
 */
export function Hero() {
  let n = 0;
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex h-[100svh] min-h-[560px] flex-col justify-between overflow-hidden bg-plate text-plate-fg"
    >
      <HeroFilm
        video={asset("/img/hero.mp4")}
        poster={asset("/img/hero.webp")}
        className="arrive absolute inset-0 -z-10 h-full w-full"
      />
      {/* Shade at the foot, so the line holds over any frame of the film. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,#050607f2_0%,#050607a6_30%,#05060700_62%)]"
      />

      <header className="flex items-center justify-between p-5 sm:p-8">
        <a href="#top" {...at(80)} className="arrive flex items-center gap-3 text-[21px] font-semibold tracking-[-0.04em]">
          <Mark className="size-[26px]" />
          {SITE.name}
        </a>
        <a
          href="#fleet"
          {...at(HEAD_DONE)}
          className="arrive pill bg-plate-fg text-plate hover:bg-accent"
        >
          See the fleet
        </a>
      </header>

      <div className="p-5 sm:p-8">
        <h1
          id="hero-title"
          aria-label={HEADLINE}
          className="display max-w-[9.5em] text-[clamp(2.9rem,8.6vw,8.8rem)]"
        >
          {HEADLINE.split(" ").map((word, w) => (
            <span key={w} aria-hidden className="inline-block whitespace-pre">
              {[...word].map((ch, c) => (
                <span key={c} className="hero-char inline-block" {...at(HEAD_AT + n++ * PER_CHAR)}>
                  {ch}
                </span>
              ))}
              {(n++, " ")}
            </span>
          ))}
        </h1>
        <p {...at(HEAD_DONE + 90)} className="arrive mt-6 text-[15px] font-medium text-plate-fg/80 sm:mt-8">
          A rotor of Prometheus, our flagship design, rendered in the studio.
        </p>
      </div>
    </section>
  );
}
