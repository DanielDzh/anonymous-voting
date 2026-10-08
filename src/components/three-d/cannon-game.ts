import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CANDIDATE_SELECTED_EVENT, GAME_POINT_EVENT, GAME_SCORES_EVENT, SELECT_CANDIDATE_REQUEST_EVENT } from "@/config/visuals";
import type { StagePerson, ThemeScene } from "@/themes/types";
import { initialsFace, onCandidateSelected, photoTexture } from "./photo-kit";
import { runStage, type StageContext } from "./scene-engine";

/**
 * Shared cannon-voting game. Drag anywhere on the stage to pull the cannon back (a dotted arc
 * shows where the shot will go), release to fire; hitting a candidate's target selects them on
 * the ballot (selection only — casting still needs the button). Themes only supply the looks.
 */

// ───────── what a theme provides ─────────

export type CannonRig = {
  root: THREE.Group;
  /** Rotates around z to aim; local +y points out of the muzzle. */
  barrel: THREE.Group;
  /** Distance from the barrel pivot to the muzzle, in cannon units. */
  muzzle: number;
};

export type TargetRig = {
  root: THREE.Group;
  /** Called every frame; `selected` true for the chosen candidate. */
  setSelected: (selected: boolean, time: number) => void;
  /** Hoops: the ball went in (swish the net). Plain targets get knocked back instead. */
  onScore?: () => void;
};

/**
 * Basketball hoop instead of a round target, in target radii around the rim's centre.
 * It counts only when the ball drops through the rim from above; the rim ends and the
 * backboard are solid, so a shot can bank in off the board.
 */
export type HoopShape = {
  /** Half the rim's opening. */
  rimHalf: number;
  /** Radius of the solid rim ends. */
  rimTube: number;
  /** Backboard on the hoop's outer side (away from the stage centre). */
  board: { x: number; bottom: number; top: number; thickness: number };
};

export type ParticleStyle = {
  geometry: THREE.BufferGeometry;
  colors: number[];
  count: number;
  speed: number;
  /** Units/s² pulling particles down (negative = they rise, like smoke). */
  gravity: number;
  life: number;
  size: number;
  /** Additive glow (sparks) instead of solid pieces. */
  glow?: boolean;
  /** Unlit flat colour (graphic, 2D look) instead of shaded pieces. */
  flat?: boolean;
  grow?: boolean;
};

export type WorldRig = {
  /** Called on every resize with the visible half-size and the layout unit. */
  layout?: (half: { x: number; y: number }, unit: number, targetY: number) => void;
  update?: (time: number) => void;
};

export type CannonVisuals = {
  /** Lights, environment strength, background props. */
  setupWorld: (context: StageContext) => WorldRig;
  buildCannon: () => CannonRig;
  /**
   * A target of radius 1 (scaled by the engine) showing the candidate's face texture.
   * `side` is -1 for targets left of centre, 1 otherwise (where a hoop puts its backboard).
   */
  buildTarget: (face: THREE.Texture, index: number, side: -1 | 1) => TargetRig;
  /** Score through a basketball hoop instead of hitting a round target. */
  hoop?: HoopShape;
  /** How far below the top of the stage the targets sit, in layout units (default 1.9). */
  targetDrop?: number;
  /**
   * Scoring game: every hit adds a point and the leader is the choice (a tie chooses nobody).
   * Without it, a hit chooses that candidate straight away.
   */
  tally?: boolean;
  buildProjectile: () => THREE.Object3D;
  hitBurst: ParticleStyle;
  missBurst: ParticleStyle;
  trail?: ParticleStyle & { every: number };
  /** Expanding ring on hit (space). */
  shockwave?: { color: number; /** Normal blending — additive is invisible on light backgrounds. */ solid?: boolean };
  aimDotColor: number;
  /** Gentle target motion: sideways sway amplitude and vertical bob (in target radii). */
  sway: number;
  bob: number;
};

// ───────── tuning ─────────

