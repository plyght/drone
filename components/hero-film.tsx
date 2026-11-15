"use client";

import { useEffect, useRef } from "react";

/**
 * The opening film: a short render that turns the rotor a few degrees while
 * the key light crosses it, then runs back, so it loops without a cut. The
 * poster frame stands in until the film can play, for good where motion is
 * reduced, and wherever the browser declines to autoplay.
 */
export function HeroFilm({ video, poster, className }: { video: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.src = video;
    // Only play while on screen.
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.play().catch(() => {});
      else el.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [video]);

  return (
    <video
      ref={ref}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      className={`block object-cover ${className ?? ""}`}
    />
  );
}
