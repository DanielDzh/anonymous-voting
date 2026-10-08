import * as THREE from "three";
import { faceTextures } from "@/components/three-d/photo-kit";
import { runStage } from "@/components/three-d/scene-engine";
import { addSoftLights, pointerOnPlane, randomBetween, visibleHalfSize } from "@/components/three-d/scene-kit";
import type { ThemeScene } from "../types";

const CONFIG = {
  /** Total stickers on screen — lots of faces, fewer on phones and weak devices. */
  stickers: { phone: 12, desktop: 18, lowPower: 7 },
  cameraZ: 12,
  cameraZNarrow: 16,
  /** Eyes sit in the upper half of the sticker: where a face usually is in a centred photo. */
  eyeOffset: new THREE.Vector2(0.32, 0.22),
  pupilTravel: 0.1,
  crownEvery: 2,
} as const;

type Sticker = {
  group: THREE.Group;
  pupils: THREE.Mesh[];
  home: THREE.Vector3;
  spin: number;
  phase: number;
};

const goldCrown = (material: THREE.Material) => {
  const crown = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 24, 1, true), material);
  crown.add(band);
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 8), material);
    const angle = (i / 5) * Math.PI * 2;
    spike.position.set(Math.cos(angle) * 0.4, 0.26, Math.sin(angle) * 0.4);
    crown.add(spike);
  }
  return crown;
};

/** Candidate photos as die-cut stickers with googly eyes that follow the pointer; some wear crowns. */
const memeScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    addSoftLights(scene, 0xffffff, 0xf0f0f0, 1.1);
    const textures = faceTextures(options.photos);

    const borderGeometry = new THREE.CircleGeometry(1.14, 48);
    const photoGeometry = new THREE.CircleGeometry(1, 48);
    const eyeGeometry = new THREE.SphereGeometry(0.2, 24, 16);
    const pupilGeometry = new THREE.SphereGeometry(0.09, 16, 12);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.7, roughness: 0.25 });
    const photoMaterials = textures.map((map) => new THREE.MeshBasicMaterial({ map }));

    const stickers: Sticker[] = [];
    const count = options.lowPower ? CONFIG.stickers.lowPower : isNarrow() ? CONFIG.stickers.phone : CONFIG.stickers.desktop;
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const border = new THREE.Mesh(borderGeometry, white);
      const photo = new THREE.Mesh(photoGeometry, photoMaterials[i % photoMaterials.length]);
      photo.position.z = 0.01;
      group.add(border, photo);

      const pupils = [-1, 1].map((side) => {
        const eye = new THREE.Mesh(eyeGeometry, white);
        eye.scale.z = 0.45;
        eye.position.set(side * CONFIG.eyeOffset.x, CONFIG.eyeOffset.y, 0.08);
        const pupil = new THREE.Mesh(pupilGeometry, black);
        pupil.position.set(eye.position.x, eye.position.y, 0.17);
        group.add(eye, pupil);
        return pupil;
      });

      if (i % CONFIG.crownEvery === 0) {
        const crown = goldCrown(gold);
        crown.position.set(0, 1.18, 0);
        crown.rotation.z = randomBetween(-0.25, 0.25);
        group.add(crown);
      }

      group.scale.setScalar(randomBetween(0.5, 0.8));
      scene.add(group);
      stickers.push({ group, pupils, home: new THREE.Vector3(), spin: randomBetween(0.2, 0.5), phase: Math.random() * 6 });
    }

    const target = new THREE.Vector3();
    const local = new THREE.Vector3();

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ);
        camera.updateProjectionMatrix();
        const half = visibleHalfSize(camera);
        stickers.forEach((sticker) => sticker.home.set(randomBetween(-half.x, half.x) * 0.88, randomBetween(-half.y, half.y) * 0.8, randomBetween(-3, -0.5)));
      },
      update: (time) => {
        pointerOnPlane(pointer, camera, target);
        stickers.forEach((sticker) => {
          const { group } = sticker;
          group.position.set(sticker.home.x, sticker.home.y + Math.sin(time * 1.1 + sticker.phase) * 0.3, sticker.home.z);
          // A slow wobble like a sticker caught in a draft — never a full flip, so the face stays visible.
          group.rotation.y = Math.sin(time * sticker.spin + sticker.phase) * 0.55;
          group.rotation.z = Math.sin(time * 0.7 + sticker.phase) * 0.2;
          group.updateMatrixWorld();

          // Googly pupils roll toward the pointer, computed in the sticker's own space.
          local.copy(target);
          group.worldToLocal(local);
          sticker.pupils.forEach((pupil, index) => {
            const eyeX = (index === 0 ? -1 : 1) * CONFIG.eyeOffset.x;
            const dx = local.x - eyeX;
            const dy = local.y - CONFIG.eyeOffset.y;
            const length = Math.hypot(dx, dy) || 1;
            pupil.position.x = eyeX + (dx / length) * CONFIG.pupilTravel;
            pupil.position.y = CONFIG.eyeOffset.y + (dy / length) * CONFIG.pupilTravel;
          });
        });
      },
    };
  });

export default memeScene;
