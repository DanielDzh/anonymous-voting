import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { runStage } from "@/components/three-d/scene-engine";
import type { ThemeScene } from "../types";

const CONFIG = {
  /** [radius, colour, orbit radius, orbit speed, height] — a calm, product-shot arrangement. */
  spheres: [
    [1.5, 0x0071e3, 3.4, 0.12, 0.6],
    [0.9, 0xf5f5f7, 2.4, -0.18, -1.2],
    [0.6, 0x1d1d1f, 4.2, 0.09, -0.4],
    [1.1, 0xe8e8ed, 3.0, -0.1, 1.6],
    [0.45, 0xbf4800, 2.0, 0.22, 0.2],
    [0.7, 0x86b7f5, 4.6, -0.07, -1.8],
  ],
  lowPowerCount: 4,
  cameraZ: 13,
  cameraZNarrow: 18,
  offsetX: 3.6,
  offsetXNarrow: 0,
  pointerTilt: 0.35,
} as const;

/** Polished spheres slowly orbiting off to the right, like a keynote product render. */
const appleScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, renderer, pointer, isNarrow }) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const group = new THREE.Group();
    scene.add(group);
    const geometry = new THREE.SphereGeometry(1, 64, 48);
    const specs = CONFIG.spheres.slice(0, options.lowPower ? CONFIG.lowPowerCount : CONFIG.spheres.length);
    const spheres = specs.map(([radius, color, orbit, speed, height], index) => {
      const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(radius);
      group.add(mesh);
      return { mesh, orbit, speed, height, phase: (index / specs.length) * Math.PI * 2 };
    });

    return {
      resize: () => {
        const narrow = isNarrow();
        camera.position.z = narrow ? CONFIG.cameraZNarrow : CONFIG.cameraZ;
        group.position.x = narrow ? CONFIG.offsetXNarrow : CONFIG.offsetX;
      },
      update: (time) => {
        spheres.forEach(({ mesh, orbit, speed, height, phase }) => {
          const angle = phase + time * speed;
          mesh.position.set(Math.cos(angle) * orbit, height + Math.sin(time * 0.5 + phase) * 0.2, Math.sin(angle) * orbit - 2);
        });
        group.rotation.x = 0.25 - pointer.y * CONFIG.pointerTilt;
        group.rotation.y = pointer.x * CONFIG.pointerTilt;
      },
      dispose: () => {
        environment.dispose();
        pmrem.dispose();
      },
    };
  });

export default appleScene;
