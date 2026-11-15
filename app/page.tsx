import { About } from "@/components/about";
import { Chapter } from "@/components/chapter";
import { Fleet } from "@/components/fleet";
import { Hero } from "@/components/hero";
import { How } from "@/components/how";
import { Mission } from "@/components/mission";
import { Scenes } from "@/components/scenes";

export default function Home() {
  return (
    <>
      <Hero />
      <main>
        <Mission />

        <section id="fleet" className="scroll-mt-10 pt-28 sm:pt-44">
          <div className="mx-auto max-w-[1500px]">
            <Chapter title="Each drone is built for one job.">
              Seventeen aircraft in three families share their fasteners, tool rail, charging and positioning, so
              parts and lessons carry from one to the next. You can open any of them in 3D.
            </Chapter>
          </div>
          <Fleet />
        </section>

        <section id="work" className="scroll-mt-10 pt-28 sm:pt-44">
          <div className="mx-auto max-w-[1500px]">
            <Chapter title="The tool goes where a camera would be.">
              We design each airframe to be printed in carbon-nylon and built on carbon tube, around the one piece
              of work it is for.
            </Chapter>
          </div>
          <Scenes />
        </section>

        <How />
      </main>
      <About />
    </>
  );
}
