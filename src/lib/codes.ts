import "server-only";
import { randomInt } from "node:crypto";
import { CODE_ALPHABET, CODE_LENGTH } from "@/config/voting";

export { formatCode, isWellFormedCode, normalizeCode } from "@/lib/code-format";

/** Normalized (no separator) random code from the unambiguous alphabet. */
export const generateAccessCode = (): string =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
