import * as THREE from "three";
import { runStage } from "@/components/three-d/scene-engine";
import type { ThemeScene } from "../types";

const CONFIG = {
  segments: 160,
  segmentsLowPower: 64,
  cameraZ: 10,
  /** The wave is tilted like Stripe's signature skewed band. */
  tilt: -0.14,
  pointerBend: 0.6,
} as const;

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uBend;
  varying vec2 vUv;
  varying float vHeight;

  // Cheap layered sine "noise" — smooth enough for a silky surface, no texture lookups.
  float waves(vec2 p, float t) {
    return sin(p.x * 0.6 + t * 0.7) * 0.6
         + sin(p.y * 0.9 - t * 0.5 + p.x * 0.3) * 0.45
         + sin((p.x + p.y) * 1.4 + t * 1.1) * 0.18;
  }

  void main() {
    vUv = uv;
    vec3 p = position;
    float h = waves(p.xy, uTime);
    // A soft bulge that follows the pointer.
    h += uBend * exp(-dot(p.xy - uPointer, p.xy - uPointer) * 0.08);
    p.z += h;
    vHeight = h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    // Stripe palette blended along a slowly drifting diagonal.
    vec3 pink = vec3(1.0, 0.5, 0.71);
    vec3 violet = vec3(0.56, 0.54, 0.99);
    vec3 cyan = vec3(0.0, 0.83, 1.0);
    vec3 amber = vec3(1.0, 0.8, 0.34);
    float t = fract(vUv.x * 0.8 + vUv.y * 0.5 + uTime * 0.03);
    vec3 col = t < 0.33 ? mix(pink, violet, t / 0.33)
             : t < 0.66 ? mix(violet, cyan, (t - 0.33) / 0.33)
             : mix(cyan, amber, (t - 0.66) / 0.34);
    col = mix(col, vec3(1.0), smoothstep(0.6, 1.4, vHeight) * 0.35); // crests catch the light
    col *= 0.88 + 0.12 * smoothstep(-1.0, 1.0, vHeight);              // troughs fall into shade
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** A silky gradient ribbon that ripples on its own and swells under the pointer. */
const stripeScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, pointer }) => {
    const segments = options.lowPower ? CONFIG.segmentsLowPower : CONFIG.segments;
    const uniforms = {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uBend: { value: CONFIG.pointerBend },
    };
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 14, segments, Math.round(segments / 3)),
      new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms }),
    );
    plane.rotation.set(-0.5, 0, CONFIG.tilt);
    plane.position.set(0, 2.2, -2);
    scene.add(plane);

    return {
      resize: () => {
        camera.position.set(0, 0, CONFIG.cameraZ);
      },
      update: (time) => {
        uniforms.uTime.value = time;
        uniforms.uPointer.value.set(pointer.x * 12, pointer.y * 5);
      },
    };
  });

export default stripeScene;
