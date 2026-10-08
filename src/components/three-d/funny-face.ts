import * as THREE from "three";
import { extrude } from "./scene-kit";

/**
 * A funny face rig shared by the photo themes: the photo seen through a wobbling
 * "funhouse mirror" shader, an accessory, googly eyes that follow the pointer,
 * and an emoji burst + dizzy spin on tap. Face radius is 1 in local units.
 */

const FACE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FACE_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uWobble;
  uniform float uSeed;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    // Funhouse mirror: a permanent bulge around the middle of the face (big nose, big eyes)…
    vec2 centre = vec2(0.5 + 0.05 * sin(uSeed * 7.0), 0.47 + 0.04 * cos(uSeed * 5.0));
    vec2 d = uv - centre;
    float bulge = 0.42 + 0.22 * sin(uTime * 2.3 + uSeed) * (0.35 + uWobble);
    uv = centre + d * (1.0 - bulge * exp(-dot(d, d) * 16.0));
    // …plus jelly ripples that grow while the spring is bouncing.
    uv.x += sin(vUv.y * 13.0 + uTime * 9.0 + uSeed) * 0.03 * uWobble;
    uv.y += sin(vUv.x * 11.0 + uTime * 7.0 + uSeed * 2.0) * 0.025 * uWobble;
    gl_FragColor = texture2D(uMap, clamp(uv, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

export type AccessoryKind = "party" | "crown" | "glasses" | "mustache" | "bow";

const ACCESSORY_CYCLE: AccessoryKind[] = ["party", "glasses", "mustache", "crown", "bow", "party", "mustache"];

const stripeTexture = (a: string, b: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    for (let i = 0; i < 8; i++) {
      context.fillStyle = i % 2 ? a : b;
      context.fillRect(0, i * 8, 64, 8);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const mustacheShape = () => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.05);
  shape.bezierCurveTo(-0.2, 0.25, -0.55, 0.15, -0.75, -0.12);
  shape.bezierCurveTo(-0.5, -0.02, -0.25, -0.12, 0, -0.04);
  shape.bezierCurveTo(0.25, -0.12, 0.5, -0.02, 0.75, -0.12);
  shape.bezierCurveTo(0.55, 0.15, 0.2, 0.25, 0, 0.05);
  return shape;
};

/** Shared, lazily built geometry/materials for accessories and eyes (one set per scene). */
export const createFaceKit = () => {
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.7, roughness: 0.25 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.25 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const brown = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.6 });
  const partyMaterials = [
    new THREE.MeshStandardMaterial({ map: stripeTexture("#ff5d8f", "#ffe14d"), roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ map: stripeTexture("#00c2a8", "#ffffff"), roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ map: stripeTexture("#5b6cff", "#ffb000"), roughness: 0.5 }),
  ];
  const bowMaterial = new THREE.MeshStandardMaterial({ color: 0xff3b6b, roughness: 0.45 });

  const geometry = {
    face: new THREE.CircleGeometry(1, 48),
    rim: new THREE.TorusGeometry(1.02, 0.07, 12, 64),
    eye: new THREE.SphereGeometry(0.24, 24, 16),
    pupil: new THREE.SphereGeometry(0.11, 16, 12),
    cone: new THREE.ConeGeometry(0.45, 1.1, 24),
    pompom: new THREE.SphereGeometry(0.13, 16, 12),
    crownBand: new THREE.CylinderGeometry(0.48, 0.48, 0.24, 24, 1, true),
    crownSpike: new THREE.ConeGeometry(0.11, 0.34, 8),
    lens: new THREE.CylinderGeometry(0.3, 0.3, 0.06, 32),
    bridge: new THREE.BoxGeometry(0.22, 0.05, 0.05),
    mustache: extrude(mustacheShape(), 0.08, 0.03),
    bowWing: new THREE.ConeGeometry(0.22, 0.4, 4),
    bowKnot: new THREE.SphereGeometry(0.1, 12, 8),
  };

  const accessory = (kind: AccessoryKind, index: number): THREE.Group => {
    const group = new THREE.Group();
    if (kind === "party") {
      const hat = new THREE.Mesh(geometry.cone, partyMaterials[index % partyMaterials.length]);
      const pompom = new THREE.Mesh(geometry.pompom, white);
      pompom.position.y = 0.58;
      group.add(hat, pompom);
      group.position.set(0.28, 1.25, 0);
      group.rotation.z = -0.35;
    } else if (kind === "crown") {
      group.add(new THREE.Mesh(geometry.crownBand, gold));
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(geometry.crownSpike, gold);
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.46, 0.27, Math.sin(angle) * 0.46);
        group.add(spike);
      }
      group.position.set(0, 1.1, 0);
      group.rotation.z = 0.15;
    } else if (kind === "glasses") {
      [-1, 1].forEach((side) => {
        const lens = new THREE.Mesh(geometry.lens, black);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(side * 0.34, 0, 0);
        group.add(lens);
      });
      group.add(new THREE.Mesh(geometry.bridge, black));
      group.position.set(0, 0.2, 0.12);
    } else if (kind === "mustache") {
      const mustache = new THREE.Mesh(geometry.mustache, brown);
      group.add(mustache);
      group.position.set(0, -0.3, 0.1);
    } else {
      // Bow on top of the head.
      [-1, 1].forEach((side) => {
        const wing = new THREE.Mesh(geometry.bowWing, bowMaterial);
        wing.rotation.z = (side * Math.PI) / 2;
        wing.position.x = side * 0.2;
        group.add(wing);
      });
      group.add(new THREE.Mesh(geometry.bowKnot, bowMaterial));
      group.position.set(0.45, 0.95, 0.05);
      group.rotation.z = -0.4;
    }
    return group;
  };

  return { geometry, materials: { white, black }, accessory };
};

