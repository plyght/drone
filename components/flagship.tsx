import { Plate } from "./plate";

const HEADS = [
  { name: "Gripper", line: "to hold and carry" },
  { name: "Torque head", line: "to turn valves and bolts" },
  { name: "Camera gimbal", line: "to look closely" },
  { name: "Winch", line: "to lower and lift" },
  { name: "Blower", line: "to clear debris" },
  { name: "Contact probe", line: "to measure by touch" },
];

/** Prometheus: the tool under the body, the rack it swaps at, and the six heads. */
export function Flagship() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-9 md:grid-cols-12">
        <Plate
          name="prometheus-tool"
          alt="Close view under Prometheus: a gripper head with orange pads hanging from the rail beneath the body."
          title="The rail"
          line="One large tool rides under the body, and its carriage slides to keep the balance right as heads change."
          sizes="(min-width: 1400px) 760px, (min-width: 768px) 58vw, 100vw"
          className="md:col-span-7"
        />
        <Plate
          name="rack-heads"
          alt="The Prometheus tool rack: tool heads hanging in a row from a frame, each on the same quick-change plate."
          title="The rack"
          line="Every head shares one quick-change plate, so Prometheus is designed to land, leave one head here and take the next."
          sizes="(min-width: 1400px) 540px, (min-width: 768px) 42vw, 100vw"
          className="md:col-span-5"
          ratio="aspect-[16/10] md:aspect-[8/7]"
        />
      </div>
      <ul className="m-0 mt-12 grid list-none grid-cols-2 gap-x-6 gap-y-6 p-0 sm:grid-cols-3 lg:grid-cols-6">
        {HEADS.map((h) => (
          <li key={h.name}>
            <span className="block font-semibold tracking-[-0.02em]">{h.name}</span>
            <span className="block text-muted">{h.line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