const CONFIG = {
  fov: 40,
  cameraZ: 16,
  physicsStep: 1 / 120,
  /** Gravity in "units" (see layout) per s². */
  gravity: 11,
  /** A pull of this many units reaches maximum power. */
  fullPull: 2.6,
  minPull: 0.25,
  /** Barrel can't aim lower than this above the horizon (radians). */
  minAngle: THREE.MathUtils.degToRad(12),
  aimDots: 22,
  aimSeconds: 1.1,
  reloadSeconds: 0.3,
  recoil: { stiffness: 220, damping: 14, kick: 0.35 },
  knock: { stiffness: 90, damping: 7, kick: 1.1 },
  particles: 90,
  projectileRadius: 0.22,
  /** Balls stay on stage after a shot; beyond this many the oldest shrinks away (keeps phones fast). */
  maxBalls: 30,
  /** Bounciness off targets, walls, the floor and each other (0 = dead stop, 1 = perfect bounce). */
  restitution: { target: 0.45, wall: 0.5, floor: 0.35, ball: 0.4 },
  /** Rolling friction on the floor, per second. */
  rollFriction: 2.2,
  despawnSeconds: 0.35,
} as const;

type Target = {
  person: StagePerson;
  rig: TargetRig;
  home: THREE.Vector2;
  position: THREE.Vector2;
  radius: number;
  knock: number;
  knockVelocity: number;
  phase: number;
  side: -1 | 1;
};


type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  gravity: number;
  spin: THREE.Vector3;
  size: number;
  grow: boolean;
};

const toWorldPlane = (() => {
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  return (clientX: number, clientY: number, rect: DOMRect, camera: THREE.Camera) => {
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, hit) ? new THREE.Vector2(hit.x, hit.y) : null;
  };
})();

