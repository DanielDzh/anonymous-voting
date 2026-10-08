import { CODE_ALPHABET, CODE_GROUP_SIZE, CODE_LENGTH, CODE_SEPARATOR } from "@/config/voting";

/** Uppercases and strips everything outside the alphabet, so "abcd efgh" and "ABCD-EFGH" match. */
export const normalizeCode = (input: string): string =>
  [...input.toUpperCase()]
    .filter((char) => CODE_ALPHABET.includes(char))
    .join("");

export const formatCode = (normalized: string): string =>
  normalized.match(new RegExp(`.{1,${CODE_GROUP_SIZE}}`, "g"))?.join(CODE_SEPARATOR) ?? "";

export const isWellFormedCode = (normalized: string): boolean => normalized.length === CODE_LENGTH;
