"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  MAX_PHOTO_DATA_URL_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  PHASE_TRANSITIONS,
} from "@/config/voting";
import { checkCredentials, endAdminSession, isAdmin, isAdminConfigured, startAdminSession } from "@/lib/auth";
import { generateAccessCode } from "@/lib/codes";
import { store } from "@/lib/store";
import type { Phase, Voting } from "@/lib/store/types";
import { DEFAULT_THEME, isThemeId, isThemeReady } from "@/themes/registry";
import type { ActionResult } from "@/lib/view-models";

const NOT_AUTHORIZED: ActionResult<never> = { ok: false, error: "Сесія адміна закінчилась — увійдіть знову" };
const DRAFT_ONLY: ActionResult<never> = { ok: false, error: "Змінювати посади й кандидатів можна лише в чернетці" };

const readText = (formData: FormData, key: string, maxLength: number): string =>
  String(formData.get(key) ?? "")
    .trim()
    .slice(0, maxLength);

const NOT_FOUND: ActionResult<never> = { ok: false, error: "Голосування не знайдено — можливо, його видалили" };

/** Admin check + load the voting every action works on. */
const loadVoting = async (votingId: unknown): Promise<{ voting: Voting } | { error: ActionResult<never> }> => {
  if (!(await isAdmin())) return { error: NOT_AUTHORIZED };
  const voting = await store.getVoting(String(votingId ?? ""));
  return voting ? { voting } : { error: NOT_FOUND };
};

const done = (): ActionResult => {
  refresh();
  return { ok: true, data: undefined };
};

/** A fresh code no other voting uses, so every code leads to exactly one voting. */
const generateUniqueAccessCode = async (): Promise<string> => {
  let code = generateAccessCode();
  while (await store.isAccessCodeTaken(code)) code = generateAccessCode();
  return code;
};

/** `email` is echoed back so the form can keep it: React resets forms after an action. */
export type LoginState = { error: string | null; email: string };

export const login = async (_prev: LoginState, formData: FormData): Promise<LoginState> => {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!isAdminConfigured()) {
    return { email, error: "Адмінку не налаштовано: задайте ADMIN_EMAIL, ADMIN_PASSWORD і SESSION_SECRET" };
  }
  if (!checkCredentials(email, password)) return { email, error: "Невірний email або пароль" };

  await startAdminSession();
  redirect("/admin");
};

export const logout = async (): Promise<void> => {
  await endAdminSession();
  redirect("/admin/login");
};

// ───────── votings ─────────

/** Creates an empty draft and opens it. */
export const createVoting = async (formData: FormData): Promise<ActionResult> => {
  if (!(await isAdmin())) return NOT_AUTHORIZED;
  const title = readText(formData, "title", MAX_TITLE_LENGTH);
  if (!title) return { ok: false, error: "Вкажіть назву голосування" };

  const id = await store.createVoting(title, DEFAULT_THEME, await generateUniqueAccessCode());
  redirect(`/admin/v/${id}`);
};

/** Permanent: positions, candidates, photos and votes go with it; its code stops working. */
export const deleteVoting = async (votingId: string): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;

  await store.deleteVoting(loaded.voting.id);
  redirect("/admin");
};

// ───────── one voting ─────────

export const updateTitle = async (votingId: string, formData: FormData): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;
  const title = readText(formData, "title", MAX_TITLE_LENGTH);
  if (!title) return { ok: false, error: "Назва не може бути порожньою" };

  await store.updateVoting(loaded.voting.id, { title });
  return done();
};

export const changePhase = async (votingId: string, next: Phase): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;
  const { voting } = loaded;
  if (!PHASE_TRANSITIONS[voting.phase].includes(next)) return { ok: false, error: "Такий перехід фази заборонено" };

  if (next === "open") {
    const hasEmpty = voting.positions.length === 0 || voting.positions.some((position) => position.candidates.length === 0);
    if (hasEmpty) return { ok: false, error: "Кожна посада повинна мати хоча б одного кандидата" };
  }

  // Leaving draft starts a fresh round, so "already voted" marks from test runs don't block real voters.
  if (voting.phase === "draft") await store.startNewRound(voting.id);
  await store.updateVoting(voting.id, { phase: next });
  return done();
};

/** Purely visual, so it may change in any phase. */
export const changeTheme = async (votingId: string, theme: string): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;
  if (!isThemeId(theme) || !isThemeReady(theme)) return { ok: false, error: "Ця тема ще недоступна" };

  await store.updateVoting(loaded.voting.id, { theme });
  return done();
};

export const createPosition = async (votingId: string, formData: FormData): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;
  if (loaded.voting.phase !== "draft") return DRAFT_ONLY;
  const title = readText(formData, "title", MAX_TITLE_LENGTH);
  if (!title) return { ok: false, error: "Вкажіть назву посади" };

  await store.addPosition(loaded.voting.id, title);
  return done();
};

export const deletePosition = async (votingId: string, positionId: string): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;
  if (loaded.voting.phase !== "draft") return DRAFT_ONLY;

  await store.removePosition(loaded.voting.id, String(positionId));
  return done();
};

export const createCandidate = async (votingId: string, formData: FormData): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;
  if (loaded.voting.phase !== "draft") return DRAFT_ONLY;
  const positionId = String(formData.get("positionId") ?? "");
  const name = readText(formData, "name", MAX_NAME_LENGTH);
  const description = readText(formData, "description", MAX_DESCRIPTION_LENGTH);
  if (!name) return { ok: false, error: "Вкажіть ім'я кандидата" };
  if (!loaded.voting.positions.some((position) => position.id === positionId)) return { ok: false, error: "Посаду не знайдено" };

  await store.addCandidate(loaded.voting.id, positionId, name, description);
  return done();
};

export const deleteCandidate = async (votingId: string, candidateId: string): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;
  if (loaded.voting.phase !== "draft") return DRAFT_ONLY;

  await store.removeCandidate(loaded.voting.id, String(candidateId));
  return done();
};

const JPEG_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;

/** Purely visual, so allowed in any phase. `photo` is a browser-compressed JPEG data URL, or null to remove. */
export const setCandidatePhoto = async (votingId: string, candidateId: string, photo: string | null): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;
  if (photo !== null && (typeof photo !== "string" || photo.length > MAX_PHOTO_DATA_URL_LENGTH || !JPEG_DATA_URL.test(photo))) {
    return { ok: false, error: "Фото має бути JPEG до ~500 КБ" };
  }
  const exists = loaded.voting.positions.some((position) => position.candidates.some((candidate) => candidate.id === candidateId));
  if (!exists) return { ok: false, error: "Кандидата не знайдено" };

  await store.setCandidatePhoto(loaded.voting.id, candidateId, photo);
  return done();
};

/** Rotates this voting's code: the old code and every printed or shown QR with it stop working at once. */
export const regenerateAccessCode = async (votingId: string): Promise<ActionResult> => {
  const loaded = await loadVoting(votingId);
  if ("error" in loaded) return loaded.error;

  await store.updateVoting(loaded.voting.id, { accessCode: await generateUniqueAccessCode() });
  return done();
};
