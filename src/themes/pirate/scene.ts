import * as THREE from "three";
import { createCannonScene, faceDisc, flatRing, wheel } from "@/components/three-d/cannon-game";

/** Cartoon pirates: an iron cannon on a ship's deck firing at barrels bobbing on the waves. */

const COLORS = {
  sky: 0xbfe3f2,
  sea: 0x1f78b4,
  seaDeep: 0x175f91,
  foam: 0xffffff,
  deck: 0x8a5a33,
  deckDark: 0x6e4526,
  wood: 0xa86b3c,
  iron: 0x2b2b30,
  hoop: 0x3d3d44,
  gold: 0xf2c14e,
  sun: 0xfff1a8,
  smoke: [0xd8d8d8, 0xbdbdbd, 0xeeeeee],
  splinters: [0xa86b3c, 0x7a4a26, 0xffffff, 0x9fd8ff],
} as const;

const WAVE_ROWS = 6;
const WAVE_SEGMENTS = 48;

const standard = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** A wavy strip whose top edge is animated — stacked rows read as cartoon waves. */
const waveStrip = (color: number) => {
  const geometry = new THREE.PlaneGeometry(1, 1, WAVE_SEGMENTS, 1);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.35, flatShading: true }));
  const base = Float32Array.from(geometry.attributes.position.array);
  return { mesh, base };
};

export default createCannonScene({
  setupWorld: ({ scene }) => {
    scene.background = new THREE.Color(COLORS.sky);
    scene.environmentIntensity = 0.5;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a6f9b, 1.5));
    const light = new THREE.DirectionalLight(0xffffff, 1.8);
    light.position.set(-4, 6, 8);
    scene.add(light);

    const sun = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: COLORS.sun }));
    sun.position.z = -4;
    scene.add(sun);

    const waves = Array.from({ length: WAVE_ROWS }, (_, index) => {
      const strip = waveStrip(index % 2 ? COLORS.sea : COLORS.seaDeep);
      scene.add(strip.mesh);
      return strip;
    });

    const deck = new THREE.Group();
    const boards = Array.from({ length: 3 }, (_, index) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), standard(index % 2 ? COLORS.deckDark : COLORS.deck, 0.85));
      deck.add(board);
      return board;
    });
    scene.add(deck);

    let half = { x: 1, y: 1 };
    let unit = 1;
    let horizon = 0;

    return {
      layout: (nextHalf, nextUnit, targetY) => {
        half = nextHalf;
        unit = nextUnit;
        // The sea starts just above the barrels, so they float in it.
        horizon = targetY + unit * 0.9;
        sun.scale.setScalar(unit * 0.6);
        // Between the barrels, so it never peeks out behind one of them.
        sun.position.set(0, horizon + unit * 0.2, -4);
        const rowHeight = (horizon + half.y) / WAVE_ROWS;
        waves.forEach(({ mesh }, index) => {
          mesh.scale.set(half.x * 2.4, rowHeight * 1.6, 1);
          mesh.position.set(0, horizon - rowHeight * (index + 0.8), -1.5 + index * 0.01);
        });
        boards.forEach((board, index) => {
          board.scale.set(half.x * 2.4, unit * 0.32, 0.6);
          board.position.set(0, -half.y + unit * (0.15 + index * 0.33), -0.4 - index * 0.01);
        });
      },
      update: (time) => {
        waves.forEach(({ mesh, base }, row) => {
          const position = mesh.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < position.count; i++) {
            const x = base[i * 3];
            const y = base[i * 3 + 1];
            // Only the top edge moves; amplitude in strip-local units (scaled by the row height).
            position.setY(i, y > 0 ? y + Math.sin(x * 14 + time * (1.4 + row * 0.2) + row) * 0.12 : y);
          }
          position.needsUpdate = true;
          mesh.position.x = Math.sin(time * 0.5 + row) * unit * 0.15;
        });
      },
    };
  },

  buildCannon: () => {
    const root = new THREE.Group();
    const wood = standard(COLORS.wood, 0.8);
    const iron = standard(COLORS.iron, 0.35, 0.8);
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.8), wood);
    carriage.position.y = 0.05;
    const leftWheel = wheel(0.38, 0.22, wood, iron);
    leftWheel.position.set(-0.55, -0.12, 0.45);
    const rightWheel = leftWheel.clone();
    rightWheel.position.x = 0.55;

    const barrel = new THREE.Group();
    barrel.position.set(0, 0.35, 0.1);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.33, 1.55, 28), iron);
    tube.position.y = 0.72;
    const breech = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), iron);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 10, 28), iron);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.y = 1.5;
    barrel.add(tube, breech, mouth);
    root.add(carriage, leftWheel, rightWheel, barrel);
    return { root, barrel, muzzle: 1.55 };
  },

  buildTarget: (face, index) => {
    const root = new THREE.Group();
    // A barrel lying end-on: the round lid faces us and carries the photo.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.9, 1.1, 36), standard(index % 2 ? COLORS.wood : 0x96603a, 0.75));
    body.rotation.x = Math.PI / 2;
    body.position.z = -0.55;
    root.add(body);
    const hoopMaterial = standard(COLORS.hoop, 0.4, 0.7);
    const rim = flatRing(0.97, 0.07, hoopMaterial);
    rim.position.z = 0.04;
    root.add(rim, faceDisc(face, 0.82, 0.06));

    const halo = flatRing(1.14, 0.08, new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.3 }));
    halo.position.z = 0.1;
    halo.visible = false;
    root.add(halo);

    return {
      root,
      setSelected: (selected, time) => {
        halo.visible = selected;
        if (selected) halo.rotation.z = Math.sin(time * 3) * 0.2;
      },
    };
  },

  buildProjectile: () => new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), standard(COLORS.iron, 0.3, 0.7)),

  hitBurst: {
    geometry: new THREE.BoxGeometry(1, 0.35, 0.2),
    colors: [...COLORS.splinters],
    count: 45,
    speed: 6,
    gravity: 9,
    life: 1.1,
    size: 0.2,
  },
  missBurst: {
    geometry: new THREE.SphereGeometry(1, 10, 8),
    colors: [0xffffff, 0x9fd8ff],
    count: 18,
    speed: 3.5,
    gravity: 6,
    life: 0.8,
    size: 0.12,
  },
  trail: {
    geometry: new THREE.SphereGeometry(1, 10, 8),
    colors: [...COLORS.smoke],
    count: 1,
    speed: 0.4,
    gravity: -1.5,
    life: 0.9,
    size: 0.16,
    grow: true,
    every: 0.03,
  },
  aimDotColor: 0xffffff,
  sway: 0.12,
  bob: 0.12,
});
