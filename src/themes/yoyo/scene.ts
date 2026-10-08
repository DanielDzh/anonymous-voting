import * as THREE from "three";
import {
  coilGeometry,
  createEmojiBurst,
  createFaceKit,
  createFunnyFace,
  isOnInterface,
  listenForShake,
  pickFace,
  updateFunnyFace,
  type FunnyFace,
} from "@/components/three-d/funny-face";
import { faceTextures, onCandidateSelected } from "@/components/three-d/photo-kit";
import { runStage } from "@/components/three-d/scene-engine";
import { addSoftLights, pointerOnPlane, randomBetween, visibleHalfSize } from "@/components/three-d/scene-kit";
import { CANDIDATE_SELECTED_EVENT } from "@/config/visuals";
import type { ThemeScene } from "../types";

const CONFIG = {
  count: { phone: 11, desktop: 20, lowPower: 8 },
  stiffness: 26,
  damping: 1.7,
  /** Real gravity is what makes each face hang straight down again after a swing (pendulum). */
  gravity: 9,
  tiltGravity: 9,
  postureFollow: 0.01,
  tug: 9,
  flick: 14,
  coilColors: [0xff5d8f, 0x00c2a8, 0x5b6cff, 0xffb000, 0xffffff],
} as const;

type Yoyo = {
  anchor: THREE.Vector2;
  position: THREE.Vector2;
  velocity: THREE.Vector2;
  restLength: number;
  radius: number;
  depth: number;
  coil: THREE.Mesh;
  hook: THREE.Mesh;
  head: THREE.Group;
  face: FunnyFace;
  photo: string | null;
};

const up = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();

/**
 * Faces hanging from the ceiling on springs of different lengths, filling the screen top to
 * bottom. Tap one to yank it down and watch it boing back; tilt the phone and they swing.
 */
const yoyoScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    addSoftLights(scene, 0xffffff, 0xdff6ff, 1.15);
    const kit = createFaceKit();
    const textures = faceTextures(options.photos, 3);
    const emojis = createEmojiBurst(scene);

    const count = options.lowPower ? CONFIG.count.lowPower : isNarrow() ? CONFIG.count.phone : CONFIG.count.desktop;
    // Coil drawn downward: flip the unit helix so y goes 0 → -1.
    // Many tight turns so even a long, stretched spring still reads as a coil.
    const coil = coilGeometry(0.14, 46, 0.028);
    coil.rotateX(Math.PI);
    const hookGeometry = new THREE.TorusGeometry(0.12, 0.035, 8, 20);
    const coilMaterials = CONFIG.coilColors.map(
      (color) => new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.3 }),
    );
    const hookMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.2 });

    const yoyos: Yoyo[] = Array.from({ length: count }, (_, index) => {
      const coilMesh = new THREE.Mesh(coil, coilMaterials[index % coilMaterials.length]);
      const hook = new THREE.Mesh(hookGeometry, hookMaterial);
      const head = new THREE.Group();
      const face = createFunnyFace(kit, textures[index % textures.length], index);
      head.add(face.group);
      scene.add(coilMesh, hook, head);
      return {
        anchor: new THREE.Vector2(),
        position: new THREE.Vector2(),
        velocity: new THREE.Vector2(randomBetween(-2, 2), 0),
        restLength: 1,
        radius: 1,
        depth: 0,
        coil: coilMesh,
        hook,
        head,
        face,
        photo: options.photos[index % Math.max(1, options.photos.length)] ?? null,
      };
    });

    const headCentres = yoyos.map(() => new THREE.Vector3());
    const headRadii = yoyos.map(() => 1);
    // Gravity plus the phone-tilt offset; the tilt part only appears once orientation events arrive.
    const gravity = new THREE.Vector2(0, -CONFIG.gravity);
    const lookTarget = new THREE.Vector3();
    const previousPointer = new THREE.Vector2();
    let posture: { x: number; y: number } | null = null;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      const x = THREE.MathUtils.clamp(event.gamma / 45, -1, 1);
      const y = THREE.MathUtils.clamp(event.beta / 45, -1, 1);
      posture ??= { x, y };
      posture.x += (x - posture.x) * CONFIG.postureFollow;
      posture.y += (y - posture.y) * CONFIG.postureFollow;
      gravity.set((x - posture.x) * CONFIG.tiltGravity, -CONFIG.gravity - (y - posture.y) * CONFIG.tiltGravity * 0.5);
    };
    window.addEventListener("deviceorientation", handleOrientation);

    const yank = (yoyo: Yoyo, strength = 1) => {
      yoyo.velocity.y -= CONFIG.tug * strength * Math.sqrt(yoyo.restLength);
      yoyo.velocity.x += randomBetween(-3, 3) * strength;
      yoyo.face.dizzy = 0;
    };

    const shake = listenForShake((strength) => yoyos.forEach((yoyo) => yank(yoyo, strength)));

    const handlePointerDown = (event: PointerEvent) => {
      if (isOnInterface(event.target)) return;
      const hit = pickFace(headCentres, headRadii, camera, event.clientX, event.clientY);
      if (hit < 0) return;
      yank(yoyos[hit]);
      emojis.emit(headCentres[hit], 5, headRadii[hit] * 0.8);
      shake.requestOnTap();
    };
    window.addEventListener("pointerdown", handlePointerDown);

    const unsubscribe = onCandidateSelected(CANDIDATE_SELECTED_EVENT, (photo) => {
      yoyos.forEach((yoyo, index) => {
        if (photo && yoyo.photo !== photo) return;
        yank(yoyo, 1.4);
        emojis.emit(headCentres[index], 3, headRadii[index] * 0.8);
      });
    });

    const layout = () => {
      const half = visibleHalfSize(camera);
      const slot = (half.x * 2) / count;
      yoyos.forEach((yoyo, index) => {
        yoyo.radius = Math.min(slot * 0.85, half.y * 0.2) * randomBetween(0.85, 1.15);
        yoyo.depth = randomBetween(-2, 0);
        yoyo.anchor.set(-half.x + slot * (index + 0.5), half.y + 0.2);
        // Alternate short / long strings so faces fill the whole height, not one row.
        const band = [0.18, 0.62, 0.38, 0.82, 0.28, 0.52][index % 6];
        yoyo.restLength = half.y * 2 * band;
        yoyo.position.set(yoyo.anchor.x, yoyo.anchor.y - yoyo.restLength);
        headRadii[index] = yoyo.radius;
      });
    };

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? 14 : 12);
        camera.updateProjectionMatrix();
        layout();
      },
      update: (time, delta) => {
        const step = Math.min(delta, 1 / 30);
        pointerOnPlane(pointer, camera, lookTarget);
        lookTarget.z = 3;
        const flick = (pointer.x - previousPointer.x) * CONFIG.flick;
        previousPointer.set(pointer.x, pointer.y);
        emojis.update(step);

        yoyos.forEach((yoyo, index) => {
          // Spring-mass on a string: Hooke's law along the string, gravity (+ phone tilt), air drag.
          const offset = yoyo.position.clone().sub(yoyo.anchor);
          const length = Math.max(offset.length(), 0.001);
          const stretch = length - yoyo.restLength;
          const pull = offset.divideScalar(length).multiplyScalar(-CONFIG.stiffness * stretch);
          yoyo.velocity.addScaledVector(pull.add(gravity), step);
          yoyo.velocity.x += flick * step * 6;
          yoyo.velocity.multiplyScalar(1 - CONFIG.damping * step);
          yoyo.position.addScaledVector(yoyo.velocity, step);

          // Point the coil from the anchor to the head and stretch it to fit.
          const top = yoyo.radius * 1.02;
          direction.set(yoyo.position.x - yoyo.anchor.x, yoyo.position.y + top - yoyo.anchor.y, 0);
          const span = Math.max(direction.length(), 0.01);
          yoyo.coil.position.set(yoyo.anchor.x, yoyo.anchor.y, yoyo.depth);
          yoyo.coil.quaternion.setFromUnitVectors(up.clone().negate(), direction.normalize());
          yoyo.coil.scale.set(yoyo.radius * 0.9, span, yoyo.radius * 0.9);
          yoyo.hook.position.set(yoyo.position.x, yoyo.position.y + top, yoyo.depth);

          yoyo.head.position.set(yoyo.position.x, yoyo.position.y, yoyo.depth);
          yoyo.head.scale.setScalar(yoyo.radius);
          yoyo.head.rotation.z = -(yoyo.position.x - yoyo.anchor.x) * 0.15;

          headCentres[index].copy(yoyo.head.position);
          const wobble = Math.abs(stretch) * 0.6 + yoyo.velocity.length() * 0.05;
          updateFunnyFace(yoyo.face, time, step, wobble, lookTarget);
        });
      },
      dispose: () => {
        unsubscribe();
        shake.dispose();
        window.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("deviceorientation", handleOrientation);
      },
    };
  });

export default yoyoScene;
