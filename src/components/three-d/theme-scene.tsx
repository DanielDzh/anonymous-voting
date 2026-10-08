"use client";

import { useEffect, useRef } from "react";
import { SCENE_LOADERS } from "@/themes/scene-loaders";
import { isLowPowerDevice } from "./device-tier";
import type { SceneOptions, ThemeId } from "@/themes/types";

const PHOTO_SEPARATOR = "\n";

const detectOptions = (photos: string[]): SceneOptions => {
  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    lowPower: isLowPowerDevice(),
    photos,
  };
};

type ThemeSceneProps = {
  theme: ThemeId;
  /** Candidate photos for photo themes. */
  photos?: string[];
};

export const ThemeScene = ({ theme, photos = [] }: ThemeSceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // A string key: the array is a new object on every render, its contents rarely change.
  const photosKey = photos.join(PHOTO_SEPARATOR);

  useEffect(() => {
    const loader = SCENE_LOADERS[theme];
    const canvas = canvasRef.current;
    if (!loader || !canvas) return;

    let dispose: (() => void) | undefined;
    let cancelled = false;
    const scenePhotos = photosKey ? photosKey.split(PHOTO_SEPARATOR) : [];

    loader()
      .then((module) => {
        if (!cancelled) dispose = module.default(canvas, detectOptions(scenePhotos));
      })
      .catch((error: unknown) => console.error("[theme-scene]", error));

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [theme, photosKey]);

  // key: a fresh canvas (and WebGL context) per theme.
  return <canvas key={theme} ref={canvasRef} className="theme-scene" aria-hidden="true" />;
};
