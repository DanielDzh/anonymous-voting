import * as THREE from "three";
import { runStage } from "@/components/three-d/scene-engine";
import type { ThemeScene } from "../types";

const CONFIG = {
  sphereRadius: 2.2,
  spherePoints: 4200,
  spherePointsLowPower: 1800,
  ringRadius: 3.1,
  ringPoints: 900,
  ringTilt: 1.15,
  pointSize: 46,
  spinSpeed: 0.06,
  pointerTurn: 0.55,
  cameraZ: 7,
  cameraZNarrow: 9.5,
  /** Sphere sits a little low so the title floats over its upper half. */
  offsetY: -0.9,
} as const;

const VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uRadius;
  uniform float uWave;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Slow breathing ripple travelling down the sphere.
    float ripple = sin(uTime * 0.9 + position.y * 2.6 + aSeed * 2.0) * uWave;
    vec3 p = position * (1.0 + ripple);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aSeed * 6.2831);
    gl_PointSize = uSize * uPixelRatio * twinkle / -mv.z;

    // Points on the far side fade out, giving the sphere real depth.
    vec3 worldNormal = normalize(mat3(modelMatrix) * position);
    vAlpha = mix(0.08, 1.0, smoothstep(-0.7, 0.9, worldNormal.z)) * (0.5 + 0.5 * twinkle);
    vColor = mix(vec3(0.45, 0.44, 0.95), vec3(1.0), smoothstep(-0.3, 1.0, position.y / uRadius));
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, glow * glow * vAlpha);
  }
`;

/** Evenly spread points on a sphere (golden-angle spiral). */
const fibonacciSphere = (count: number, radius: number) => {
  const positions = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    positions.set([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius], i * 3);
  }
  return positions;
};

const ringPositions = (count: number, radius: number) => {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const spread = radius + (Math.random() - 0.5) * 0.35;
    positions.set([Math.cos(angle) * spread, (Math.random() - 0.5) * 0.06, Math.sin(angle) * spread], i * 3);
  }
  return positions;
};

const seeds = (count: number) => Float32Array.from({ length: count }, () => Math.random());

const createPoints = (positions: Float32Array, uniforms: Record<string, THREE.IUniform>) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds(positions.length / 3), 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
};

const linearScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, renderer, pointer, isNarrow }) => {
    const pixelRatio = { value: renderer.getPixelRatio() };
    const time = { value: 0 };

    const sphere = createPoints(
      fibonacciSphere(options.lowPower ? CONFIG.spherePointsLowPower : CONFIG.spherePoints, CONFIG.sphereRadius),
      { uTime: time, uSize: { value: CONFIG.pointSize }, uPixelRatio: pixelRatio, uRadius: { value: CONFIG.sphereRadius }, uWave: { value: 0.025 } },
    );
    const ring = createPoints(ringPositions(CONFIG.ringPoints, CONFIG.ringRadius), {
      uTime: time,
      uSize: { value: CONFIG.pointSize * 0.8 },
      uPixelRatio: pixelRatio,
      uRadius: { value: CONFIG.ringRadius },
      uWave: { value: 0 },
    });
    ring.rotation.x = CONFIG.ringTilt;

    const group = new THREE.Group();
    group.add(sphere, ring);
    group.position.y = CONFIG.offsetY;
    scene.add(group);

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ);
        pixelRatio.value = renderer.getPixelRatio();
      },
      update: (elapsed) => {
        time.value = elapsed;
        sphere.rotation.y = elapsed * CONFIG.spinSpeed + pointer.x * CONFIG.pointerTurn;
        sphere.rotation.x = -pointer.y * CONFIG.pointerTurn * 0.5;
        ring.rotation.z = elapsed * CONFIG.spinSpeed * 1.6;
        group.rotation.y = pointer.x * 0.15;
        group.rotation.x = -pointer.y * 0.1;
      },
    };
  });

export default linearScene;
