import type { ThemeId, ThemeScene } from "./types";

type SceneModule = { default: ThemeScene };

/** Client-only: each scene (and Three.js itself) is code-split and fetched for the active theme only. */
export const SCENE_LOADERS: Partial<Record<ThemeId, () => Promise<SceneModule>>> = {
  linear: () => import("./linear/scene"),
  bento: () => import("./bento/scene"),
  y2k: () => import("./y2k/scene"),
  swiss: () => import("./swiss/scene"),
  clay: () => import("./clay/scene"),
  duo: () => import("./duo/scene"),
  apple: () => import("./apple/scene"),
  glass: () => import("./glass/scene"),
  stripe: () => import("./stripe/scene"),
  minimal: () => import("./minimal/scene"),
  bobble: () => import("./bobble/scene"),
  comic: () => import("./comic/scene"),
  meme: () => import("./meme/scene"),
  jackbox: () => import("./jackbox/scene"),
  dolls: () => import("./dolls/scene"),
  yoyo: () => import("./yoyo/scene"),
  fair: () => import("./fair/scene"),
  pirate: () => import("./pirate/scene"),
  space: () => import("./space/scene"),
  hoop: () => import("./hoop/scene"),
  bowling: () => import("./bowling/scene"),
  darts: () => import("./darts/scene"),
};
