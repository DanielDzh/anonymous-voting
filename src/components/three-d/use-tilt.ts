"use client";

import { useEffect, useRef } from "react";

const DEFAULT_MAX_DEG = 10;

/**
 * 3D tilt toward the mouse (not touch: on phones a moving finger means scrolling).
 * Pair the returned ref with the `tilt` class; the hook only writes --rx / --ry.
 */
export const useTilt = <T extends HTMLElement>(maxDeg = DEFAULT_MAX_DEG) => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const handleMove = (event: PointerEvent) => {
      // Touch "moves" are scrolls — tilting cards under a scrolling finger made them flail.
      if (event.pointerType !== "mouse") return;
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      element.classList.add("is-tilting");
      element.style.setProperty("--ry", `${(x - 0.5) * 2 * maxDeg}deg`);
      element.style.setProperty("--rx", `${(0.5 - y) * 2 * maxDeg}deg`);
    };

    const handleLeave = () => {
      element.classList.remove("is-tilting");
      element.style.setProperty("--rx", "0deg");
      element.style.setProperty("--ry", "0deg");
    };

    element.addEventListener("pointermove", handleMove);
    element.addEventListener("pointerleave", handleLeave);
    element.addEventListener("pointercancel", handleLeave);
    return () => {
      element.removeEventListener("pointermove", handleMove);
      element.removeEventListener("pointerleave", handleLeave);
      element.removeEventListener("pointercancel", handleLeave);
    };
  }, [maxDeg]);

  return ref;
};
