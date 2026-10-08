export const COUNT_UP_DURATION_MS = 1400;

/** Delay between staggered entrance animations. */
export const STAGGER_MS = 90;

/** window CustomEvent fired when a voter picks a candidate; detail: { photo: string | null; candidateId: string }. */
export const CANDIDATE_SELECTED_EVENT = "ballot:candidate-selected";

/**
 * window CustomEvent a game scene fires to choose a candidate on the ballot.
 * detail: { candidateId: string } to choose, or { candidateId: null, among: string[] } to clear
 * the choice of the position those candidates belong to (a tie in a scoring game).
 */
export const SELECT_CANDIDATE_REQUEST_EVENT = "ballot:select-request";

/** window CustomEvent for every point scored in a game theme; detail: { candidateId: string, points: number }. */
export const GAME_POINT_EVENT = "game:point";

/** How often a phone sends its game points to the server (they're batched, not sent per hit). */
export const GAME_POINTS_FLUSH_MS = 1500;

/** window CustomEvent with a scoring game's tally; detail: { scores: Record<candidateId, number> }. */
export const GAME_SCORES_EVENT = "game:scores";

/** Height of the boxed 3D stage in the header (fits the first phone screen with the title). */
/** svh (small viewport height) doesn't change while mobile browser bars slide during scroll. */
export const HERO_STAGE_HEIGHT = "clamp(280px, 44svh, 440px)";
/** One character (or target) per candidate; beyond this the row gets too small to read on a phone. */
export const HERO_MAX_PEOPLE = 4;
/** Game stages (cannon) need more room to aim. */
export const GAME_STAGE_HEIGHT = "clamp(380px, 58svh, 600px)";
