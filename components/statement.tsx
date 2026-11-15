"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A statement at display size that lights up as it is read: each word comes
 * up from dim to full as the passage scrolls through the middle of the
 * screen. Links inside it stay live. With reduced motion it is simply lit.
 */
export function Statement({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const words = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the passage's top reaches 82% down the screen, 1 when its foot reaches 48%.
      const p = (vh * 0.82 - r.top) / (r.height + vh * 0.34);
      const lit = p * (words.length + 6);
      for (let i = 0; i < words.length; i++) {
        const o = Math.min(1, Math.max(0.2, 0.2 + ((lit - i) / 6) * 0.8));
        words[i].style.opacity = String(o);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <p ref={ref} className={className}>
      {children}
    </p>
  );
}

/** Splits a run of text into words the statement can light one by one. */
export function Words({ children }: { children: string }) {
  return children.split(" ").map((w, i, all) => (
    <span key={i} data-w="">
      {w}
      {i < all.length - 1 ? " " : ""}
    </span>
  ));
}
