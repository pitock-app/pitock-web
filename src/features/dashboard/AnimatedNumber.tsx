"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 900;

/** Vero se il browser può animare e l'utente non ha chiesto di ridurre il movimento. */
function canAnimate() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    typeof window.requestAnimationFrame === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Numero che sale fino al valore (ease-out), dal valore mostrato prima. Senza animazioni
 * (movimento ridotto, test) mostra subito il valore finale.
 */
export function useCountUp(value: number): number {
  // Al primo render parte da zero solo se poi anima davvero.
  const [shown, setShown] = useState(() => (canAnimate() ? 0 : value));
  const from = useRef(0);
  useEffect(() => {
    if (!canAnimate()) {
      from.current = value;
      return;
    }
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      const current = start + (value - start) * eased;
      from.current = current;
      setShown(progress < 1 ? current : value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return canAnimate() ? shown : value;
}

/** Numero formattato con l'animazione di conteggio. */
export function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
  return <>{format(useCountUp(value))}</>;
}
