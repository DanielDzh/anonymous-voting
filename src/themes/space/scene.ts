import * as THREE from "three";
import { createCannonScene, faceDisc, flatRing } from "@/components/three-d/cannon-game";
import { HOOP, HOOP_TARGET_DROP, NET, PHOTO, netGeometry } from "../hoop/hoop-shape";

/** Space: a neon laser cannon on a little moon, neon hoops with each candidate on a little planet. */

const COLORS = {
  sky: 0x07071f,
  cyan: 0x38f2ff,
  magenta: 0xff3df2,
  violet: 0x7b5cff,
  moon: 0x3a3f66,
  hull: 0xd9def5,
  planets: [0xff8a3d, 0x4dd6a8, 0x8b7bff, 0xff5c8a],
  sparks: [0x38f2ff, 0xff3df2, 0xffffff, 0xfff27a],
} as const;

const STAR_COUNT = 260;

const glow = (color: number, intensity = 1.6) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3 });

export default createCannonScene({
  setupWorld: ({ scene }) => {
    scene.background = new THREE.Color(COLORS.sky);
    scene.environmentIntensity = 0.35;
    scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x1a0b33, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(-5, 5, 8);
    scene.add(key);
    const rim = new THREE.PointLight(COLORS.magenta, 30, 0, 1.6);
    scene.add(rim);

    // Stars spread over a unit square; layout stretches them to the stage.
    const starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      starPositions.set([Math.random() * 2 - 1, Math.random() * 2 - 1, -2 - Math.random() * 3], i * 3);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const nebula = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    scene.add(nebula);

    const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshStandardMaterial({ color: COLORS.moon, roughness: 0.95 }));
    scene.add(moon);

    return {
      layout: (half, unit) => {
        stars.scale.set(half.x * 1.3, half.y * 1.3, 1);
        nebula.scale.setScalar(half.x * 1.1);
        nebula.position.set(-half.x * 0.3, half.y * 0.1, -4);
        // A big moon horizon at the bottom, the cannon stands on it.
        moon.scale.setScalar(half.x * 1.4);
        moon.position.set(0, -half.y - half.x * 1.4 + unit * 0.6, -1.2);
        rim.position.set(half.x, half.y * 0.2, 3);
      },
      update: (time) => {
        starMaterial.opacity = 0.75 + Math.sin(time * 2) * 0.2;
        stars.rotation.z = time * 0.01;
      },
    };
  },

  buildCannon: () => {
    const root = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: COLORS.hull, metalness: 0.6, roughness: 0.25 });
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hull);
    base.position.y = -0.3;
    const baseRing = flatRing(0.72, 0.06, glow(COLORS.cyan));
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = -0.28;

    const barrel = new THREE.Group();
    barrel.position.set(0, 0.2, 0);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.5, 28), hull);
    tube.position.y = 0.7;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.56, 12), glow(COLORS.cyan, 2.4));
    core.position.y = 0.7;
    barrel.add(tube, core);
    [0.3, 0.75, 1.2].forEach((y, index) => {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.25 - y * 0.05, 0.045, 10, 32), glow(index % 2 ? COLORS.magenta : COLORS.cyan));
      coil.rotation.x = Math.PI / 2;
      coil.position.y = y;
      barrel.add(coil);
    });
    root.add(base, baseRing, barrel);
    return { root, barrel, muzzle: 1.45 };
  },

  // Neon hoops: same rules as 20 · Кільце (only a drop through the rim counts; the board banks shots).
  hoop: HOOP,
  targetDrop: HOOP_TARGET_DROP,

  buildTarget: (face, index, side) => {
    const root = new THREE.Group();
    const planetColor = COLORS.planets[index % COLORS.planets.length];
    const boardX = side * HOOP.board.x;
    const boardHeight = HOOP.board.top - HOOP.board.bottom;

    // Glowing backboard, bracket and rim; the rim and photo ring switch to cyan for the leader.
    const board = new THREE.Mesh(new THREE.BoxGeometry(HOOP.board.thickness, boardHeight, 0.08), glow(COLORS.violet, 1.4));
    board.position.set(boardX, HOOP.board.bottom + boardHeight / 2, 0);
    const bracketLength = HOOP.board.x - HOOP.rimHalf;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(bracketLength, 0.05, 0.05), glow(COLORS.violet, 1.2));
    bracket.position.set(side * (HOOP.rimHalf + bracketLength / 2), 0.08, 0);
    const rimMaterial = glow(COLORS.magenta, 2.2);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(HOOP.rimTube, HOOP.rimTube, HOOP.rimHalf * 2 + HOOP.rimTube * 2, 16), rimMaterial);
    rim.rotation.z = Math.PI / 2;
    const net = new THREE.LineSegments(
      netGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending }),
    );
    net.position.y = -HOOP.rimTube;
    root.add(board, bracket, rim, net);

    // The candidate on a little planet on top of the board.
    const photoY = HOOP.board.top + PHOTO.gap + PHOTO.radius;
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(PHOTO.radius + 0.06, 32, 20),
      new THREE.MeshStandardMaterial({ color: planetColor, roughness: 0.6 }),
    );
    planet.position.set(boardX, photoY, -0.2);
    // In front of the planet's surface (its centre is at -0.2), or the sphere hides the photo.
    const photoZ = PHOTO.radius + 0.12;
    const photoRingMaterial = glow(0xffffff, 0.8);
    const photoRing = flatRing(PHOTO.radius - 0.02, 0.035, photoRingMaterial);
    photoRing.position.set(boardX, photoY, photoZ);
    const photo = faceDisc(face, PHOTO.radius - 0.05, photoZ);
    photo.position.x = boardX;
    photo.position.y = photoY;
    const halo = flatRing(PHOTO.radius + 0.18, 0.03, new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, blending: THREE.AdditiveBlending }));
    halo.position.set(boardX, photoY, photoZ);
    halo.visible = false;
    root.add(planet, photoRing, photo, halo);

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

        const color = selected ? COLORS.cyan : COLORS.magenta;
        rimMaterial.color.setHex(color);
        rimMaterial.emissive.setHex(color);
        photoRingMaterial.emissive.setHex(selected ? COLORS.cyan : 0xffffff);
        halo.visible = selected;
        if (selected) {
          halo.scale.setScalar(1 + ((time * 0.8) % 1) * 0.35);
          (halo.material as THREE.MeshBasicMaterial).opacity = 1 - ((time * 0.8) % 1);
        }
      },
    };
  },

  buildProjectile: () => {
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })),
      new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 12),
        new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
      ),
    );
    return group;
  },

  hitBurst: {
    geometry: new THREE.OctahedronGeometry(1),
    colors: [...COLORS.sparks],
    count: 55,
    speed: 8,
    gravity: 0,
    life: 0.9,
    size: 0.1,
    glow: true,
  },
  missBurst: {
    geometry: new THREE.OctahedronGeometry(1),
    colors: [COLORS.cyan, COLORS.violet],
    count: 12,
    speed: 3,
    gravity: 0,
    life: 0.5,
    size: 0.08,
    glow: true,
  },
  trail: {
    geometry: new THREE.SphereGeometry(1, 8, 6),
    colors: [COLORS.cyan, COLORS.magenta],
    count: 1,
    speed: 0.3,
    gravity: 0,
    life: 0.45,
    size: 0.12,
    glow: true,
    every: 0.016,
  },
  shockwave: { color: COLORS.cyan },
  // Most baskets wins the vote (a tie chooses nobody), like 20 · Кільце.
  tally: true,
  aimDotColor: COLORS.cyan,
  // Hoops stand still: aiming is the game.
  sway: 0,
  bob: 0,
});
