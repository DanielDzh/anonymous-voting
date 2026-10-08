import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { faceTextures, onCandidateSelected } from "@/components/three-d/photo-kit";
import { runStage } from "@/components/three-d/scene-engine";
import { extrude, heartShape, randomBetween, visibleHalfSize } from "@/components/three-d/scene-kit";
import { CANDIDATE_SELECTED_EVENT } from "@/config/visuals";
import type { ThemeScene } from "../types";

const CONFIG = {
  tints: [0xffffff, 0xfff1f6, 0xeafffb, 0xfff8e1],
  /** Lots of jellies; fewer on phones and weak devices. */
  balls: { phone: 10, desktop: 16, lowPower: 6 },
  cameraZ: 12,
  cameraZNarrow: 14,
  /** Zero-g "aquarium": jellies drift everywhere so they're visible and reachable around the UI. */
  wander: 1.4,
  /** Tilting the phone away from how it's being held pulls them that way. */
  tiltGravity: 16,
  /** How fast the "neutral" phone posture follows the current one (per orientation event). */
  postureFollow: 0.01,
  restitution: 0.72,
  airDrag: 0.6,
  /** Jelly wobble spring (squash & stretch). */
  wobbleStiffness: 190,
  wobbleDamping: 9,
  tapJump: 9,
  shockwave: 14,
  hearts: 28,
  heartSeconds: 1.3,
  /** Planar photo projection covers this fraction of the ball's front. */
  facePrint: 0.55,
} as const;

type Ball = {
  mesh: THREE.Mesh;
  photo: string | null;
  radius: number;
  mass: number;
  position: THREE.Vector2;
  velocity: THREE.Vector2;
  /** Compression along x / y (0 = round) and their spring velocities. */
  squash: THREE.Vector2;
  squashVelocity: THREE.Vector2;
  spin: number;
  celebrate: number;
};

type Heart = { mesh: THREE.Mesh; velocity: THREE.Vector3; age: number };

type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

/** Sphere whose UVs project the photo straight onto its front, like a print on a ball. */
const printedSphere = () => {
  const geometry = new THREE.SphereGeometry(1, 48, 32);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getX(i) * CONFIG.facePrint + 0.5, position.getY(i) * CONFIG.facePrint + 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
};

/** Pointer taps on real UI (cards, buttons, inputs) must never poke the jellies behind them. */
const isOnInterface = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest("button, a, input, textarea, label, select, .panel, .candidate"));

/**
 * Jelly heads: candidates as glossy jelly balls with their photo printed on the front.
 * They drift in zero-g, bump into each other and squash; tilt the phone and they roll, tap one and it hops
 * and sheds hearts, tap empty space for a shockwave, drag one with a mouse to throw it.
 */
