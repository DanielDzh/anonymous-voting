"use client";

import { useEffect, useRef, useState } from "react";
import { COUNT_UP_DURATION_MS } from "@/config/visuals";

const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** Animates from the previously shown value to `target` whenever it changes. */
export const useCountUp = (target: number): number => {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = easeOutExpo((now - startedAt) / COUNT_UP_DURATION_MS);
      const next = from + (target - from) * progress;
      fromRef.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
};
