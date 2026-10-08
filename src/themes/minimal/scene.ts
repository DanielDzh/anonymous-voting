import * as THREE from "three";
import { runStage } from "@/components/three-d/scene-engine";
import type { ThemeScene } from "../types";

const INK = 0x1c1b19;

const CONFIG = {
  radius: 3.4,
  cameraZ: 13,
  cameraZNarrow: 18,
  offsetX: 4.2,
  offsetY: -0.6,
  spin: 0.05,
  pointerTurn: 0.5,
} as const;

/**
 * One quiet object: a hairline icosahedron with a concentric inner shell and a single
 * orbiting dot. Turns slowly, leans toward the pointer. Nothing else.
 */
const minimalScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    const group = new THREE.Group();
    scene.add(group);

    const outer = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(CONFIG.radius, 1)),
      new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 }),
    );
    const inner = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(CONFIG.radius * 0.55, 0)),
      new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.3 }),
    );
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: INK }));
    group.add(outer, inner, dot);

    return {
      resize: () => {
        const narrow = isNarrow();
        camera.position.z = narrow ? CONFIG.cameraZNarrow : CONFIG.cameraZ;
        group.position.set(narrow ? 0 : CONFIG.offsetX, narrow ? -3 : CONFIG.offsetY, 0);
      },
      update: (time) => {
        outer.rotation.y = time * CONFIG.spin + pointer.x * CONFIG.pointerTurn;
        outer.rotation.x = -pointer.y * CONFIG.pointerTurn * 0.6;
        inner.rotation.y = -time * CONFIG.spin * 1.6;
        inner.rotation.z = time * CONFIG.spin;
        const angle = time * 0.4;
        dot.position.set(Math.cos(angle) * CONFIG.radius * 1.15, Math.sin(angle * 0.7) * 0.6, Math.sin(angle) * CONFIG.radius * 1.15);
      },
    };
  });

export default minimalScene;
