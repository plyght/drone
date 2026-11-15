import { Plate } from "./plate";

/** The work up close: four studio renders of the parts that do it. */
export function Renders() {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-9 md:grid-cols-12">
      <Plate
        name="perseus-claw"
        alt="Close view under Perseus: a three-fingered claw with orange flexible pads, hanging below the airframe."
        title="Perseus"
        line="It is designed to reach down with a claw that adjusts itself to what it finds, grip it and carry it back."
        sizes="(min-width: 1400px) 760px, (min-width: 768px) 58vw, 100vw"
        className="md:col-span-7"
      />
      <Plate
        name="menoetius-rotor"
        alt="Close view of one of Menoetius's rotors, mounted at a tilt on its arm."
        title="Menoetius"
        line="Its rotors are tilted so that it can twist in mid-air and turn a valve or a bolt."
        sizes="(min-width: 1400px) 540px, (min-width: 768px) 42vw, 100vw"
        className="md:col-span-5"
        ratio="aspect-[16/10] md:aspect-[8/7]"
      />
      <Plate
        name="pad-corner"
        alt="The medium charging pad: a low flat deck with square orange markers at its corners and centre."
        title="The charging pad"
        line="Every drone is designed to charge through coils in its feet, so it lands on a pad and there is nothing to plug in."
        sizes="(min-width: 1400px) 540px, (min-width: 768px) 42vw, 100vw"
        className="md:col-span-5"
        ratio="aspect-[16/10] md:aspect-[8/7]"
      />
      <Plate
        name="astraeus-low"
        alt="Low view along Astraeus: a flying wing standing on rotor pylons with orange feet."
        title="Astraeus"
        line="It is a flying wing designed to lift off like a drone and fly like a plane, so a family can check in on someone far away."
        sizes="(min-width: 1400px) 760px, (min-width: 768px) 58vw, 100vw"
        className="md:col-span-7"
      />
    </div>
  );
}
