import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { coilGeometry } from "@/components/three-d/funny-face";
import { initialsFace, onCandidateSelected, photoTexture } from "@/components/three-d/photo-kit";
import { runStage } from "@/components/three-d/scene-engine";
import { CANDIDATE_SELECTED_EVENT } from "@/config/visuals";
import type { StagePerson, ThemeScene } from "../types";

const CONFIG = {
  /** Layout, in world units. */
  spacing: 2.45,
  box: 1.5,
  headRadius: 1,
  /** Spring length at extension 1. */
  reach: 1.25,
  fov: 32,
  margin: 0.25,
  /** How far the open lid swings back (radians): all the way down behind the box, out of sight from the front. */
  lidOpen: 3.05,

  /** Fixed physics step: identical motion at 60, 90 or 120 Hz, no jitter from frame spikes. */
  physicsStep: 1 / 120,
  /** Underdamped (ζ ≈ 0.4) so the pop overshoots and settles with a couple of wobbles. */
  pop: { stiffness: 170, damping: 10.5 },
  sway: { stiffness: 55, damping: 5 },

  targets: { idle: 1, proud: 1.35, shy: 0.8, ducked: -0.15 },
  duckSeconds: 0.42,
  popKick: 9,

  boxColors: [0xff4f8b, 0x14c7b0, 0x6271ff, 0xffa31a],
  /** Softer reflections keep the box colours saturated instead of washed out. */
  environmentIntensity: 0.55,
  ribbon: 0xfff4d6,
  sparkles: 18,
} as const;

type Jack = {
  person: StagePerson;
  root: THREE.Group;
  lidPivot: THREE.Group;
  stalk: THREE.Group;
  coil: THREE.Mesh;
  head: THREE.Group;
  hitTargets: THREE.Object3D[];
  extension: number;
  extensionVelocity: number;
  sway: number;
  swayVelocity: number;
  duckedFor: number;
  phase: number;
};

type Sparkle = { sprite: THREE.Sprite; velocity: THREE.Vector3; age: number };

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const softShadowTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, "rgba(40, 20, 40, 0.35)");
    gradient.addColorStop(1, "rgba(40, 20, 40, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
};

const sparkleTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#ffd23f";
    context.beginPath();
    for (let i = 0; i <= 8; i++) {
      const radius = i % 2 === 0 ? 30 : 11;
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      context.lineTo(32 + Math.cos(angle) * radius, 32 + Math.sin(angle) * radius);
    }
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/**
 * Jack-in-the-box per candidate, in a tidy row. Tap a box or face: it ducks in, the lid
 * shuts, then it boings back out. Picking a candidate on the ballot makes theirs stand tall.
 */
