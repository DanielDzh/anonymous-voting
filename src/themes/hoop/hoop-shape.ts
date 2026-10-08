import * as THREE from "three";
import type { HoopShape } from "@/components/three-d/cannon-game";

/** Basketball hoop geometry shared by 20 · Кільце and the neon hoops of 19 · Космос. */

/** In target radii, around the rim's centre. Shared by the drawing and the physics. */
export const HOOP: HoopShape = {
  rimHalf: 0.48,
  rimTube: 0.06,
  board: { x: 0.64, bottom: -0.3, top: 1.25, thickness: 0.09 },
};

export const NET = {
  depth: 0.75,
  /** Half-width of the net's bottom opening. */
  bottomHalf: 0.28,
  strands: 5,
  rows: 3,
  /** How much the net stretches down on a swish, and how fast it settles. */
  swishStretch: 0.35,
  swishDecay: 3.5,
} as const;

export const PHOTO = { radius: 0.5, gap: 0.12 };

/** Hairline net: strands from rim to the narrower bottom, plus a zigzag per row. */
export const netGeometry = () => {
  const points: number[] = [];
  const at = (t: number, row: number) => {
    const halfWidth = THREE.MathUtils.lerp(HOOP.rimHalf, NET.bottomHalf, row / NET.rows);
    return [-halfWidth + t * halfWidth * 2, (-NET.depth * row) / NET.rows, 0];
  };
  for (let strand = 0; strand < NET.strands; strand++) {
    const t = strand / (NET.strands - 1);
    for (let row = 0; row < NET.rows; row++) points.push(...at(t, row), ...at(t, row + 1));
  }
  // Diagonals between neighbouring strands give the woven look.
  for (let strand = 0; strand < NET.strands - 1; strand++) {
    for (let row = 0; row < NET.rows; row++) {
      points.push(...at(strand / (NET.strands - 1), row), ...at((strand + 1) / (NET.strands - 1), row + 1));
      points.push(...at((strand + 1) / (NET.strands - 1), row), ...at(strand / (NET.strands - 1), row + 1));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
};

/** Hoops sit lower than round targets: the photo on top of the board needs the room. */
export const HOOP_TARGET_DROP = 3.1;
