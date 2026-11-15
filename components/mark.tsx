/**
 * The Mercury mark: a disc with a rotor blade swept through it. It is the
 * planet and the propeller at once, and it is drawn in the current colour
 * so it holds on any ground. The blade is an even-odd cut-out, not a second
 * shape, so nothing shows through it but the page.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M24 3a21 21 0 1 0 0 42a21 21 0 1 0 0-42ZM24 24C25.5 16.5 33 11.5 41.41 12.26C37.5 20 30.5 24.6 24 24ZM24 24C22.5 31.5 15 36.5 6.59 35.74C10.5 28 17.5 23.4 24 24Z"
      />
    </svg>
  );
}
