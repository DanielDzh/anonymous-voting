import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { runStage } from "@/components/three-d/scene-engine";
import { addSoftLights, pointerOnPlane, randomBetween, visibleHalfSize } from "@/components/three-d/scene-kit";
import type { ThemeScene } from "../types";

const CONFIG = {
  colors: [0xffb3c7, 0xa9c7ff, 0xc5b3ff, 0xffd59e, 0xb3f0d6, 0x8f88ff],
  count: 12,
  countLowPower: 7,
  cameraZ: 12,
  cameraZNarrow: 16,
  squishRadius: 2.2,
} as const;

type Blob = { mesh: THREE.Mesh; home: THREE.Vector3; phase: number; squish: number; spin: number };

/** Soft pastel "plasticine" shapes that bob and wobble; the one under the pointer gets squished. */
const clayScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    addSoftLights(scene, 0xffffff, 0xd9dcff, 1);
    const geometries = [
      new THREE.SphereGeometry(0.8, 48, 32),
      new THREE.TorusGeometry(0.65, 0.3, 32, 64),
      new THREE.CapsuleGeometry(0.45, 0.8, 12, 24),
      new RoundedBoxGeometry(1.2, 1.2, 1.2, 6, 0.35),
      new THREE.ConeGeometry(0.75, 1.3, 48),
    ];
    // High roughness + no metalness reads as matte clay under soft light.
    const materials = CONFIG.colors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
    const blobs: Blob[] = [];
    const target = new THREE.Vector3();

    const count = options.lowPower ? CONFIG.countLowPower : CONFIG.count;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometries[i % geometries.length], materials[i % materials.length]);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      scene.add(mesh);
      blobs.push({ mesh, home: new THREE.Vector3(), phase: Math.random() * 6, squish: 0, spin: randomBetween(0.15, 0.4) });
    }

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ);
        camera.updateProjectionMatrix();
        const half = visibleHalfSize(camera);
        blobs.forEach((blob) => blob.home.set(randomBetween(-half.x, half.x) * 0.9, randomBetween(-half.y, half.y) * 0.9, randomBetween(-3, 0)));
      },
      update: (time, delta) => {
        pointerOnPlane(pointer, camera, target);
        blobs.forEach((blob) => {
          const { mesh } = blob;
          mesh.position.copy(blob.home);
          mesh.position.y += Math.sin(time * 1.1 + blob.phase) * 0.3;

          const near = mesh.position.distanceTo(target) < CONFIG.squishRadius ? 1 : 0;
          blob.squish += (near - blob.squish) * 0.08;
          // Volume-preserving wobble: wider when flatter, plus an extra press when the pointer is close.
          const wobble = Math.sin(time * 2.2 + blob.phase) * 0.05 + blob.squish * 0.28;
          mesh.scale.set(1 + wobble, 1 - wobble, 1 + wobble);
          mesh.rotation.y += blob.spin * delta;
        });
      },
    };
  });

export default clayScene;
