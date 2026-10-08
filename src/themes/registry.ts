import { THEME_IDS, type ThemeId, type ThemeMeta } from "./types";

export const DEFAULT_THEME: ThemeId = "linear";
/** The code-entry page (no voting chosen yet) — quiet, so the code field is the only thing to look at. */
export const ENTRY_THEME: ThemeId = "minimal";

/** Order follows the style board numbers. Plain data: safe to import on the server. */
export const THEMES: ThemeMeta[] = [
  {
    id: "linear",
    number: 1,
    label: "Linear",
    description: "Темна, строга, сфера з точок",
    status: "ready",
    swatch: ["#08090a", "#7877c6"],
  },
  {
    id: "apple",
    number: 2,
    label: "Apple",
    description: "Світла й чиста, глянцеві сфери",
    status: "ready",
    swatch: ["#fbfbfd", "#0071e3"],
  },
  {
    id: "bento",
    number: 3,
    label: "Bento",
    description: "Кольорові плитки, кубики що перекидаються",
    status: "ready",
    swatch: ["#b9ff66", "#6b5cff"],
  },
  {
    id: "glass",
    number: 4,
    label: "Glass iOS",
    description: "Скляні фігури на кольоровому світлі",
    status: "ready",
    swatch: ["#ff6b9d", "#7b61ff"],
  },
  {
    id: "y2k",
    number: 5,
    label: "Y2K",
    description: "Грайлива, переливні зірки",
    status: "ready",
    swatch: ["#c9f0ff", "#ff3db4"],
  },
  {
    id: "swiss",
    number: 6,
    label: "Swiss",
    description: "Велика типографіка, Баугауз-композиція",
    status: "ready",
    swatch: ["#f2f0eb", "#e3241b"],
  },
  {
    id: "clay",
    number: 7,
    label: "Clay 3D",
    description: "Пастельні пластилінові форми",
    status: "ready",
    swatch: ["#eef0ff", "#6c63ff"],
  },
  {
    id: "stripe",
    number: 8,
    label: "Stripe",
    description: "Жива градієнтна хвиля",
    status: "ready",
    swatch: ["#635bff", "#ff80b5"],
  },
  {
    id: "duo",
    number: 9,
    label: "Duolingo",
    description: "Яскрава, фігурки що підстрибують",
    status: "ready",
    swatch: ["#58cc02", "#1cb0f6"],
  },
  {
    id: "minimal",
    number: 10,
    label: "Minimal",
    description: "Тихо: тонкі лінії, без кольору",
    status: "ready",
    swatch: ["#f7f6f3", "#1c1b19"],
  },
  {
    id: "bobble",
    number: 11,
    label: "Желейки",
    description: "Желейні голови: тицяй і нахиляй телефон",
    status: "ready",
    swatch: ["#fff3b0", "#00c2a8"],
    usesPhotos: true,
  },
  {
    id: "comic",
    number: 12,
    label: "Комікс",
    description: "БАМ! ВАУ! Фото в кадрах",
    status: "ready",
    swatch: ["#ffd23f", "#e63946"],
    usesPhotos: true,
  },
  {
    id: "meme",
    number: 13,
    label: "Меми",
    description: "Наліпки з очима-гуглі 👀",
    status: "ready",
    swatch: ["#f0f0f0", "#111111"],
    usesPhotos: true,
  },
  {
    id: "jackbox",
    number: 14,
    label: "Чортики",
    description: "Кандидати вистрибують з коробок на пружинах",
    status: "ready",
    swatch: ["#fff1f6", "#ff5d8f"],
    usesPhotos: true,
    stage: "hero",
  },
  {
    id: "dolls",
    number: 15,
    label: "Бобблхеди",
    description: "Ляльки з великими головами, що кивають",
    status: "ready",
    swatch: ["#e9f7ef", "#00c2a8"],
    usesPhotos: true,
  },
  {
    id: "yoyo",
    number: 16,
    label: "Йо-йо",
    description: "Голови висять зі стелі на пружинах",
    status: "ready",
    swatch: ["#e8f4ff", "#5b6cff"],
    usesPhotos: true,
  },
  {
    id: "fair",
    number: 17,
    label: "Мішень",
    description: "Мінімалізм: гармата, мішені й одна червона деталь",
    status: "ready",
    swatch: ["#f7f6f3", "#e5322d"],
    usesPhotos: true,
    stage: "game",
  },
  {
    id: "pirate",
    number: 18,
    label: "Пірати",
    description: "Ядром по діжках на хвилях",
    status: "ready",
    swatch: ["#bfe3f2", "#7a4a26"],
    usesPhotos: true,
    stage: "game",
  },
  {
    id: "space",
    number: 19,
    label: "Космос",
    description: "Лазерна гармата і неонові кільця: за кого більше закинеш",
    status: "ready",
    swatch: ["#0b0b2a", "#38f2ff"],
    usesPhotos: true,
    stage: "game",
  },
  {
    id: "hoop",
    number: 20,
    label: "Кільце",
    description: "Мінімалізм: баскетбол, за кого більше закинеш",
    status: "ready",
    swatch: ["#f7f6f3", "#1c1b19"],
    usesPhotos: true,
    stage: "game",
  },
  {
    id: "bowling",
    number: 21,
    label: "Кеглі",
    description: "Мінімалізм: боулінг свайпом, за кого більше кеглів зіб'єш",
    status: "ready",
    swatch: ["#f7f6f3", "#e5322d"],
    usesPhotos: true,
    stage: "game",
    gameHint: "Постав палець на м'яч своєї доріжки і свайпни вгору. За кого більше кеглів зіб'єш — за того й голос (нічия — ніхто)",
  },
  {
    id: "darts",
    number: 22,
    label: "Дартс",
    description: "Мінімалізм: дротики в сектори з фото кандидатів",
    status: "ready",
    swatch: ["#f7f6f3", "#1c1b19"],
    usesPhotos: true,
    stage: "game",
    gameHint:
      "Свайпни вгору: швидше — вище, нахил — убік. Сектор з фото — 1 очко, зовнішнє кільце — 2. За кого більше очок — за того й голос (нічия — ніхто)",
  },
];

export const isThemeId = (value: unknown): value is ThemeId => THEME_IDS.includes(value as ThemeId);

export const themeUsesPhotos = (id: ThemeId): boolean => THEMES.some((theme) => theme.id === id && theme.usesPhotos);

export const themeStage = (id: ThemeId): "background" | "hero" | "game" =>
  THEMES.find((theme) => theme.id === id)?.stage ?? "background";

export const themeGameHint = (id: ThemeId): string | undefined => THEMES.find((theme) => theme.id === id)?.gameHint;

export const isThemeReady = (id: ThemeId): boolean => THEMES.some((theme) => theme.id === id && theme.status === "ready");
