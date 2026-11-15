/** The Mercury mark: a rounded square, cyan running to blue. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="mercury-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill="url(#mercury-mark)" />
    </svg>
  );
}
