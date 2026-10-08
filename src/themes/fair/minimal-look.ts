import * as THREE from "three";
import type { CannonRig, CannonVisuals, WorldRig } from "@/components/three-d/cannon-game";
import type { StageContext } from "@/components/three-d/scene-engine";

/**
 * The minimal cannon look shared by 17 · Мішень, 20 · Кільце and 21 · Кеглі: flat unlit shapes on paper,
 * an ink cannon, one red accent for the chosen candidate.
 */

export const COLORS = {
  paper: 0xf7f6f3,
  ink: 0x1c1b19,
  hairline: 0xd6d3cb,
  muted: 0x8a8780,
  accent: 0xe5322d,
} as const;

export const flat = (color: number) => new THREE.MeshBasicMaterial({ color });

/** A rounded rectangle, centred on x, from y = 0 up to `height`. */
export const roundedBar = (width: number, height: number, radius: number) => {
  const shape = new THREE.Shape();
  const x = -width / 2;
  shape.moveTo(x + radius, 0);
  shape.lineTo(x + width - radius, 0);
  shape.quadraticCurveTo(x + width, 0, x + width, radius);
  shape.lineTo(x + width, height - radius);
  shape.quadraticCurveTo(x + width, height, x + width - radius, height);
  shape.lineTo(x + radius, height);
  shape.quadraticCurveTo(x, height, x, height - radius);
  shape.lineTo(x, radius);
  shape.quadraticCurveTo(x, 0, x + radius, 0);
  return new THREE.ShapeGeometry(shape, 8);
};

/** Paper background and a single hairline "ground" the cannon stands on. */
export const minimalWorld = ({ scene }: StageContext): WorldRig => {
  scene.background = new THREE.Color(COLORS.paper);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flat(COLORS.hairline));
  scene.add(ground);
  return {
    layout: (half, unit) => {
      ground.scale.set(half.x * 2.2, unit * 0.025, 1);
      ground.position.set(0, -half.y + unit * 0.75, -0.5);
    },
  };
};

export const minimalCannon = (): CannonRig => {
  const root = new THREE.Group();
  const ink = flat(COLORS.ink);
  // Half-disc base sitting on the ground line.
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40, 0, Math.PI), ink);
  base.position.y = -0.3;
  const barrel = new THREE.Group();
  barrel.position.set(0, -0.05, 0.01);
  barrel.add(new THREE.Mesh(roundedBar(0.34, 1.45, 0.17), ink));
  root.add(base, barrel);
  return { root, barrel, muzzle: 1.4 };
};

/** Small flat dots: red + ink on a hit, a grey puff on firing. */
export const minimalBursts: Pick<CannonVisuals, "hitBurst" | "missBurst"> = {
  hitBurst: {
    geometry: new THREE.CircleGeometry(1, 16),
    colors: [COLORS.accent, COLORS.ink],
    count: 14,
    speed: 4,
    gravity: 0,
    life: 0.7,
    size: 0.06,
    flat: true,
  },
  missBurst: {
    geometry: new THREE.CircleGeometry(1, 16),
    colors: [COLORS.muted],
    count: 6,
    speed: 2,
    gravity: 0,
    life: 0.5,
    size: 0.05,
    flat: true,
  },
};