const jackboxScene: ThemeScene = (canvas, options, container) =>
  runStage(
    canvas,
    options,
    ({ scene, camera, renderer, pointer }) => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = environment;
      scene.environmentIntensity = CONFIG.environmentIntensity;
      scene.add(new THREE.HemisphereLight(0xffffff, 0xffe4ef, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(3, 6, 5);
      scene.add(key);
      camera.fov = CONFIG.fov;

      const people: StagePerson[] = options.people?.length
        ? options.people
        : options.photos.map((photo, index) => ({ id: String(index), initials: "", photo }));

      const { box: size } = CONFIG;
      const boxGeometry = new RoundedBoxGeometry(size, size, size, 6, 0.16);
      const ribbonGeometry = new THREE.BoxGeometry(size * 1.012, size * 1.012, 0.2);
      const lidGeometry = new RoundedBoxGeometry(size * 1.08, 0.22, size * 1.08, 4, 0.08);
      const lidRibbonGeometry = new THREE.BoxGeometry(0.2, 0.235, size * 1.09);
      const loopGeometry = new THREE.TorusGeometry(0.17, 0.065, 12, 28);
      const knotGeometry = new THREE.SphereGeometry(0.09, 16, 12);
      const coil = coilGeometry(0.26, 8, 0.05);
      const faceGeometry = new THREE.CircleGeometry(CONFIG.headRadius, 64);
      const rimGeometry = new THREE.TorusGeometry(CONFIG.headRadius, 0.075, 16, 72);
      const backGeometry = new THREE.SphereGeometry(CONFIG.headRadius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
      backGeometry.rotateX(-Math.PI / 2);
      backGeometry.scale(1, 1, 0.55);
      const shadowGeometry = new THREE.PlaneGeometry(size * 2, size * 2);

      const ribbonMaterial = new THREE.MeshPhysicalMaterial({ color: CONFIG.ribbon, roughness: 0.3, sheen: 0.6 });
      const coilMaterial = new THREE.MeshStandardMaterial({ color: 0xe3e6ea, metalness: 0.9, roughness: 0.22 });
      const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const shadowMaterial = new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false });

      const jacks: Jack[] = people.map((person, index) => {
        const boxMaterial = new THREE.MeshPhysicalMaterial({
          color: CONFIG.boxColors[index % CONFIG.boxColors.length],
          roughness: 0.38,
          clearcoat: 0.6,
          clearcoatRoughness: 0.25,
        });
        const root = new THREE.Group();

        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.005;

        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.y = size / 2;
        const ribbonA = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
        ribbonA.position.y = size / 2;
        const ribbonB = ribbonA.clone();
        ribbonB.rotation.y = Math.PI / 2;

        // Lid hinged along the back edge of the box top, with ribbon and a bow.
        const lidPivot = new THREE.Group();
        lidPivot.position.set(0, size, -size / 2);
        const lid = new THREE.Group();
        lid.position.set(0, 0.11, size / 2);
        lid.add(new THREE.Mesh(lidGeometry, boxMaterial), new THREE.Mesh(lidRibbonGeometry, ribbonMaterial));
        const bow = new THREE.Group();
        bow.position.y = 0.2;
        [-1, 1].forEach((side) => {
          const loop = new THREE.Mesh(loopGeometry, ribbonMaterial);
          loop.position.x = side * 0.17;
          loop.rotation.y = (side * Math.PI) / 5;
          bow.add(loop);
        });
        bow.add(new THREE.Mesh(knotGeometry, ribbonMaterial));
        lid.add(bow);
        lidPivot.add(lid);

        // Stalk: spring + head, pivoting at the box opening so sway bends the whole thing.
        const stalk = new THREE.Group();
        stalk.position.y = size * 0.92;
        const coilMesh = new THREE.Mesh(coil, coilMaterial);
        const head = new THREE.Group();
        const texture = person.photo ? photoTexture(person.photo) : initialsFace(person.initials, index);
        const face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({ map: texture }));
        face.position.z = 0.012;
        const rim = new THREE.Mesh(rimGeometry, whiteMaterial);
        const back = new THREE.Mesh(backGeometry, whiteMaterial);
        head.add(back, face, rim);
        stalk.add(coilMesh, head);

        root.add(shadow, box, ribbonA, ribbonB, lidPivot, stalk);
        scene.add(root);
        return {
          person,
          root,
          lidPivot,
          stalk,
          coil: coilMesh,
          head,
          hitTargets: [box, face, back],
          extension: 0,
          // Staggered entrance: each jack pops out a moment after the previous one.
          extensionVelocity: 0,
          sway: 0,
          swayVelocity: 0,
          duckedFor: 0.35 + index * 0.18,
          phase: index * 1.7,
        };
      });

      // Sparkles for taps (small, few — decoration, not confetti).
      const sparkleMaterial = new THREE.SpriteMaterial({ map: sparkleTexture(), transparent: true, depthWrite: false });
      const sparkles: Sparkle[] = Array.from({ length: CONFIG.sparkles }, () => {
        const sprite = new THREE.Sprite(sparkleMaterial.clone());
        sprite.visible = false;
        scene.add(sprite);
        return { sprite, velocity: new THREE.Vector3(), age: -1 };
      });
      const sparkle = (at: THREE.Vector3, count: number) => {
        let emitted = 0;
        sparkles.forEach((item) => {
          if (item.age >= 0 || emitted >= count) return;
          emitted++;
          item.age = 0;
          item.sprite.visible = true;
          item.sprite.position.copy(at);
          const angle = (emitted / count) * Math.PI * 2;
          item.velocity.set(Math.cos(angle) * 2.2, Math.sin(angle) * 2.2 + 1.5, 0.5);
        });
      };

      let selectedId: string | null = null;
      const baseTarget = (jack: Jack) =>
        selectedId === null ? CONFIG.targets.idle : jack.person.id === selectedId ? CONFIG.targets.proud : CONFIG.targets.shy;

      const duck = (jack: Jack) => {
        if (jack.duckedFor > 0) return;
        jack.duckedFor = CONFIG.duckSeconds;
        jack.swayVelocity += (Math.random() - 0.5) * 3;
      };

      // ── Tapping: a proper raycast against each jack's box and face, inside the stage only.
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const surface = container ?? canvas;
      const handlePointerDown = (event: PointerEvent) => {
        const rect = surface.getBoundingClientRect();
        ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
        raycaster.setFromCamera(ndc, camera);
        const hit = jacks.find((jack) => raycaster.intersectObjects(jack.hitTargets, false).length > 0);
        if (hit) duck(hit);
      };
      surface.addEventListener("pointerdown", handlePointerDown);

      const unsubscribe = onCandidateSelected(CANDIDATE_SELECTED_EVENT, (_photo, candidateId) => {
        selectedId = candidateId;
        const chosen = jacks.find((jack) => jack.person.id === candidateId);
        if (chosen) {
          chosen.extensionVelocity += CONFIG.popKick;
          sparkle(chosen.head.getWorldPosition(new THREE.Vector3()), 8);
        }
      });

      const frame = (width: number, height: number) => {
        const aspect = width / height;
        const count = Math.max(jacks.length, 1);
        const widest = Math.max(size * 1.1, CONFIG.headRadius * 2.2);
        const rowWidth = (count - 1) * CONFIG.spacing + widest + CONFIG.margin * 2;
        const tallest = size + 0.2 + CONFIG.reach * CONFIG.targets.proud + CONFIG.headRadius * 2.1 + CONFIG.margin;
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov / 2));
        const distance = Math.max(tallest / 2 / tanHalf, rowWidth / 2 / (tanHalf * aspect));
        const centreY = tallest / 2;
        camera.position.set(0, centreY + distance * 0.08, distance);
        camera.lookAt(0, centreY, 0);
        jacks.forEach((jack, index) => jack.root.position.set((index - (count - 1) / 2) * CONFIG.spacing, 0, 0));
      };

      let accumulator = 0;
      const lookAt = new THREE.Vector3();

      const physics = (time: number, dt: number) => {
        jacks.forEach((jack) => {
          let target = baseTarget(jack) + Math.sin(time * 1.3 + jack.phase) * 0.025;
          if (jack.duckedFor > 0) {
            target = CONFIG.targets.ducked;
            jack.duckedFor -= dt;
            if (jack.duckedFor <= 0) {
              jack.extensionVelocity += CONFIG.popKick; // BOING
              jack.swayVelocity += (Math.random() - 0.5) * 4;
              sparkle(jack.head.getWorldPosition(new THREE.Vector3()), 5);
            }
          }
          jack.extensionVelocity += (CONFIG.pop.stiffness * (target - jack.extension) - CONFIG.pop.damping * jack.extensionVelocity) * dt;
          jack.extension += jack.extensionVelocity * dt;
          jack.swayVelocity += (-CONFIG.sway.stiffness * jack.sway - CONFIG.sway.damping * jack.swayVelocity) * dt;
          jack.sway += jack.swayVelocity * dt;
        });
      };

      return {
        resize: (width, height) => frame(width, height),
        update: (time, delta) => {
          accumulator += delta;
          let steps = 0;
          while (accumulator >= CONFIG.physicsStep && steps < 24) {
            physics(time, CONFIG.physicsStep);
            accumulator -= CONFIG.physicsStep;
            steps++;
          }

          lookAt.set(pointer.x * 4, 2 + pointer.y * 2, 6);
          jacks.forEach((jack, index) => {
            const out = Math.max(jack.extension, 0);
            const length = Math.max(out * CONFIG.reach, 0.04);
            jack.coil.scale.set(1, length, 1);
            // Squash & stretch from spring speed; the head shrinks away only when ducking into the box.
            const stretch = THREE.MathUtils.clamp(jack.extensionVelocity * 0.025, -0.22, 0.22);
            const presence = smoothstep(-0.12, 0.28, jack.extension);
            jack.head.position.y = length + CONFIG.headRadius * 0.92;
            jack.head.scale.set(presence * (1 - stretch * 0.5), presence * (1 + stretch), presence);
            jack.stalk.rotation.z = THREE.MathUtils.clamp(jack.sway, -0.6, 0.6) + Math.sin(time * 1.1 + jack.phase) * 0.035;
            // Faces turn gently toward the pointer.
            const towards = lookAt.x - jack.root.position.x;
            jack.head.rotation.y = THREE.MathUtils.clamp(towards * 0.06, -0.3, 0.3);
            jack.head.rotation.x = THREE.MathUtils.clamp(-pointer.y * 0.15, -0.2, 0.2);
            // Lid swings open as the jack comes out, shuts when it ducks.
            jack.lidPivot.rotation.x = -smoothstep(-0.05, 0.35, jack.extension) * CONFIG.lidOpen - Math.sin(time * 2 + index) * 0.02;
          });

          sparkles.forEach((item) => {
            if (item.age < 0) return;
            item.age += delta / 0.8;
            item.velocity.y -= delta * 5;
            item.sprite.position.addScaledVector(item.velocity, delta);
            item.sprite.scale.setScalar(0.32 * (1 - item.age));
            item.sprite.material.opacity = 1 - item.age;
            if (item.age >= 1) {
              item.age = -1;
              item.sprite.visible = false;
            }
          });
        },
        dispose: () => {
          unsubscribe();
          surface.removeEventListener("pointerdown", handlePointerDown);
          environment.dispose();
          pmrem.dispose();
        },
      };
    },
    container,
  );

export default jackboxScene;
