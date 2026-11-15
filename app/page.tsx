import { About } from "@/components/about";
import { FlyFigure } from "@/components/figures/fly";
import { PlatformFigure } from "@/components/figures/platform";
import { TalkFigure } from "@/components/figures/talk";
import { Flagship } from "@/components/flagship";
import { Fleet } from "@/components/fleet";
import { Hero } from "@/components/hero";
import { Renders } from "@/components/renders";
import { Section } from "@/components/section";
import { SITE } from "@/lib/site";

export default function Home() {
  return (
    <>
      <Hero />
      <main>
        <Section
          id="fleet"
          title="Each drone is built for one job."
          body="A drone that does one job well is lighter, cheaper and easier to trust than one that does everything. Pick any of them to see it the way a lidar would, and drag to turn it."
        >
          <Fleet />
        </Section>

        <Section
          id="parts"
          title="The tool goes where a camera would be."
          body="We design each airframe to be printed in carbon-nylon and built on carbon tube, around the one piece of work it is for."
        >
          <Renders />
        </Section>

        <Section
          id="prometheus"
          title="The flagship swaps its tools."
          body="Prometheus is a large octocopter with one rail under its body. The rail carries one large tool, and the head of that tool swaps between six."
        >
          <Flagship />
        </Section>

        <Section
          id="talk"
          title="Every drone knows what the others are doing."
          body="Some drones carry their own computer and talk to each other directly. The rest carry only a flight controller, so the ground computer thinks for them and passes their messages on."
          note={SITE.footnote}
        >
          <TalkFigure />
        </Section>

        <Section
          id="fly"
          title="They see in three ways before they decide."
          body="Lidar gives the shape of the space, a laser rangefinder gives the exact distance, and cameras say what things are."
          note={SITE.footnote}
        >
          <FlyFigure />
        </Section>

        <Section
          id="platform"
          title="We built the workbench that designs them."
          body="Mercury is also an engineering platform that runs on a laptop. It reads the CAD, tries variants, plans every print and compares flights with its own predictions, and a person approves every step."
        >
          <PlatformFigure />
        </Section>
      </main>
      <About />
    </>
  );
}