const bobbleScene: ThemeScene = (canvas, options) =>
  runStage(canvas, options, ({ scene, camera, renderer, pointer, isNarrow }) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffe9a8, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 4, 6);
    scene.add(key);

    const textures = faceTextures(options.photos);
    const geometry = printedSphere();
    const ballCount = options.lowPower ? CONFIG.balls.lowPower : isNarrow() ? CONFIG.balls.phone : CONFIG.balls.desktop;

    const balls: Ball[] = Array.from({ length: ballCount }, (_, index) => {
      const textureIndex = index % textures.length;
      const material = options.lowPower
        ? new THREE.MeshStandardMaterial({ map: textures[textureIndex], roughness: 0.35 })
        : new THREE.MeshPhysicalMaterial({
            map: textures[textureIndex],
            color: CONFIG.tints[index % CONFIG.tints.length],
            roughness: 0.32,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            sheen: 0.4,
            sheenColor: new THREE.Color(0xffd6ec),
          });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      return {
        mesh,
        photo: options.photos[textureIndex] ?? null,
        radius: 1,
        mass: 1,
        position: new THREE.Vector2(),
        velocity: new THREE.Vector2(randomBetween(-3, 3), randomBetween(-1, 3)),
        squash: new THREE.Vector2(),
        squashVelocity: new THREE.Vector2(),
        spin: 0,
        celebrate: 0,
      };
    });

    // Heart particles, pooled.
    const heartGeometry = extrude(heartShape(), 0.25, 0.06);
    const heartMaterial = new THREE.MeshStandardMaterial({ color: 0xff5d8f, roughness: 0.3, emissive: 0x5a0020 });
    const hearts: Heart[] = Array.from({ length: CONFIG.hearts }, () => {
      const mesh = new THREE.Mesh(heartGeometry, heartMaterial);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, velocity: new THREE.Vector3(), age: -1 };
    });
    const emitHearts = (at: THREE.Vector2, amount: number) => {
      let emitted = 0;
      hearts.forEach((heart) => {
        if (heart.age >= 0 || emitted >= amount) return;
        emitted++;
        heart.age = 0;
        heart.mesh.visible = true;
        heart.mesh.position.set(at.x, at.y, 0.4);
        heart.velocity.set(randomBetween(-3, 3), randomBetween(3, 7), randomBetween(0, 2));
      });
    };

    let half = { x: 6, y: 4 };
    const gravity = new THREE.Vector2();
    let posture: { sideways: number; forward: number } | null = null;
    const toWorld = (clientX: number, clientY: number) =>
      new THREE.Vector2(((clientX / window.innerWidth) * 2 - 1) * half.x, -((clientY / window.innerHeight) * 2 - 1) * half.y);
    const ballAt = (point: THREE.Vector2) => balls.find((ball) => ball.position.distanceTo(point) < ball.radius * 1.1);

    const hop = (ball: Ball, strength: number = CONFIG.tapJump) => {
      ball.velocity.y += strength;
      ball.velocity.x += randomBetween(-2, 2);
      ball.spin += randomBetween(-1, 1) > 0 ? Math.PI * 2 : -Math.PI * 2;
      ball.squashVelocity.y -= 6;
      emitHearts(ball.position, 4);
    };

    // ── Phone tilt → gravity, relative to how the phone is normally held (people hold it tilted
    // toward them, so absolute tilt would always drag everything down). The neutral posture slowly
    // follows the current one. Android sends events freely; iOS needs a permission asked from a tap.
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      const sideways = THREE.MathUtils.clamp(event.gamma / 45, -1, 1);
      const forward = THREE.MathUtils.clamp(event.beta / 45, -1, 1);
      posture ??= { sideways, forward };
      posture.sideways += (sideways - posture.sideways) * CONFIG.postureFollow;
      posture.forward += (forward - posture.forward) * CONFIG.postureFollow;
      gravity.set((sideways - posture.sideways) * CONFIG.tiltGravity, -(forward - posture.forward) * CONFIG.tiltGravity);
    };
    window.addEventListener("deviceorientation", handleOrientation);
    const orientationApi = (window.DeviceOrientationEvent as unknown as OrientationPermission | undefined) ?? {};
    let permissionAsked = false;

    // ── Pointer: tap a ball → hop; tap empty space → shockwave; mouse drag → grab and throw.
    let grabbed: Ball | null = null;
    const grabTarget = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      if (isOnInterface(event.target)) return;
      const point = toWorld(event.clientX, event.clientY);
      const hit = ballAt(point);
      if (hit) {
        hop(hit);
        if (event.pointerType === "mouse") {
          grabbed = hit;
          grabTarget.copy(point);
        }
        return;
      }
      balls.forEach((ball) => {
        const away = ball.position.clone().sub(point);
        const distance = Math.max(away.length(), 0.5);
        ball.velocity.add(away.normalize().multiplyScalar(CONFIG.shockwave / distance));
      });
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (grabbed) grabTarget.copy(toWorld(event.clientX, event.clientY));
    };
    const handlePointerUp = () => {
      grabbed = null;
    };
    // iOS motion permission: only on a click that actually landed on a jelly — clear intent to play.
    const handleClick = (event: MouseEvent) => {
      if (permissionAsked || !orientationApi.requestPermission || isOnInterface(event.target)) return;
      if (!ballAt(toWorld(event.clientX, event.clientY))) return;
      permissionAsked = true;
      orientationApi.requestPermission().catch(() => undefined);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("click", handleClick);

    const unsubscribe = onCandidateSelected(CANDIDATE_SELECTED_EVENT, (photo) => {
      balls.forEach((ball) => {
        if (photo && ball.photo !== photo) return;
        ball.celebrate = 1;
        hop(ball, CONFIG.tapJump * 1.2);
      });
    });

    const normal = new THREE.Vector2();
    const relative = new THREE.Vector2();
    const lookTarget = new THREE.Vector2();

    const collideWalls = (ball: Ball) => {
      const limitX = half.x - ball.radius;
      const limitY = half.y - ball.radius;
      // Bounce only when moving outward, otherwise a ball pushed into a wall would jitter.
      if (Math.abs(ball.position.x) > limitX) {
        ball.position.x = Math.sign(ball.position.x) * limitX;
        if (Math.sign(ball.velocity.x) === Math.sign(ball.position.x)) {
          ball.squashVelocity.x += Math.abs(ball.velocity.x) * 0.5;
          ball.velocity.x *= -CONFIG.restitution;
        }
      }
      if (Math.abs(ball.position.y) > limitY) {
        ball.position.y = Math.sign(ball.position.y) * limitY;
        if (Math.sign(ball.velocity.y) === Math.sign(ball.position.y)) {
          ball.squashVelocity.y += Math.abs(ball.velocity.y) * 0.5;
          ball.velocity.y *= -CONFIG.restitution;
        }
      }
    };

    const collideBalls = () => {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const b = balls[j];
          normal.copy(b.position).sub(a.position);
          const distance = normal.length();
          const overlap = a.radius + b.radius - distance;
          if (overlap <= 0 || distance === 0) continue;
          normal.divideScalar(distance);
          // Separate in proportion to mass, then exchange momentum along the contact normal.
          const total = a.mass + b.mass;
          a.position.addScaledVector(normal, (-overlap * b.mass) / total);
          b.position.addScaledVector(normal, (overlap * a.mass) / total);
          const approach = relative.copy(b.velocity).sub(a.velocity).dot(normal);
          if (approach >= 0) continue;
          const impulse = (-(1 + CONFIG.restitution) * approach) / total;
          a.velocity.addScaledVector(normal, -impulse * b.mass);
          b.velocity.addScaledVector(normal, impulse * a.mass);
          const squish = Math.min(-approach * 0.35, 3);
          [a, b].forEach((ball) => {
            ball.squashVelocity.x += Math.abs(normal.x) * squish;
            ball.squashVelocity.y += Math.abs(normal.y) * squish;
          });
        }
      }
    };

    const layout = () => {
      half = visibleHalfSize(camera);
      const base = Math.min(half.x, half.y) * (isNarrow() ? 0.22 : 0.15);
      balls.forEach((ball) => {
        ball.radius = base * randomBetween(0.8, 1.15);
        ball.mass = ball.radius * ball.radius;
        ball.position.set(randomBetween(-half.x, half.x) * 0.8, randomBetween(-half.y, half.y) * 0.8);
      });
    };

    return {
      resize: () => {
        camera.position.set(0, 0, isNarrow() ? CONFIG.cameraZNarrow : CONFIG.cameraZ);
        camera.updateProjectionMatrix();
        layout();
      },
      update: (time, delta) => {
        const step = Math.min(delta, 1 / 30);
        lookTarget.set(pointer.x * half.x, pointer.y * half.y);

        balls.forEach((ball) => {
          if (ball === grabbed) {
            // Follow the cursor like a spring, so letting go throws the ball.
            ball.velocity.copy(grabTarget).sub(ball.position).multiplyScalar(12);
          } else {
            ball.velocity.addScaledVector(gravity, step);
            // Gentle wander keeps the aquarium alive when nobody touches it.
            ball.velocity.x += Math.sin(time * 0.7 + ball.mass * 13) * CONFIG.wander * step;
            ball.velocity.y += Math.cos(time * 0.6 + ball.mass * 7) * CONFIG.wander * step;
            ball.velocity.multiplyScalar(1 - CONFIG.airDrag * step);
          }
          ball.position.addScaledVector(ball.velocity, step);
          collideWalls(ball);
        });
        collideBalls();

        balls.forEach((ball) => {
          // Squash & stretch: a damped spring per axis; squeezing one axis bulges the other.
          ball.squashVelocity.addScaledVector(ball.squash, -CONFIG.wobbleStiffness * step);
          ball.squashVelocity.multiplyScalar(1 - CONFIG.wobbleDamping * step);
          ball.squash.addScaledVector(ball.squashVelocity, step);
          ball.squash.clampScalar(-0.35, 0.35);
          const stretch = Math.min(ball.velocity.length() * 0.012, 0.12);
          ball.celebrate = Math.max(0, ball.celebrate - step * 0.6);
          const size = ball.radius * (1 + ball.celebrate * 0.18 + Math.sin(time * 3 + ball.mass) * 0.01);

          ball.mesh.position.set(ball.position.x, ball.position.y, 0);
          ball.mesh.scale.set(
            size * (1 - ball.squash.x + ball.squash.y * 0.5 + stretch * Math.abs(Math.cos(Math.atan2(ball.velocity.y, ball.velocity.x)))),
            size * (1 - ball.squash.y + ball.squash.x * 0.5 + stretch * Math.abs(Math.sin(Math.atan2(ball.velocity.y, ball.velocity.x)))),
            size,
          );
          // Faces keep looking at the viewer, leaning toward the pointer; a hop adds a full spin.
          ball.spin *= 1 - Math.min(step * 4, 1);
          const look = lookTarget.clone().sub(ball.position).multiplyScalar(0.06).clampScalar(-0.45, 0.45);
          ball.mesh.rotation.set(-look.y, look.x + ball.spin, -ball.velocity.x * 0.02);
        });

        hearts.forEach((heart) => {
          if (heart.age < 0) return;
          heart.age += step / CONFIG.heartSeconds;
          heart.velocity.y -= 4 * step;
          heart.mesh.position.addScaledVector(heart.velocity, step);
          heart.mesh.rotation.z += step * 3;
          heart.mesh.scale.setScalar(Math.max(0.001, 0.2 * (1 - heart.age)));
          if (heart.age >= 1) {
            heart.age = -1;
            heart.mesh.visible = false;
          }
        });
      },
      dispose: () => {
        unsubscribe();
        window.removeEventListener("deviceorientation", handleOrientation);
        window.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        window.removeEventListener("click", handleClick);
        environment.dispose();
        pmrem.dispose();
      },
    };
  });

export default bobbleScene;
