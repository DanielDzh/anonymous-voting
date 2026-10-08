import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { runStage } from "@/components/three-d/scene-engine";
import { extrude, heartShape, pointerOnPlane, randomBetween, starShape, visibleHalfSize } from "@/components/three-d/scene-kit";
import type { ThemeScene } from "../types";

const CONFIG = {
  colors: [0xff8bd1, 0x7d84ff, 0xfff27a, 0xffffff, 0xff3db4],
  count: 22,
  countLowPower: 10,
  cameraZ: 12,
  cameraZNarrow: 15,
  riseSpeed: 0.35,
  pointerRadius: 3,
} as const;

type Floater = { mesh: THREE.Mesh; speed: number; spin: number; sway: number; phase: number };

/** Iridescent chrome stars, hearts and bubbles drifting upward, spinning faster near the pointer. */
const y2kScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, renderer, pointer, isNarrow }) => {
    // A soft room reflection is what makes iridescent surfaces read as shiny plastic-chrome.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const geometries = [
      extrude(starShape(0.9, 0.42), 0.28, 0.12),
      extrude(heartShape(), 0.3, 0.14),
      new THREE.SphereGeometry(0.75, 32, 24),
    ];
    const materials = CONFIG.colors.map(
      (color) =>
        new THREE.MeshPhysicalMaterial({
          color,
          metalness: 0.25,
          roughness: 0.12,
          iridescence: 1,
          iridescenceIOR: 1.7,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
        }),
    );
    const bubbleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      iridescence: 1,
      iridescenceIOR: 1.3,
      transparent: true,
      opacity: 0.45,
    });

    const floaters: Floater[] = [];
    const target = new THREE.Vector3();
    let half = { x: 8, y: 5 };

    const count = options.lowPower ? CONFIG.countLowPower : CONFIG.count;
    for (let i = 0; i < count; i++) {
      const kind = i % geometries.length;
      const mesh = new THREE.Mesh(geometries[kind], kind === 2 ? bubbleMaterial : materials[i % materials.length]);
      mesh.scale.setScalar(randomBetween(0.6, 1.4));
      mesh.position.set(randomBetween(-8, 8), randomBetween(-6, 6), randomBetween(-5, 0));
      scene.add(mesh);
      floaters.push({ mesh, speed: randomBetween(0.6, 1.4), spin: randomBetween(0.3, 0.9), sway: randomBetween(0.2, 0.6), phase: Math.random() * 6 });
    }

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ);
        camera.updateProjectionMatrix();
        half = visibleHalfSize(camera);
        floaters.forEach(({ mesh }) => (mesh.position.x = randomBetween(-half.x, half.x)));
      },
      update: (time, delta) => {
        pointerOnPlane(pointer, camera, target);
        floaters.forEach((floater) => {
          const { mesh } = floater;
          mesh.position.y += CONFIG.riseSpeed * floater.speed * delta;
          mesh.position.x += Math.sin(time * floater.sway + floater.phase) * delta * 0.3;
          // Recycle below the screen once a floater leaves the top.
          if (mesh.position.y > half.y + 2) {
            mesh.position.y = -half.y - 2;
            mesh.position.x = randomBetween(-half.x, half.x);
          }
          const near = Math.max(0, 1 - mesh.position.distanceTo(target) / CONFIG.pointerRadius);
          mesh.rotation.y += floater.spin * delta * (1 + near * 6);
          mesh.rotation.x = Math.sin(time * 0.5 + floater.phase) * 0.4;
        });
      },
      dispose: () => {
        environment.dispose();
        pmrem.dispose();
      },
    };
  });

export default y2kScene;
