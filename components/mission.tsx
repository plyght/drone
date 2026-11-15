import { Statement, Words } from "./statement";

/** What Mercury is for, why a family, and the honest state of it, as one passage. */
export function Mission() {
  return (
    <section id="mission" className="mx-auto max-w-[1500px] px-5 pt-24 sm:px-8 sm:pt-36">
      <Statement className="m-0 max-w-[21em] text-[clamp(1.6rem,3.9vw,3.5rem)] font-medium leading-[1.1] tracking-[-0.04em]">
        <Words>
          Mercury designs aircraft that carry, reach and respond, so that a drone can check in on someone, help in a
          rescue or inspect what is hard to reach instead of only filming it. A drone that does one job well is
          lighter, cheaper and easier to trust than one that does everything, which is why we are designing
        </Words>{" "}
        <a href="#fleet" className="link" data-w="">
          a whole family of them
        </a>{" "}
        <Words>on the way to</Words>{" "}
        <a href="#work" className="link" data-w="">
          one flagship
        </a>
        <Words>. Everything here is a design, and</Words>{" "}
        <a href="#about" className="link" data-w="">
          none of it has flown yet
        </a>
        <Words>.</Words>
      </Statement>
    </section>
  );
}
