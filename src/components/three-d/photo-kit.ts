import * as THREE from "three";

const TEXTURE_SIZE = 256;
const FALLBACK_FACE_COLORS = ["#ffcf4d", "#7ee0d2", "#ff9ec4", "#a6b8ff"];

const canvasTexture = (draw: (context: CanvasRenderingContext2D, size: number) => void, size = TEXTURE_SIZE) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** A goofy placeholder face, used when the admin hasn't uploaded photos yet. */
export const fallbackFace = (index: number): THREE.Texture =>
  canvasTexture((context, size) => {
    const mid = size / 2;
    context.fillStyle = FALLBACK_FACE_COLORS[index % FALLBACK_FACE_COLORS.length];
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#1e1e1e";
    context.beginPath();
    context.arc(mid - 40, mid - 20, 14, 0, Math.PI * 2);
    context.arc(mid + 40, mid - 20, 14, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 10;
    context.lineCap = "round";
    context.strokeStyle = "#1e1e1e";
    context.beginPath();
    context.arc(mid, mid + 10, 48, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
  });

/** Textures for the candidates' photos, or goofy faces when there are none. Always returns at least `minimum`. */
export const faceTextures = (photos: string[], minimum = 2): THREE.Texture[] => {
  const loader = new THREE.TextureLoader();
  const fromPhotos = photos.map((photo) => {
    const texture = loader.load(photo);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
  if (fromPhotos.length > 0) return fromPhotos;
  return Array.from({ length: minimum }, (_, index) => fallbackFace(index));
};

const INITIALS_GRADIENTS: [string, string][] = [
  ["#ff9ac1", "#ff5d8f"],
  ["#7fe3d6", "#22b8a6"],
  ["#a5b0ff", "#6372ff"],
  ["#ffd38a", "#ffa22e"],
];

/** A clean placeholder face: the candidate's initials on a soft gradient disc. */
export const initialsFace = (initials: string, index: number): THREE.Texture =>
  canvasTexture((context, size) => {
    const [light, dark] = INITIALS_GRADIENTS[index % INITIALS_GRADIENTS.length];
    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, light);
    gradient.addColorStop(1, dark);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    context.font = `800 ${Math.round(size * 0.36)}px "Nunito", "Arial Rounded MT Bold", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(0, 0, 0, 0.12)";
    context.fillText(initials, size / 2 + 6, size / 2 + 10);
    context.fillStyle = "#ffffff";
    context.fillText(initials, size / 2, size / 2 + 4);
  }, 512);

/** Loads a photo as an sRGB texture. */
export const photoTexture = (photo: string): THREE.Texture => {
  const texture = new THREE.TextureLoader().load(photo);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

type BurstStyle = { fill: string; text: string };

/** Comic-book starburst with a word in the middle ("БАМ!", "ВАУ!"…). */
export const burstTexture = (word: string, { fill, text }: BurstStyle): THREE.Texture =>
  canvasTexture((context, size) => {
    const mid = size / 2;
    const spikes = 14;
    context.beginPath();
    for (let i = 0; i <= spikes * 2; i++) {
      const radius = i % 2 === 0 ? mid * 0.96 : mid * 0.68;
      const angle = (i / (spikes * 2)) * Math.PI * 2;
      const x = mid + Math.cos(angle) * radius;
      const y = mid + Math.sin(angle) * radius;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = 10;
    context.strokeStyle = "#111111";
    context.stroke();

    context.font = `900 ${Math.round(size / (word.length > 4 ? 6.2 : 4.6))}px "Arial Black", Impact, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 12;
    context.strokeStyle = "#111111";
    context.strokeText(word, mid, mid);
    context.fillStyle = text;
    context.fillText(word, mid, mid);
  }, 512);

/** Listens for the ballot's "candidate selected" event; returns an unsubscribe function. */
export const onCandidateSelected = (
  eventName: string,
  handler: (photo: string | null, candidateId: string | null) => void,
): (() => void) => {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ photo: string | null; candidateId?: string }>).detail;
    handler(detail?.photo ?? null, detail?.candidateId ?? null);
  };
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
};
