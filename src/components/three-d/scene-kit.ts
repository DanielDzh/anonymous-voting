import * as THREE from "three";

/** Five-pointed star outline centred on the origin. */
export const starShape = (outer = 1, inner = 0.45, points = 5): THREE.Shape => {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
};

/** Heart outline, roughly 2 units wide, centred on the origin. */
export const heartShape = (): THREE.Shape => {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.9);
  shape.bezierCurveTo(-0.2, -0.6, -1, -0.2, -1, 0.35);
  shape.bezierCurveTo(-1, 0.85, -0.45, 1.05, 0, 0.6);
  shape.bezierCurveTo(0.45, 1.05, 1, 0.85, 1, 0.35);
  shape.bezierCurveTo(1, -0.2, 0.2, -0.6, 0, -0.9);
  return shape;
};

/** Chunky tick mark outline. */
export const checkShape = (): THREE.Shape => {
  // Outer edge from the left arm, down to the bottom vertex, up to the right tip, then back along the inner edge.
  const points: [number, number][] = [
    [-1, 0.1],
    [-0.35, -0.6],
    [1, 0.75],
    [0.68, 1.05],
    [-0.35, 0.02],
    [-0.68, 0.42],
  ];
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
};

export const extrude = (shape: THREE.Shape, depth: number, bevel: number, curveSegments = 12) => {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  });
  geometry.center();
  return geometry;
};

/** Soft, even studio light that suits matte and clay-like materials. */
export const addSoftLights = (scene: THREE.Scene, sky = 0xffffff, ground = 0xcfd2ff, intensity = 1) => {
  scene.add(new THREE.HemisphereLight(sky, ground, 1.6 * intensity));
  const key = new THREE.DirectionalLight(0xffffff, 1.8 * intensity);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6 * intensity);
  rim.position.set(-4, -2, 3);
  scene.add(rim);
};

const pointerRay = new THREE.Raycaster();
const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const pointerHit = new THREE.Vector3();

/** Projects the (eased, -1..1) pointer onto the z = 0 plane in world space. */
export const pointerOnPlane = (pointer: { x: number; y: number }, camera: THREE.Camera, target = new THREE.Vector3()) => {
  pointerRay.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), camera);
  return pointerRay.ray.intersectPlane(pointerPlane, pointerHit) ? target.copy(pointerHit) : target.set(0, 0, 0);
};

/** Half-size of the visible area on the z = 0 plane, so objects can be spread across the viewport. */
export const visibleHalfSize = (camera: THREE.PerspectiveCamera) => {
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  return { x: halfHeight * camera.aspect, y: halfHeight };
};

export const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
