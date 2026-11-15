import type { ReactNode } from "react";
import { Resolve } from "./resolve";

/** One section: a heading that says the thing, a sentence under it, then the visual. */
export function Section({
  id,
  title,
  body,
  note,
  children,
}: {
  id: string;
  title: string;
  body: ReactNode;
  /** A line under the visual, for the "not flown yet" footnote. */
  note?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-[1400px] scroll-mt-10 px-5 pt-28 sm:px-10 sm:pt-40">
      <Resolve>
        <h2 className="sec-h">{title}</h2>
      </Resolve>
      <Resolve delay={70}>
        <p className="sec-p">{body}</p>
      </Resolve>
      {children ? (
        <Resolve delay={140} className="mt-9 sm:mt-11">
          {children}
        </Resolve>
      ) : null}
      {note ? (
        <Resolve delay={200}>
          <p className="m-0 mt-4 text-[16px] text-muted">{note}</p>
        </Resolve>
      ) : null}
    </section>
  );
}
