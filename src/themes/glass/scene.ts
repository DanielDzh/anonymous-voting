import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { runStage } from "@/components/three-d/scene-engine";
import { pointerOnPlane } from "@/components/three-d/scene-kit";
import type { ThemeScene } from "../types";

const CONFIG = {
  lights: [
    { color: 0xff6b9d, radius: 3.2, x: -4, y: 2.5 },
    { color: 0x7b61ff, radius: 3.6, x: 4, y: 1 },
    { color: 0x00d4ff, radius: 3, x: -1, y: -3 },
  ],
  cameraZ: 12,
  cameraZNarrow: 16,
  follow: 0.04,
} as const;

/**
 * Real refractive glass (transmission) floating over glowing colour blobs — the iOS
 * frosted look, in 3D. Weak devices get plain translucent material instead of refraction.
 */
const glassScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, renderer, pointer, isNarrow }) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    // Glowing blobs behind the glass: transmission needs something colourful to bend.
    const blobGeometry = new THREE.SphereGeometry(1, 48, 32);
    const blobs = CONFIG.lights.map(({ color, radius, x, y }, index) => {
      const mesh = new THREE.Mesh(blobGeometry, new THREE.MeshBasicMaterial({ color }));
      mesh.scale.setScalar(radius);
      mesh.position.set(x, y, -6);
      scene.add(mesh);
      return { mesh, x, y, phase: index * 2.1 };
    });

    const glass = options.lowPower
      ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.35 })
      : new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, transmission: 1, thickness: 1.2, ior: 1.4, clearcoat: 1 });

    const shapes = [
      new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.5, 48, 96), glass),
      new THREE.Mesh(new RoundedBoxGeometry(2.2, 2.2, 0.6, 6, 0.28), glass),
      new THREE.Mesh(new THREE.SphereGeometry(1.1, 64, 48), glass),
    ];
    const homes = [new THREE.Vector3(-3.2, 1.2, 0), new THREE.Vector3(3.4, -0.8, 0.5), new THREE.Vector3(0.6, 2.6, -1)];
    shapes.forEach((shape, index) => {
      shape.position.copy(homes[index]);
      scene.add(shape);
    });

    const target = new THREE.Vector3();
    const lean = new THREE.Vector3();

    return {
      resize: () => {
        camera.position.z = isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ;
      },
      update: (time, delta) => {
        blobs.forEach(({ mesh, x, y, phase }) => {
          mesh.position.x = x + Math.sin(time * 0.3 + phase) * 1.5;
          mesh.position.y = y + Math.cos(time * 0.25 + phase) * 1.2;
        });
        pointerOnPlane(pointer, camera, target);
        shapes.forEach((shape, index) => {
          // Each shape leans a little toward the pointer, like it's being looked through.
          lean.copy(target).sub(homes[index]).multiplyScalar(0.12);
          shape.position.lerp(lean.add(homes[index]), CONFIG.follow);
          shape.position.y += Math.sin(time * 0.8 + index * 2) * 0.004;
          shape.rotation.x += delta * (0.15 + index * 0.05);
          shape.rotation.y += delta * (0.2 + index * 0.04);
        });
      },
      dispose: () => {
        environment.dispose();
        pmrem.dispose();
      },
    };
  });

export default glassScene;