export type FaceKit = ReturnType<typeof createFaceKit>;

export type FunnyFace = {
  group: THREE.Group;
  uniforms: {
    uMap: { value: THREE.Texture };
    uTime: { value: number };
    uWobble: { value: number };
    uSeed: { value: number };
  };
  pupils: { mesh: THREE.Mesh; eye: THREE.Vector2 }[];
  /** Dizzy spin progress (0..1), -1 when idle. */
  dizzy: number;
};

const EYE_SPOT = new THREE.Vector2(0.32, 0.22);
const PUPIL_TRAVEL = 0.11;

/** Builds one funny face: funhouse photo + white rim + accessory + googly eyes (unless wearing glasses). */
export const createFunnyFace = (kit: FaceKit, texture: THREE.Texture, index: number): FunnyFace => {
  const group = new THREE.Group();
  const uniforms = {
    uMap: { value: texture },
    uTime: { value: 0 },
    uWobble: { value: 0 },
    uSeed: { value: index * 1.37 },
  };
  const face = new THREE.Mesh(
    kit.geometry.face,
    new THREE.ShaderMaterial({ vertexShader: FACE_VERTEX, fragmentShader: FACE_FRAGMENT, uniforms }),
  );
  const rim = new THREE.Mesh(kit.geometry.rim, kit.materials.white);
  group.add(face, rim);

  const kind = ACCESSORY_CYCLE[index % ACCESSORY_CYCLE.length];
  group.add(kit.accessory(kind, index));

  const pupils: FunnyFace["pupils"] = [];
  if (kind !== "glasses") {
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(kit.geometry.eye, kit.materials.white);
      eye.scale.z = 0.45;
      eye.position.set(side * EYE_SPOT.x, EYE_SPOT.y, 0.06);
      const pupil = new THREE.Mesh(kit.geometry.pupil, kit.materials.black);
      pupil.position.set(eye.position.x, eye.position.y, 0.16);
      group.add(eye, pupil);
      pupils.push({ mesh: pupil, eye: new THREE.Vector2(eye.position.x, eye.position.y) });
    });
  }
  return { group, uniforms, pupils, dizzy: -1 };
};

const lookLocal = new THREE.Vector3();

/** Per-frame update: shader time/wobble, pupils toward a world-space target, dizzy spin. */
export const updateFunnyFace = (
  face: FunnyFace,
  time: number,
  delta: number,
  wobble: number,
  lookAt: THREE.Vector3,
) => {
  face.uniforms.uTime.value = time;
  face.uniforms.uWobble.value += (Math.min(wobble, 1) - face.uniforms.uWobble.value) * 0.2;

  if (face.pupils.length) {
    face.group.updateMatrixWorld();
    lookLocal.copy(lookAt);
    face.group.worldToLocal(lookLocal);
    face.pupils.forEach(({ mesh, eye }) => {
      const dx = lookLocal.x - eye.x;
      const dy = lookLocal.y - eye.y;
      const length = Math.hypot(dx, dy) || 1;
      mesh.position.x = eye.x + (dx / length) * PUPIL_TRAVEL;
      mesh.position.y = eye.y + (dy / length) * PUPIL_TRAVEL;
    });
  }

  if (face.dizzy >= 0) {
    face.dizzy += delta / 0.9;
    face.group.rotation.y = Math.sin(Math.min(face.dizzy, 1) * Math.PI) * Math.PI * 2 * (1 - face.dizzy * 0.3);
    if (face.dizzy >= 1) {
      face.dizzy = -1;
      face.group.rotation.y = 0;
    }
  }
};

// ───────── emoji bursts ─────────

