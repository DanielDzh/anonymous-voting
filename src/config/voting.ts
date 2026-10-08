import type { Phase } from "@/lib/store/types";

/** Unambiguous alphabet: no 0/O, 1/I/L. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CODE_GROUP_SIZE = 3;
export const CODE_SEPARATOR = "-";
/** Query parameter the QR link carries the shared code in: /?c=K7P2QX */
export const CODE_QUERY_PARAM = "c";

/** Marks a browser that already voted in the current round. Holds only the round id. */
export const VOTED_COOKIE = "av_voted";
export const VOTED_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

export const MAX_TITLE_LENGTH = 120;
export const MAX_NAME_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 400;

/** Candidate photos are cropped and compressed in the browser to this square size. */
export const PHOTO_SIZE_PX = 768;
export const PHOTO_JPEG_QUALITY = 0.86;
/** Hard server-side cap on the data URL length (~500 KB of JPEG). */
export const MAX_PHOTO_DATA_URL_LENGTH = 700_000;

export const ADMIN_SESSION_COOKIE = "av_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const ADMIN_LIVE_REFRESH_MS = 3000;
/** The projector screen refreshes faster, so the game scoreboard feels live. */
export const PRESENT_LIVE_REFRESH_MS = 1500;
/** Cap on game points one phone may send per batch — keeps the fun tally from absurd spikes. */
export const MAX_GAME_POINTS_PER_BATCH = 60;

/** Which phase each phase may move to. Draft is one-way: candidates freeze once voting starts. */
export const PHASE_TRANSITIONS: Record<Phase, Phase[]> = {
  draft: ["open"],
  open: ["closed"],
  closed: ["open", "results"],
  results: ["closed"],
};

export const PHASE_ORDER: Phase[] = ["draft", "open", "closed", "results"];

export const PHASE_LABELS: Record<Phase, string> = {
  draft: "Чернетка",
  open: "Відкрито",
  closed: "Закрито",
  results: "Результати",
};

export const PHASE_ACTION_LABELS: Record<Phase, string> = {
  draft: "Повернути в чернетку",
  open: "Відкрити голосування",
  closed: "Закрити голосування",
  results: "Опублікувати результати",
};
