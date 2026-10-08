import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { runStage } from "@/components/three-d/scene-engine";
import { addSoftLights, pointerOnPlane, randomBetween, visibleHalfSize } from "@/components/three-d/scene-kit";
import type { ThemeScene } from "../types";

const CONFIG = {
  colors: [0xb9ff66, 0xffd6e8, 0x6b5cff, 0x111111, 0xffffff, 0xb9ff66],
  count: 16,
  countLowPower: 8,
  cameraZ: 12,
  cameraZNarrow: 16,
  repelRadius: 3,
  repelStrength: 1.6,
  ease: 0.06,
} as const;

type Cube = {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  offset: THREE.Vector3;
  spin: THREE.Vector3;
  phase: number;
};

/** Chunky rounded cubes in the bento palette, slowly tumbling; the pointer shoves them aside. */
const bentoScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    addSoftLights(scene, 0xffffff, 0xf4f1ea, 1.1);
    const geometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.18);
    const materials = CONFIG.colors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
    const cubes: Cube[] = [];
    const target = new THREE.Vector3();
    const away = new THREE.Vector3();

    const layout = () => {
      const half = visibleHalfSize(camera);
      cubes.forEach((cube, index) => {
        // Spread on a loose grid so cubes never all clump in one corner.
        const columns = 4;
        const cellX = (index % columns) / (columns - 1) - 0.5;
        const cellY = Math.floor(index / columns) / Math.max(1, Math.ceil(cubes.length / columns) - 1) - 0.5;
        cube.home.set(
          cellX * half.x * 1.8 + randomBetween(-0.8, 0.8),
          cellY * half.y * 1.8 + randomBetween(-0.8, 0.8),
          randomBetween(-4, 0),
        );
      });
    };

    const count = options.lowPower ? CONFIG.countLowPower : CONFIG.count;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, materials[i % materials.length]);
      mesh.scale.setScalar(randomBetween(0.7, 1.6));
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      scene.add(mesh);
      cubes.push({
        mesh,
        home: new THREE.Vector3(),
        offset: new THREE.Vector3(),
        spin: new THREE.Vector3(randomBetween(-0.3, 0.3), randomBetween(-0.4, 0.4), 0),
        phase: Math.random() * Math.PI * 2,
      });
    }

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ);
        camera.updateProjectionMatrix();
        layout();
      },
      update: (time, delta) => {
        pointerOnPlane(pointer, camera, target);
        cubes.forEach((cube) => {
          away.copy(cube.home).sub(target).setZ(0);
          const distance = away.length();
          const push = distance < CONFIG.repelRadius ? (1 - distance / CONFIG.repelRadius) * CONFIG.repelStrength : 0;
          away.normalize().multiplyScalar(push);
          cube.offset.lerp(away, CONFIG.ease);

          cube.mesh.position.copy(cube.home).add(cube.offset);
          cube.mesh.position.y += Math.sin(time * 0.8 + cube.phase) * 0.25;
          cube.mesh.rotation.x += cube.spin.x * delta * (1 + push * 3);
          cube.mesh.rotation.y += cube.spin.y * delta * (1 + push * 3);
        });
      },
    };
  });

export default bentoScene;