const EMOJIS = ["🤣", "😍", "🔥", "⭐", "🎉", "😎", "🤪", "💥", "❤️", "👑"];

const emojiTexture = (emoji: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.font = "100px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(emoji, 64, 72);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

type Particle = { sprite: THREE.Sprite; velocity: THREE.Vector3; age: number };

/** Pooled emoji sprites that pop out of a face, arc up and fade. */
export const createEmojiBurst = (scene: THREE.Scene, poolSize = 40) => {
  const materials = EMOJIS.map(
    (emoji) => new THREE.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthWrite: false }),
  );
  const particles: Particle[] = Array.from({ length: poolSize }, (_, index) => {
    const sprite = new THREE.Sprite(materials[index % materials.length]);
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, velocity: new THREE.Vector3(), age: -1 };
  });

  const emit = (at: THREE.Vector3, amount: number, size: number) => {
    let emitted = 0;
    particles.forEach((particle) => {
      if (particle.age >= 0 || emitted >= amount) return;
      emitted++;
      particle.age = 0;
      particle.sprite.visible = true;
      particle.sprite.material = materials[Math.floor(Math.random() * materials.length)];
      particle.sprite.position.copy(at);
      particle.sprite.scale.setScalar(size);
      const angle = Math.random() * Math.PI * 2;
      const speed = size * (3 + Math.random() * 3);
      particle.velocity.set(Math.cos(angle) * speed, Math.abs(Math.sin(angle)) * speed + size * 3, 0.5);
    });
  };

  const update = (delta: number) => {
    particles.forEach((particle) => {
      if (particle.age < 0) return;
      particle.age += delta / 1.1;
      particle.velocity.y -= delta * 9;
      particle.sprite.position.addScaledVector(particle.velocity, delta);
      particle.sprite.material.opacity = 1 - Math.max(0, particle.age - 0.6) / 0.4;
      if (particle.age >= 1) {
        particle.age = -1;
        particle.sprite.visible = false;
      }
    });
  };

  return { emit, update };
};

// ───────── input helpers shared by the spring themes ─────────

/** Taps on real UI (cards, buttons, inputs) must never be stolen by the scene behind it. */
export const isOnInterface = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest("button, a, input, textarea, label, select, .panel, .candidate"));

const projected = new THREE.Vector3();

/** Index of the face whose on-screen disc contains the client point, or -1. */
export const pickFace = (
  centres: THREE.Vector3[],
  worldRadius: number[],
  camera: THREE.PerspectiveCamera,
  clientX: number,
  clientY: number,
) => {
  let best = -1;
  let bestDistance = Infinity;
  centres.forEach((centre, index) => {
    projected.copy(centre).project(camera);
    const x = ((projected.x + 1) / 2) * window.innerWidth;
    const y = ((1 - projected.y) / 2) * window.innerHeight;
    const depth = camera.position.z - centre.z;
    const pixelsPerUnit = window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth);
    const distance = Math.hypot(clientX - x, clientY - y);
    if (distance < worldRadius[index] * pixelsPerUnit * 1.15 && distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
};

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Phone shake detection (devicemotion). Android fires freely; iOS needs permission,
 * requested from the caller's tap handler via `requestOnTap`.
 */
export const listenForShake = (onShake: (strength: number) => void) => {
  let last = 0;
  const handleMotion = (event: DeviceMotionEvent) => {
    const a = event.acceleration ?? event.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const strength = Math.hypot(a.x, a.y, a.z) - (event.acceleration ? 0 : 9.8);
    const now = performance.now();
    if (strength > 12 && now - last > 350) {
      last = now;
      onShake(Math.min(strength / 25, 1));
    }
  };
  window.addEventListener("devicemotion", handleMotion);
  const api = (window.DeviceMotionEvent as unknown as MotionPermission | undefined) ?? {};
  let asked = false;
  const requestOnTap = () => {
    if (asked || !api.requestPermission) return;
    asked = true;
    api.requestPermission().catch(() => undefined);
  };
  return { requestOnTap, dispose: () => window.removeEventListener("devicemotion", handleMotion) };
};

/** A helix tube of unit height (y from 0 to 1) — scale.y stretches it into any spring length. */
export const coilGeometry = (radius = 0.22, turns = 9, thickness = 0.045) => {
  class Helix extends THREE.Curve<THREE.Vector3> {
    // Curve's own constructor is protected; a public one makes the subclass constructible.
    constructor() {
      super();
    }

    getPoint(t: number, target = new THREE.Vector3()) {
      const angle = t * turns * Math.PI * 2;
      return target.set(Math.cos(angle) * radius, t, Math.sin(angle) * radius);
    }
  }
  return new THREE.TubeGeometry(new Helix(), turns * 24, thickness, 8, false);
};
