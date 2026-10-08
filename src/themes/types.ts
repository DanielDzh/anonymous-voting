export const THEME_IDS = [
  "linear",
  "bento",
  "y2k",
  "swiss",
  "clay",
  "duo",
  "apple",
  "glass",
  "stripe",
  "minimal",
  "bobble",
  "comic",
  "meme",
  "jackbox",
  "dolls",
  "yoyo",
  "fair",
  "pirate",
  "space",
  "hoop",
  "bowling",
  "darts",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeStatus = "ready" | "soon";

export type ThemeMeta = {
  id: ThemeId;
  /** Number from the style board the user picked from. */
  number: number;
  label: string;
  description: string;
  status: ThemeStatus;
  /** Two swatches for the admin picker preview. */
  swatch: [string, string];
  /** Shows candidate photos (instead of initials) and feeds them to the 3D scene. */
  usesPhotos?: boolean;
  /**
   * "background" (default): full-screen scene behind the whole page.
   * "hero": a boxed scene in the page header, one character per candidate, names under it.
   * "game": a taller boxed scene you play with (aim and shoot); names above the targets.
   */
  /** Game stages: how to play, shown under the stage (defaults to the cannon's "pull back and release"). */
  gameHint?: string;
  stage?: "background" | "hero" | "game";
};

/** A candidate as a hero scene sees them. */
export type StagePerson = { id: string; initials: string; photo: string | null };

export type SceneOptions = {
  reducedMotion: boolean;
  /** Fewer objects and lower resolution on weak devices. */
  lowPower: boolean;
  /** Candidate photos (data URLs) for themes that use them; empty otherwise. */
  photos: string[];
  /** Hero stages: the candidates, in display order. */
  people?: StagePerson[];
};

/** Starts a theme's background scene on the canvas and returns a disposer. */
export type ThemeScene = (canvas: HTMLCanvasElement, options: SceneOptions, container?: HTMLElement) => () => void;
