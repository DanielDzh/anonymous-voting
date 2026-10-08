import * as THREE from "three";
import { runStage } from "@/components/three-d/scene-engine";
import type { ThemeScene } from "../types";

const RED = 0xe3241b;
const BLACK = 0x111111;

const CONFIG = {
  cameraZ: 14,
  cameraZNarrow: 20,
  parallax: 1.4,
  /** The whole composition sits right of centre, leaving the headline column clear. */
  offsetX: 3.2,
  offsetXNarrow: 0.5,
} as const;

const matte = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });

/**
 * Bauhaus still life on a strict grid: red sphere, black cube, black column, a red ring and
 * hairline rules. Barely moves on its own — the camera shifts with the pointer for parallax.
 */
const swissScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-4, 6, 8);
    scene.add(key);

    const group = new THREE.Group();
    scene.add(group);

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.9, 64, 48), matte(RED));
    sphere.position.set(1.5, 1.6, -1);

    const cube = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), matte(BLACK));
    cube.position.set(-1.8, -2.2, -2);
    cube.rotation.set(0.4, 0.6, 0);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 48), matte(BLACK));
    column.position.set(4.2, -0.5, -3);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 24, 96), matte(RED));
    ring.position.set(-1.2, 2.6, -2.5);

    // Hairline rules, like a printed grid.
    const ruleMaterial = matte(BLACK);
    const rules = [-3.6, 0.2, 4].map((y) => {
      const rule = new THREE.Mesh(new THREE.BoxGeometry(30, 0.025, 0.025), ruleMaterial);
      rule.position.set(0, y, -4);
      return rule;
    });

    group.add(sphere, cube, column, ring, ...rules);

    return {
      resize: () => {
        const narrow = isNarrow();
        camera.position.z = narrow ? CONFIG.cameraZNarrow : CONFIG.cameraZ;
        group.position.x = narrow ? CONFIG.offsetXNarrow : CONFIG.offsetX;
      },
      update: (time) => {
        cube.rotation.y = 0.6 + time * 0.12;
        cube.rotation.x = 0.4 + Math.sin(time * 0.3) * 0.08;
        ring.rotation.x = time * 0.25;
        ring.rotation.y = time * 0.18;
        sphere.position.y = 1.6 + Math.sin(time * 0.6) * 0.15;
        camera.position.x = pointer.x * CONFIG.parallax;
        camera.position.y = pointer.y * CONFIG.parallax * 0.6;
        camera.lookAt(0, 0, 0);
      },
    };
  });

export default swissScene;
