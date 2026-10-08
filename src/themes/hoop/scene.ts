import * as THREE from "three";
import { createCannonScene, faceDisc } from "@/components/three-d/cannon-game";
import { COLORS, flat, minimalBursts, minimalCannon, minimalWorld } from "../fair/minimal-look";
import { HOOP, HOOP_TARGET_DROP, NET, PHOTO, netGeometry } from "./hoop-shape";

/**
 * Minimal basketball: one hoop per candidate, drawn in ink on paper. The ball must drop
 * through the rim from above to count (the rim ends and backboard are solid, so bank shots
 * work). Points are tallied: whoever has the most baskets is the choice (a tie chooses nobody).
 * The candidate's photo sits on top of the backboard; the leader turns red.
 */

const bar = (width: number, height: number, x: number, y: number, material: THREE.Material) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, 0.02);
  return mesh;
};

export default createCannonScene({
  setupWorld: minimalWorld,
  buildCannon: minimalCannon,
  hoop: HOOP,
  // Most balls through a hoop wins the vote.
  tally: true,
  targetDrop: HOOP_TARGET_DROP,

  buildTarget: (face, _index, side) => {
    const root = new THREE.Group();
    const ink = flat(COLORS.ink);
    const rimMaterial = flat(COLORS.ink);
    const boardX = side * HOOP.board.x;

    // Backboard on the outer side, a short bracket to the rim, the rim itself.
    const boardHeight = HOOP.board.top - HOOP.board.bottom;
    root.add(bar(HOOP.board.thickness, boardHeight, boardX, HOOP.board.bottom + boardHeight / 2, ink));
    root.add(bar(HOOP.board.x - HOOP.rimHalf, 0.05, side * (HOOP.rimHalf + (HOOP.board.x - HOOP.rimHalf) / 2), 0.08, ink));
    const rim = bar(HOOP.rimHalf * 2 + HOOP.rimTube * 2, HOOP.rimTube * 1.6, 0, 0, rimMaterial);
    root.add(rim);

    const net = new THREE.LineSegments(netGeometry(), new THREE.LineBasicMaterial({ color: COLORS.muted }));
    net.position.y = -HOOP.rimTube * 0.8;
    root.add(net);

    // Photo on top of the backboard, in a hairline ring that turns red when chosen.
    const photoY = HOOP.board.top + PHOTO.gap + PHOTO.radius;
    const paper = new THREE.Mesh(new THREE.CircleGeometry(PHOTO.radius + 0.06, 64), flat(COLORS.paper));
    paper.position.set(boardX, photoY, 0.01);
    const photoRing = new THREE.Mesh(new THREE.RingGeometry(PHOTO.radius, PHOTO.radius + 0.05, 72), flat(COLORS.ink));
    photoRing.position.set(boardX, photoY, 0.02);
    const photo = faceDisc(face, PHOTO.radius - 0.04, 0.03);
    photo.position.set(boardX, photoY, 0.03);
    const halo = new THREE.Mesh(new THREE.RingGeometry(PHOTO.radius + 0.13, PHOTO.radius + 0.19, 72), flat(COLORS.accent));
    halo.position.set(boardX, photoY, 0.04);
    halo.visible = false;
    root.add(paper, photoRing, photo, halo);

    let swish = 0;
    let lastTime = 0;

    return {
      root,
      onScore: () => {
        swish = 1;
      },
      setSelected: (selected, time) => {
        const delta = Math.min(time - lastTime, 0.1);
        lastTime = time;
        swish = Math.max(0, swish - delta * NET.swishDecay);
        net.scale.y = 1 + Math.sin(swish * Math.PI) * NET.swishStretch;

        halo.visible = selected;
        const color = selected ? COLORS.accent : COLORS.ink;
        (rimMaterial as THREE.MeshBasicMaterial).color.setHex(color);
        (photoRing.material as THREE.MeshBasicMaterial).color.setHex(color);
      },
    };
  },

  // A flat ball with two seams — reads as a basketball while staying in the ink-on-paper look.
  buildProjectile: () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), flat(COLORS.ink)));
    const seam = flat(COLORS.paper);
    const vertical = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.44), seam);
    const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.025), seam);
    vertical.position.z = horizontal.position.z = 0.01;
    group.add(vertical, horizontal);
    return group;
  },

  ...minimalBursts,
  aimDotColor: COLORS.muted,
  // Hoops stand still: aiming is the game.
  sway: 0,
  bob: 0,
});
