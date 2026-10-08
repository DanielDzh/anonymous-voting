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
  outfits: [0xff5d8f, 0x00c2a8, 0x5b6cff, 0xffb000, 0x2b2d42, 0xa66bff],
  skin: 0xffd7b5,
  grid: { phone: [3, 4], desktop: [5, 4], lowPower: [3, 3] },
  /** Damped 2D spring for the head nod. */
  stiffness: 30,
  damping: 2.4,
  flick: 9,
  tiltLean: 0.5,
  postureFollow: 0.01,
} as const;

type Doll = {
  root: THREE.Group;
  neck: THREE.Mesh;
  head: THREE.Group;
  armLeft: THREE.Mesh;
  armRight: THREE.Mesh;
  face: FunnyFace;
  photo: string | null;
  home: THREE.Vector3;
  size: number;
  angle: THREE.Vector2;
  velocity: THREE.Vector2;
  hop: number;
  phase: number;
};

/** Dashboard bobblehead dolls: tiny outfits, giant funny heads on short springs that nod at everything. */
const dollsScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    addSoftLights(scene, 0xffffff, 0xffe9d6, 1.15);
    const kit = createFaceKit();
    const textures = faceTextures(options.photos, 3);
    const emojis = createEmojiBurst(scene);

    const [columns, rows] = options.lowPower
      ? CONFIG.grid.lowPower
      : isNarrow()
        ? CONFIG.grid.phone
        : CONFIG.grid.desktop;
    const bodyGeometry = new THREE.CapsuleGeometry(0.32, 0.42, 8, 16);
    const armGeometry = new THREE.CapsuleGeometry(0.08, 0.36, 6, 10);
    const handGeometry = new THREE.SphereGeometry(0.1, 12, 10);
    const footGeometry = new THREE.SphereGeometry(0.14, 12, 10);
    const baseGeometry = new THREE.CylinderGeometry(0.5, 0.56, 0.12, 32);
    const neckGeometry = coilGeometry(0.1, 6, 0.03);
    const skin = new THREE.MeshStandardMaterial({ color: CONFIG.skin, roughness: 0.6 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.85, roughness: 0.25 });
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });

    const dolls: Doll[] = Array.from({ length: columns * rows }, (_, index) => {
      const outfit = new THREE.MeshStandardMaterial({
        color: CONFIG.outfits[index % CONFIG.outfits.length],
        roughness: 0.5,
      });
      const root = new THREE.Group();
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      const body = new THREE.Mesh(bodyGeometry, outfit);
      body.position.y = 0.55;
      const feet = [-1, 1].map((side) => {
        const foot = new THREE.Mesh(footGeometry, baseMaterial);
        foot.position.set(side * 0.16, 0.12, 0.08);
        return foot;
      });
      const arms = [-1, 1].map((side) => {
        const arm = new THREE.Mesh(armGeometry, outfit);
        arm.position.set(side * 0.38, 0.62, 0);
        const hand = new THREE.Mesh(handGeometry, skin);
        hand.position.y = -0.24;
        arm.add(hand);
        return arm;
      });
      const neck = new THREE.Mesh(neckGeometry, metal);
      neck.position.y = 0.92;
      neck.scale.y = 0.3;
      const head = new THREE.Group();
      head.position.y = 1.2;
      const face = createFunnyFace(kit, textures[index % textures.length], index);
      face.group.scale.setScalar(0.62);
      face.group.position.y = 0.55;
      head.add(face.group);
      root.add(base, body, ...feet, ...arms, neck, head);
      scene.add(root);
      return {
        root,
        neck,
        head,
        armLeft: arms[0],
        armRight: arms[1],
        face,
        photo: options.photos[index % Math.max(1, options.photos.length)] ?? null,
        home: new THREE.Vector3(),
        size: 1,
        angle: new THREE.Vector2(),
        velocity: new THREE.Vector2(randomBetween(-2, 2), randomBetween(-2, 2)),
        hop: -1,
        phase: Math.random() * 6,
      };
    });

    const headCentres = dolls.map(() => new THREE.Vector3());
    const headRadii = dolls.map(() => 1);
    const lookTarget = new THREE.Vector3();
    const previousPointer = new THREE.Vector2();
    const lean = new THREE.Vector2();
    let posture: { x: number; y: number } | null = null;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      const x = THREE.MathUtils.clamp(event.gamma / 45, -1, 1);
      const y = THREE.MathUtils.clamp(event.beta / 45, -1, 1);
      posture ??= { x, y };
      posture.x += (x - posture.x) * CONFIG.postureFollow;
      posture.y += (y - posture.y) * CONFIG.postureFollow;
      lean.set((x - posture.x) * CONFIG.tiltLean, (y - posture.y) * CONFIG.tiltLean);
    };
    window.addEventListener("deviceorientation", handleOrientation);

    const shake = listenForShake((strength) => {
      dolls.forEach((doll) => doll.velocity.set(randomBetween(-12, 12) * strength, randomBetween(-12, 12) * strength));
    });

    const handlePointerDown = (event: PointerEvent) => {
      if (isOnInterface(event.target)) return;
      const hit = pickFace(headCentres, headRadii, camera, event.clientX, event.clientY);
      if (hit < 0) return;
      const doll = dolls[hit];
      doll.face.dizzy = 0;
      doll.hop = 0;
      doll.velocity.x += randomBetween(-10, 10);
      emojis.emit(headCentres[hit], 5, headRadii[hit] * 0.7);
      shake.requestOnTap();
    };
    window.addEventListener("pointerdown", handlePointerDown);

    const unsubscribe = onCandidateSelected(CANDIDATE_SELECTED_EVENT, (photo) => {
      dolls.forEach((doll, index) => {
        if (photo && doll.photo !== photo) return;
        doll.hop = 0;
        doll.face.dizzy = 0;
        emojis.emit(headCentres[index], 3, headRadii[index] * 0.7);
      });
    });

    const layout = () => {
      const half = visibleHalfSize(camera);
      const cellWidth = (half.x * 2) / columns;
      const cellHeight = (half.y * 2) / rows;
      dolls.forEach((doll, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        doll.size = Math.min(cellWidth * 0.62, cellHeight * 0.5) * randomBetween(0.9, 1.08);
        doll.root.scale.setScalar(doll.size);
        doll.home.set(
          -half.x + cellWidth * (column + 0.5) + randomBetween(-0.12, 0.12) * cellWidth,
          half.y - cellHeight * (row + 1) + cellHeight * 0.08,
          randomBetween(-2, 0),
        );
        doll.root.position.copy(doll.home);
        headRadii[index] = doll.size * 0.62;
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
        const flickX = (pointer.x - previousPointer.x) * CONFIG.flick;
        const flickY = (pointer.y - previousPointer.y) * CONFIG.flick;
        previousPointer.set(pointer.x, pointer.y);
        emojis.update(step);

        dolls.forEach((doll, index) => {
          // Nod spring: pointer flicks kick it, phone tilt shifts where it rests.
          doll.velocity.x +=
            (flickY * 8 - CONFIG.stiffness * (doll.angle.x - lean.y) - CONFIG.damping * doll.velocity.x) * step;
          doll.velocity.y +=
            (-flickX * 8 - CONFIG.stiffness * (doll.angle.y + lean.x) - CONFIG.damping * doll.velocity.y) * step;
          doll.angle.addScaledVector(doll.velocity, step);
          doll.head.rotation.x = THREE.MathUtils.clamp(doll.angle.x, -0.75, 0.75);
          doll.head.rotation.z = THREE.MathUtils.clamp(doll.angle.y, -0.75, 0.75);
          doll.neck.rotation.copy(doll.head.rotation);
          doll.neck.rotation.x *= 0.5;
          doll.neck.rotation.z *= 0.5;

          // Little arm wave, bigger while the head is going wild.
          const excitement = Math.min(doll.velocity.length() * 0.15, 1);
          doll.armLeft.rotation.z = 0.25 + Math.sin(time * 3 + doll.phase) * (0.1 + excitement * 0.8);
          doll.armRight.rotation.z = -0.25 - Math.sin(time * 3.4 + doll.phase) * (0.1 + excitement * 0.8);

          let lift = 0;
          if (doll.hop >= 0) {
            doll.hop += step / 0.6;
            lift = Math.sin(Math.min(doll.hop, 1) * Math.PI) * 0.6;
            if (doll.hop >= 1) {
              doll.hop = -1;
              doll.velocity.x += 6;
            }
          }
          doll.root.position.set(doll.home.x, doll.home.y + lift * doll.size, doll.home.z);
          doll.root.rotation.y =
            Math.sin(time * 0.6 + doll.phase) * 0.15 + (lookTarget.x - doll.root.position.x) * 0.03;

          doll.face.group.getWorldPosition(headCentres[index]);
          updateFunnyFace(doll.face, time, step, excitement, lookTarget);
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

export default dollsScene;
