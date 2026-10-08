import * as THREE from "three";
import { burstTexture, faceTextures, onCandidateSelected } from "@/components/three-d/photo-kit";
import { runStage } from "@/components/three-d/scene-engine";
import { randomBetween, visibleHalfSize } from "@/components/three-d/scene-kit";
import { CANDIDATE_SELECTED_EVENT } from "@/config/visuals";
import type { ThemeScene } from "../types";

const CONFIG = {
  words: ["БАМ!", "ВАУ!", "ПОВ!", "ОГО!", "ХЕЙ!", "ТАК!"],
  palette: [
    { fill: "#ffd23f", text: "#e63946" },
    { fill: "#e63946", text: "#ffffff" },
    { fill: "#3ec1d3", text: "#ffd23f" },
    { fill: "#ffffff", text: "#111111" },
  ],
  /** Total photo panels on screen — lots of faces, fewer on phones and weak devices. */
  panels: { phone: 10, desktop: 16, lowPower: 6 },
  cameraZ: 12,
  cameraZNarrow: 16,
  popSeconds: 0.9,
} as const;

type Floater = { object: THREE.Object3D; home: THREE.Vector3; spin: number; phase: number };

/** Comic panels with the candidates' photos and flying "БАМ!" bursts; picking someone fires a giant POW. */
const comicScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer, isNarrow }) => {
    const floaters: Floater[] = [];
    const flat = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true });

    const burstGeometry = new THREE.PlaneGeometry(2.6, 2.6);
    CONFIG.words.forEach((word, index) => {
      const mesh = new THREE.Mesh(burstGeometry, flat(burstTexture(word, CONFIG.palette[index % CONFIG.palette.length])));
      mesh.scale.setScalar(randomBetween(0.7, 1.2));
      scene.add(mesh);
      floaters.push({ object: mesh, home: new THREE.Vector3(), spin: randomBetween(-0.4, 0.4), phase: Math.random() * 6 });
    });

    // Photo panels: thick black frame plus an offset "printed" shadow, like a comic cell.
    const frameGeometry = new THREE.PlaneGeometry(2.3, 2.3);
    const photoGeometry = new THREE.PlaneGeometry(2, 2);
    const ink = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const textures = faceTextures(options.photos);
    const panelCount = options.lowPower ? CONFIG.panels.lowPower : isNarrow() ? CONFIG.panels.phone : CONFIG.panels.desktop;
    for (let i = 0; i < panelCount; i++) {
      const panel = new THREE.Group();
      const shadow = new THREE.Mesh(frameGeometry, ink);
      shadow.position.set(0.18, -0.18, -0.02);
      const frame = new THREE.Mesh(frameGeometry, ink);
      const photo = new THREE.Mesh(photoGeometry, new THREE.MeshBasicMaterial({ map: textures[i % textures.length] }));
      photo.position.z = 0.01;
      panel.add(shadow, frame, photo);
      panel.scale.setScalar(randomBetween(0.45, 0.75));
      scene.add(panel);
      floaters.push({ object: panel, home: new THREE.Vector3(), spin: randomBetween(-0.15, 0.15), phase: Math.random() * 6 });
    }

    // The big one, reserved for when a voter picks someone.
    const pow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), flat(burstTexture("БАМ!", CONFIG.palette[1])));
    pow.position.set(0, 0, 1.5);
    pow.visible = false;
    scene.add(pow);
    let popTime = -1;
    const unsubscribe = onCandidateSelected(CANDIDATE_SELECTED_EVENT, () => {
      popTime = 0;
      pow.visible = true;
    });

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ);
        camera.updateProjectionMatrix();
        const half = visibleHalfSize(camera);
        floaters.forEach((floater) => floater.home.set(randomBetween(-half.x, half.x) * 0.9, randomBetween(-half.y, half.y) * 0.85, randomBetween(-3, -0.5)));
      },
      update: (time, delta) => {
        floaters.forEach((floater) => {
          floater.object.position.set(floater.home.x, floater.home.y + Math.sin(time * 1.3 + floater.phase) * 0.25, floater.home.z);
          floater.object.rotation.z = Math.sin(time * 0.9 + floater.phase) * 0.18 + floater.spin;
          floater.object.rotation.y = pointer.x * 0.4;
          floater.object.rotation.x = -pointer.y * 0.3;
        });

        if (popTime >= 0) {
          popTime += delta / CONFIG.popSeconds;
          // Overshooting pop, quick hold, then shrink away.
          const grow = popTime < 0.35 ? THREE.MathUtils.smoothstep(popTime / 0.35, 0, 1) * 1.15 : 1.15 - Math.max(0, popTime - 0.6) * 2.9;
          pow.scale.setScalar(Math.max(0.001, grow));
          pow.rotation.z = (1 - Math.min(popTime * 2, 1)) * 0.6;
          if (popTime >= 1) {
            popTime = -1;
            pow.visible = false;
          }
        }
      },
      dispose: unsubscribe,
    };
  });

export default comicScene;
