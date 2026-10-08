import * as THREE from "three";
import { runStage } from "@/components/three-d/scene-engine";
import { addSoftLights, checkShape, extrude, pointerOnPlane, randomBetween, starShape, visibleHalfSize } from "@/components/three-d/scene-kit";
import type { ThemeScene } from "../types";

const CONFIG = {
  colors: [0x58cc02, 0x1cb0f6, 0xffc800, 0xff4b4b, 0xce82ff],
  count: 14,
  countLowPower: 8,
  cameraZ: 12,
  cameraZNarrow: 16,
  bounceHeight: 0.9,
  excitedRadius: 2.6,
} as const;

type Hopper = { mesh: THREE.Mesh; home: THREE.Vector3; size: number; speed: number; phase: number; excitement: number };

/** Chunky low-poly stars, ticks and gems hopping like happy mascots; they jump higher near the pointer. */
const duoScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    addSoftLights(scene, 0xffffff, 0xe8f7ff, 1.1);
    const geometries = [
      extrude(starShape(0.9, 0.48), 0.35, 0.08, 1),
      extrude(checkShape(), 0.35, 0.08, 1),
      new THREE.IcosahedronGeometry(0.7, 0),
    ];
    const materials = CONFIG.colors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, flatShading: true }));
    const hoppers: Hopper[] = [];
    const target = new THREE.Vector3();

    const count = options.lowPower ? CONFIG.countLowPower : CONFIG.count;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometries[i % geometries.length], materials[i % materials.length]);
      scene.add(mesh);
      hoppers.push({ mesh, home: new THREE.Vector3(), size: randomBetween(0.7, 1.3), speed: randomBetween(1.6, 2.6), phase: Math.random() * 6, excitement: 0 });
    }

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ);
        camera.updateProjectionMatrix();
        const half = visibleHalfSize(camera);
        hoppers.forEach((hopper) => hopper.home.set(randomBetween(-half.x, half.x) * 0.92, randomBetween(-half.y, half.y) * 0.85, randomBetween(-3, 0)));
      },
      update: (time) => {
        pointerOnPlane(pointer, camera, target);
        hoppers.forEach((hopper) => {
          const { mesh, home, size } = hopper;
          const near = home.distanceTo(target) < CONFIG.excitedRadius ? 1 : 0;
          hopper.excitement += (near - hopper.excitement) * 0.06;

          // |sin| gives a ball-like bounce; squash on landing, stretch at take-off.
          const cycle = Math.sin(time * hopper.speed * (1 + hopper.excitement * 0.6) + hopper.phase);
          const hop = Math.abs(cycle);
          const height = CONFIG.bounceHeight * (1 + hopper.excitement * 1.5);
          mesh.position.set(home.x, home.y + hop * height, home.z);
          const squash = hop < 0.15 ? (0.15 - hop) * 1.6 : 0;
          mesh.scale.set(size * (1 + squash), size * (1 - squash), size * (1 + squash));
          mesh.rotation.y = Math.sin(time * 0.8 + hopper.phase) * 0.6;
          mesh.rotation.z = cycle * 0.15;
        });
      },
    };
  });

export default duoScene;
