import * as THREE from "three";
import { createCannonScene, faceDisc } from "@/components/three-d/cannon-game";
import { COLORS, flat, minimalBursts, minimalCannon, minimalWorld } from "./minimal-look";

/**
 * Minimal cannon: flat unlit shapes on paper — an ink cannon, round photos in hairline rings,
 * one red accent for the chosen candidate. The game is the same, only the drawing is reduced.
 */

export default createCannonScene({
  setupWorld: minimalWorld,
  buildCannon: minimalCannon,

  buildTarget: (face) => {
    const root = new THREE.Group();
    // Paper disc behind the ring so the photo edge stays crisp.
    root.add(new THREE.Mesh(new THREE.CircleGeometry(1, 64), flat(COLORS.paper)));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 72), flat(COLORS.ink));
    ring.position.z = 0.01;
    root.add(ring, faceDisc(face, 0.88, 0.02));

    const halo = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.17, 72), flat(COLORS.accent));
    halo.position.z = 0.03;
    halo.visible = false;
    root.add(halo);

    return {
      root,
      setSelected: (selected) => {
        halo.visible = selected;
        (ring.material as THREE.MeshBasicMaterial).color.setHex(selected ? COLORS.accent : COLORS.ink);
      },
    };
  },

  buildProjectile: () => new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), flat(COLORS.ink)),

  ...minimalBursts,
  shockwave: { color: COLORS.ink, solid: true },
  aimDotColor: COLORS.muted,
  sway: 0.06,
  bob: 0.03,
});