export const createCannonScene =
  (visuals: CannonVisuals): ThemeScene =>
  (canvas, options, container) =>
    runStage(
      canvas,
      options,
      (context) => {
        const { scene, camera, renderer } = context;
        camera.fov = CONFIG.fov;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = environment;

        let unit = 1;
        let half = { x: 6, y: 8 };
        const world = visuals.setupWorld(context);

        const people: StagePerson[] = options.people?.length
          ? options.people
          : options.photos.map((photo, index) => ({ id: String(index), initials: "", photo }));

        // ── cannon
        const cannon = visuals.buildCannon();
        scene.add(cannon.root);
        let recoil = 0;
        let recoilVelocity = 0;
        const barrelRest = cannon.barrel.position.clone();

        // ── targets
        const targets: Target[] = people.map((person, index) => {
          const face = person.photo ? photoTexture(person.photo) : initialsFace(person.initials, index);
          const side: -1 | 1 = index < (people.length - 1) / 2 ? -1 : 1;
          const rig = visuals.buildTarget(face, index, side);
          scene.add(rig.root);
          return {
            person,
            rig,
            home: new THREE.Vector2(),
            position: new THREE.Vector2(),
            radius: 1,
            knock: 0,
            knockVelocity: 0,
            phase: index * 1.9,
            side,
          };
        });

        // ── balls: every shot stays on stage — bounces off targets, falls, rolls and piles up
        type Ball = {
          mesh: THREE.Object3D;
          position: THREE.Vector2;
          velocity: THREE.Vector2;
          /** Selects a candidate only on its first target hit; later bounces just bounce. */
          spent: boolean;
          grounded: boolean;
          trailClock: number;
          /** -1 while alive, else 0→1 shrinking away. */
          despawn: number;
        };
        const balls: Ball[] = [];
        let reload = 0;
        const disposeObject = (object: THREE.Object3D) =>
          object.traverse((child) => {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose();
            (Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []).forEach((material) => material.dispose());
          });
        const removeBall = (ball: Ball) => {
          scene.remove(ball.mesh);
          disposeObject(ball.mesh);
          balls.splice(balls.indexOf(ball), 1);
        };
        const clearBalls = () => [...balls].forEach(removeBall);
        /** Top of the ground the balls roll on (where the cannon stands). */
        const floorY = () => cannon.root.position.y - unit * 0.3;

        // ── aim preview dots
        const dotGeometry = new THREE.SphereGeometry(1, 10, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: visuals.aimDotColor, transparent: true });
        const dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, CONFIG.aimDots);
        dots.visible = false;
        scene.add(dots);
        const dotMatrix = new THREE.Matrix4();

        // ── particles (pooled; geometry/material swapped per burst style)
        const particleMaterials = new Map<string, THREE.Material>();
        const materialFor = (color: number, glow: boolean, flat = false) => {
          const key = `${color}-${glow}-${flat}`;
          if (!particleMaterials.has(key)) {
            particleMaterials.set(
              key,
              glow || flat
                ? new THREE.MeshBasicMaterial({ color, transparent: true, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false })
                : new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true }),
            );
          }
          return particleMaterials.get(key)!;
        };
        const particles: Particle[] = Array.from({ length: CONFIG.particles }, () => {
          const mesh = new THREE.Mesh(visuals.hitBurst.geometry, materialFor(visuals.hitBurst.colors[0], false));
          mesh.visible = false;
          scene.add(mesh);
          return { mesh, velocity: new THREE.Vector3(), age: -1, life: 1, gravity: 0, spin: new THREE.Vector3(), size: 1, grow: false };
        });
        const burst = (style: ParticleStyle, at: THREE.Vector2, amount = style.count, direction?: THREE.Vector2) => {
          let emitted = 0;
          for (const particle of particles) {
            if (emitted >= amount) break;
            if (particle.age >= 0) continue;
            emitted++;
            particle.mesh.geometry = style.geometry;
            particle.mesh.material = materialFor(style.colors[emitted % style.colors.length], Boolean(style.glow), Boolean(style.flat));
            (particle.mesh.material as THREE.Material & { opacity: number }).opacity = 1;
            particle.mesh.position.set(at.x, at.y, 0.3);
            const angle = Math.random() * Math.PI * 2;
            const speed = style.speed * unit * (0.4 + Math.random() * 0.8);
            particle.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed, (Math.random() - 0.5) * speed * 0.5);
            if (direction) particle.velocity.x += direction.x * 0.3;
            particle.age = 0;
            particle.life = style.life * (0.7 + Math.random() * 0.6);
            particle.gravity = style.gravity * unit;
            particle.size = style.size * unit * (0.6 + Math.random() * 0.8);
            particle.grow = Boolean(style.grow);
            particle.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
            particle.mesh.visible = true;
          }
        };

        // ── shockwave ring
        const ring = visuals.shockwave
          ? new THREE.Mesh(
              new THREE.TorusGeometry(1, 0.06, 8, 48),
              new THREE.MeshBasicMaterial({
                color: visuals.shockwave.color,
                transparent: true,
                blending: visuals.shockwave.solid ? THREE.NormalBlending : THREE.AdditiveBlending,
                depthWrite: false,
              }),
            )
          : null;
        let ringAge = -1;
        if (ring) {
          ring.visible = false;
          scene.add(ring);
        }

        // ── selection: from hits (we request it) and from card taps (the ballot tells us)
        let selectedId: string | null = null;
        const unsubscribe = onCandidateSelected(CANDIDATE_SELECTED_EVENT, (_photo, candidateId) => {
          selectedId = candidateId;
        });

        // ── layout: everything is measured in "units" so it fits any stage aspect
        const layout = (width: number, height: number) => {
          // Resting balls were placed in the old scale; a real resize (rotation) starts a clean stage.
          clearBalls();
          const aspect = width / height;
          const tanHalf = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov / 2));
          camera.position.set(0, 0, CONFIG.cameraZ);
          camera.lookAt(0, 0, 0);
          half = { x: tanHalf * CONFIG.cameraZ * aspect, y: tanHalf * CONFIG.cameraZ };
          unit = Math.min(half.x / 3.4, half.y / 4.6);

          cannon.root.scale.setScalar(unit);
          cannon.root.position.set(0, -half.y + unit * 1.05, 0);

          // Equal columns across the full width, so the HTML names above line up with the targets.
          const count = Math.max(targets.length, 1);
          const spacing = (half.x * 2) / count;
          const targetY = half.y - unit * (visuals.targetDrop ?? 1.9);
          targets.forEach((target, index) => {
            target.radius = Math.min(spacing * 0.34, unit * 1.05);
            target.home.set((index - (count - 1) / 2) * spacing, targetY);
            target.rig.root.scale.setScalar(target.radius);
          });
          world.layout?.(half, unit, targetY);
        };

        const muzzleWorld = () => {
          const angle = cannon.barrel.rotation.z;
          const length = cannon.muzzle * unit;
          return new THREE.Vector2(
            cannon.root.position.x + cannon.barrel.position.x * unit - Math.sin(angle) * length,
            cannon.root.position.y + cannon.barrel.position.y * unit + Math.cos(angle) * length,
          );
        };

        const maxSpeed = () => {
          // A full pull straight up peaks a little above the targets — strong enough to reach any
          // of them, not so strong that shots sail off the top.
          const targetY = targets[0]?.home.y ?? half.y - unit * (visuals.targetDrop ?? 1.9);
          const rise = Math.max(targetY - muzzleWorld().y + unit * 1.6, unit * 3);
          return Math.sqrt(2 * CONFIG.gravity * unit * rise);
        };

        // ── input: drag anywhere on the stage to aim, release to fire
        const surface = container ?? canvas;
        let aiming: { start: THREE.Vector2; pull: THREE.Vector2; pointerId: number } | null = null;

        const launchVelocity = (pull: THREE.Vector2) => {
          const strength = Math.min(pull.length() / (CONFIG.fullPull * unit), 1);
          let angle = Math.atan2(pull.y, pull.x);
          angle = THREE.MathUtils.clamp(angle, CONFIG.minAngle, Math.PI - CONFIG.minAngle);
          const speed = maxSpeed() * (0.35 + strength * 0.65);
          return new THREE.Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
        };

        const aimBarrel = (velocity: THREE.Vector2) => {
          cannon.barrel.rotation.z = Math.atan2(-velocity.x, velocity.y);
        };

        const handleDown = (event: PointerEvent) => {
          // A new touch always starts a fresh aim (a lost pointerup must never lock the cannon).
          const point = toWorldPlane(event.clientX, event.clientY, surface.getBoundingClientRect(), camera);
          if (!point) return;
          surface.setPointerCapture?.(event.pointerId);
          aiming = { start: point, pull: new THREE.Vector2(), pointerId: event.pointerId };
        };
        const handleMove = (event: PointerEvent) => {
          if (!aiming || event.pointerId !== aiming.pointerId) return;
          const point = toWorldPlane(event.clientX, event.clientY, surface.getBoundingClientRect(), camera);
          if (!point) return;
          // Pull back = drag away from where you started; the shot goes the opposite way.
          aiming.pull.copy(aiming.start).sub(point);
          if (aiming.pull.length() > CONFIG.minPull * unit) aimBarrel(launchVelocity(aiming.pull));
        };
        const handleUp = (event: PointerEvent) => {
          if (!aiming || event.pointerId !== aiming.pointerId) return;
          const { pull } = aiming;
          aiming = null;
          dots.visible = false;
          if (pull.length() < CONFIG.minPull * unit || reload > 0) return;
          const velocity = launchVelocity(pull);
          aimBarrel(velocity);
          const mesh = visuals.buildProjectile();
          mesh.scale.setScalar(unit);
          scene.add(mesh);
          const ball: Ball = { mesh, position: muzzleWorld(), velocity: velocity.clone(), spent: false, grounded: false, trailClock: 0, despawn: -1 };
          balls.push(ball);
          // Too many on stage: the oldest living ball shrinks away.
          const alive = balls.filter((item) => item.despawn < 0);
          if (alive.length > CONFIG.maxBalls) alive[0].despawn = 0;
          reload = CONFIG.reloadSeconds;
          recoilVelocity -= CONFIG.recoil.kick * 10;
          burst(visuals.missBurst, ball.position, 5);
        };
        const handleCancel = () => {
          aiming = null;
          dots.visible = false;
        };
        surface.addEventListener("pointerdown", handleDown);
        surface.addEventListener("pointermove", handleMove);
        surface.addEventListener("pointerup", handleUp);
        surface.addEventListener("pointercancel", handleCancel);
        surface.addEventListener("lostpointercapture", handleUp);

        // Scoring game tally for this visit (starts at 0 : 0 on every page load).
        const scores: Record<string, number> = Object.fromEntries(targets.map((target) => [target.person.id, 0]));
        const announceScores = () => window.dispatchEvent(new CustomEvent(GAME_SCORES_EVENT, { detail: { scores: { ...scores } } }));
        // Let the page show 0 : 0 right away (after the current render, so its listener is attached).
        if (visuals.tally) setTimeout(announceScores, 0);

        const selectByHit = (hit: Target, at: THREE.Vector2 = hit.position) => {
          // Every hit also feeds the room-wide fun tally (not votes) on the projector.
          window.dispatchEvent(new CustomEvent(GAME_POINT_EVENT, { detail: { candidateId: hit.person.id, points: 1 } }));
          burst(visuals.hitBurst, at);
          if (hoop) hit.rig.onScore?.();
          else hit.knockVelocity += CONFIG.knock.kick * 10;
          if (ring) {
            ringAge = 0;
            ring.position.set(at.x, at.y, 0.2);
            ring.visible = true;
          }
          // The ballot answers with CANDIDATE_SELECTED_EVENT, which lights the target up. Before the
          // code is entered nobody answers: shooting is just practice and selects nothing.
          if (!visuals.tally) {
            window.dispatchEvent(new CustomEvent(SELECT_CANDIDATE_REQUEST_EVENT, { detail: { candidateId: hit.person.id } }));
            return;
          }
          scores[hit.person.id] = (scores[hit.person.id] ?? 0) + 1;
          announceScores();
          const best = Math.max(...Object.values(scores));
          const leaders = targets.filter((target) => scores[target.person.id] === best);
          window.dispatchEvent(
            new CustomEvent(SELECT_CANDIDATE_REQUEST_EVENT, {
              detail:
                leaders.length === 1
                  ? { candidateId: leaders[0].person.id }
                  : { candidateId: null, among: targets.map((target) => target.person.id) },
            }),
          );
        };

        const physics = (time: number, dt: number) => {
          targets.forEach((target) => {
            target.position.set(
              target.home.x + Math.sin(time * 0.7 + target.phase) * visuals.sway * target.radius,
              target.home.y + Math.sin(time * 1.3 + target.phase) * visuals.bob * target.radius,
            );
            target.knockVelocity += (-CONFIG.knock.stiffness * target.knock - CONFIG.knock.damping * target.knockVelocity) * dt;
            target.knock += target.knockVelocity * dt;
          });
          recoilVelocity += (-CONFIG.recoil.stiffness * recoil - CONFIG.recoil.damping * recoilVelocity) * dt;
          recoil += recoilVelocity * dt;
          if (reload > 0) reload -= dt;

          stepBalls(dt);
        };

        const normal = new THREE.Vector2();
        const bounce = (velocity: THREE.Vector2, along: THREE.Vector2, restitution: number) => {
          const speed = velocity.dot(along);
          if (speed < 0) velocity.addScaledVector(along, -(1 + restitution) * speed);
        };

        const hoop = visuals.hoop;

        const pushOut = (ball: { position: THREE.Vector2; velocity: THREE.Vector2 }, point: THREE.Vector2, reach: number, restitution: number) => {
          normal.subVectors(ball.position, point);
          const distance = normal.length();
          if (distance >= reach || distance === 0) return false;
          normal.divideScalar(distance);
          ball.position.copy(point).addScaledVector(normal, reach);
          bounce(ball.velocity, normal, restitution);
          return true;
        };
        const hoopPoint = new THREE.Vector2();
        /** Rim ends and backboard; true when the ball touched one. */
        const collideHoop = (ball: { position: THREE.Vector2; velocity: THREE.Vector2 }, target: Target, radius: number) => {
          if (!hoop) return false;
          const r = target.radius;
          let touched = false;
          for (const end of [-1, 1]) {
            hoopPoint.set(target.position.x + end * hoop.rimHalf * r, target.position.y);
            touched = pushOut(ball, hoopPoint, hoop.rimTube * r + radius, CONFIG.restitution.target) || touched;
          }
          const boardX = target.position.x + target.side * hoop.board.x * r;
          const y = THREE.MathUtils.clamp(ball.position.y, target.position.y + hoop.board.bottom * r, target.position.y + hoop.board.top * r);
          hoopPoint.set(boardX, y);
          touched = pushOut(ball, hoopPoint, (hoop.board.thickness / 2) * r + radius, CONFIG.restitution.wall) || touched;
          return touched;
        };
        /** Dropped through the rim from above, between its ends. */
        const scored = (from: THREE.Vector2, to: THREE.Vector2, target: Target) =>
          Boolean(hoop) &&
          from.y >= target.position.y &&
          to.y < target.position.y &&
          Math.abs(to.x - target.position.x) < hoop!.rimHalf * target.radius;

        /** Preview only: would a ball here touch a rim end or the backboard? */
        const touchesHoop = (point: THREE.Vector2, target: Target) => {
          if (!hoop) return false;
          const r = target.radius;
          const nearRim = [-1, 1].some(
            (end) => Math.hypot(point.x - (target.position.x + end * hoop.rimHalf * r), point.y - target.position.y) < hoop.rimTube * r,
          );
          const boardX = target.position.x + target.side * hoop.board.x * r;
          const onBoard =
            Math.abs(point.x - boardX) < (hoop.board.thickness / 2) * r &&
            point.y > target.position.y + hoop.board.bottom * r &&
            point.y < target.position.y + hoop.board.top * r;
          return nearRim || onBoard;
        };

        const previous = new THREE.Vector2();
        const stepBalls = (dt: number) => {
          const radius = CONFIG.projectileRadius * unit;
          const floor = floorY() + radius;
          const cannonCenter = new THREE.Vector2(cannon.root.position.x, cannon.root.position.y - unit * 0.3);
          const cannonRadius = unit * 0.55 + radius;

          for (const ball of balls) {
            ball.velocity.y -= CONFIG.gravity * unit * dt;
            previous.copy(ball.position);
            ball.position.addScaledVector(ball.velocity, dt);

            // Hoops: a clean drop through the rim selects; rim ends and backboard bounce.
            if (hoop) {
              for (const target of targets) {
                collideHoop(ball, target, radius);
                if (!ball.spent && scored(previous, ball.position, target)) {
                  ball.spent = true;
                  selectByHit(target);
                }
              }
            }

            // Targets: the first hit selects; every contact bounces the ball back off.
            for (const target of hoop ? [] : targets) {
              normal.subVectors(ball.position, target.position);
              const distance = normal.length();
              if (distance >= target.radius + radius || distance === 0) continue;
              normal.divideScalar(distance);
              ball.position.copy(target.position).addScaledVector(normal, target.radius + radius);
              bounce(ball.velocity, normal, CONFIG.restitution.target);
              if (!ball.spent) {
                ball.spent = true;
                selectByHit(target);
              }
            }

            // The cannon's base is solid too, so balls pile up around it instead of through it.
            normal.subVectors(ball.position, cannonCenter);
            const cannonDistance = normal.length();
            // Also for balls rolling along the ground, so they can't roll through to the other side.
            if (cannonDistance < cannonRadius && cannonDistance > 0) {
              normal.divideScalar(cannonDistance);
              ball.position.copy(cannonCenter).addScaledVector(normal, cannonRadius);
              bounce(ball.velocity, normal, CONFIG.restitution.ball);
            }

            // Walls and floor.
            if (ball.position.x < -half.x + radius) {
              ball.position.x = -half.x + radius;
              ball.velocity.x = Math.abs(ball.velocity.x) * CONFIG.restitution.wall;
            } else if (ball.position.x > half.x - radius) {
              ball.position.x = half.x - radius;
              ball.velocity.x = -Math.abs(ball.velocity.x) * CONFIG.restitution.wall;
            }
            ball.grounded = false;
            if (ball.position.y < floor) {
              ball.position.y = floor;
              ball.velocity.y = Math.abs(ball.velocity.y) * CONFIG.restitution.floor;
              if (ball.velocity.y < unit * 0.6) ball.velocity.y = 0;
              ball.grounded = true;
            }
            if (ball.grounded) ball.velocity.x *= Math.max(0, 1 - CONFIG.rollFriction * dt);
            if (!ball.spent && ball.grounded) ball.spent = true;
          }

          // Balls push each other apart, so they stack into a little pile.
          for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
              const a = balls[i];
              const b = balls[j];
              normal.subVectors(b.position, a.position);
              const distance = normal.length();
              if (distance >= radius * 2 || distance === 0) continue;
              normal.divideScalar(distance);
              const overlap = (radius * 2 - distance) / 2;
              a.position.addScaledVector(normal, -overlap);
              b.position.addScaledVector(normal, overlap);
              const closing = b.velocity.clone().sub(a.velocity).dot(normal);
              if (closing < 0) {
                const impulse = (-(1 + CONFIG.restitution.ball) * closing) / 2;
                a.velocity.addScaledVector(normal, -impulse);
                b.velocity.addScaledVector(normal, impulse);
              }
            }
          }
        };

        let accumulator = 0;
        const dotPosition = new THREE.Vector2();
        const dotPrevious = new THREE.Vector2();
        const dotVelocity = new THREE.Vector2();

        return {
          resize: (width, height) => layout(width, height),
          update: (time, delta) => {
            accumulator += delta;
            let steps = 0;
            while (accumulator >= CONFIG.physicsStep && steps < 24) {
              physics(time, CONFIG.physicsStep);
              accumulator -= CONFIG.physicsStep;
              steps++;
            }

            // Recoil slides the barrel back along its own axis.
            const axis = cannon.barrel.rotation.z;
            cannon.barrel.position.set(barrelRest.x - Math.sin(axis) * recoil, barrelRest.y + Math.cos(axis) * recoil, barrelRest.z);

            targets.forEach((target) => {
              target.rig.root.position.set(target.position.x, target.position.y, 0);
              if (!hoop) target.rig.root.rotation.x = THREE.MathUtils.clamp(-target.knock, -1.2, 1.2);
              target.rig.setSelected(target.person.id === selectedId, time);
            });

            const ballRadius = CONFIG.projectileRadius * unit;
            for (const ball of [...balls]) {
              ball.mesh.position.set(ball.position.x, ball.position.y, 0.2);
              // Rolling: spin by distance travelled.
              ball.mesh.rotation.z -= (ball.velocity.x / ballRadius) * delta;
              if (ball.despawn >= 0) {
                ball.despawn += delta / CONFIG.despawnSeconds;
                ball.mesh.scale.setScalar(unit * Math.max(0, 1 - ball.despawn));
                if (ball.despawn >= 1) removeBall(ball);
                continue;
              }
              // Trail only while really flying.
              if (visuals.trail && !ball.grounded && ball.velocity.lengthSq() > (unit * 3) ** 2) {
                ball.trailClock += delta;
                if (ball.trailClock > visuals.trail.every) {
                  ball.trailClock = 0;
                  burst(visuals.trail, ball.position, 1);
                }
              }
            }

            // Dotted trajectory while aiming.
            if (aiming && aiming.pull.length() > CONFIG.minPull * unit) {
              dots.visible = true;
              dotPosition.copy(muzzleWorld());
              dotVelocity.copy(launchVelocity(aiming.pull));
              const stepTime = CONFIG.aimSeconds / CONFIG.aimDots;
              // The arc stops at the first target it would hit — you see whom you'll pick.
              let blocked = false;
              for (let i = 0; i < CONFIG.aimDots; i++) {
                dotVelocity.y -= CONFIG.gravity * unit * stepTime;
                dotPrevious.copy(dotPosition);
                dotPosition.addScaledVector(dotVelocity, stepTime);
                blocked ||= targets.some((target) =>
                  hoop
                    ? scored(dotPrevious, dotPosition, target) || touchesHoop(dotPosition, target)
                    : target.position.distanceTo(dotPosition) < target.radius,
                );
                const size = blocked ? 0 : unit * 0.075 * (1 - (i / CONFIG.aimDots) * 0.6);
                dotMatrix.makeScale(size, size, size).setPosition(dotPosition.x, dotPosition.y, 0.25);
                dots.setMatrixAt(i, dotMatrix);
              }
              dots.instanceMatrix.needsUpdate = true;
            }

            particles.forEach((particle) => {
              if (particle.age < 0) return;
              particle.age += delta / particle.life;
              particle.velocity.y -= particle.gravity * delta;
              particle.velocity.multiplyScalar(1 - delta * 0.8);
              particle.mesh.position.addScaledVector(particle.velocity, delta);
              particle.mesh.rotation.x += particle.spin.x * delta;
              particle.mesh.rotation.y += particle.spin.y * delta;
              const scale = particle.size * (particle.grow ? 0.5 + particle.age * 1.5 : 1 - particle.age * 0.5);
              particle.mesh.scale.setScalar(Math.max(scale, 0.001));
              (particle.mesh.material as THREE.Material & { opacity: number }).opacity = 1 - particle.age;
              if (particle.age >= 1) {
                particle.age = -1;
                particle.mesh.visible = false;
              }
            });

            if (ring && ringAge >= 0) {
              ringAge += delta / 0.6;
              ring.scale.setScalar(unit * (0.6 + ringAge * 3));
              (ring.material as THREE.MeshBasicMaterial).opacity = 1 - ringAge;
              if (ringAge >= 1) {
                ringAge = -1;
                ring.visible = false;
              }
            }

            world.update?.(time);
          },
          dispose: () => {
            clearBalls();
            unsubscribe();
            surface.removeEventListener("pointerdown", handleDown);
            surface.removeEventListener("pointermove", handleMove);
            surface.removeEventListener("pointerup", handleUp);
            surface.removeEventListener("pointercancel", handleCancel);
            surface.removeEventListener("lostpointercapture", handleUp);
            particleMaterials.forEach((material) => material.dispose());
            environment.dispose();
            pmrem.dispose();
          },
        };
      },
      container,
    );

// ───────── helpers for theme looks ─────────

/** A round face (photo or initials) of radius 1 facing the camera; CircleGeometry's UVs crop the square photo to a circle. */
export const faceDisc = (face: THREE.Texture, radius = 1, z = 0) => {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ map: face, toneMapped: false }));
  disc.position.z = z;
  return disc;
};

/** A ring lying in the screen plane (for halos and target rings). */
export const flatRing = (radius: number, tube: number, material: THREE.Material) =>
  new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 64), material);

/** Wheel for cannon carriages: a cylinder turned to face the camera, plus a hub. */
export const wheel = (radius: number, width: number, rim: THREE.Material, hub: THREE.Material) => {
  const group = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), rim);
  tire.rotation.x = Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, width * 1.3, 16), hub);
  cap.rotation.x = Math.PI / 2;
  group.add(tire, cap);
  return group;
};
