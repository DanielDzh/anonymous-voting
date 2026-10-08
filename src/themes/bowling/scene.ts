import * as THREE from "three";
import { faceDisc } from "@/components/three-d/cannon-game";
import { initialsFace, onCandidateSelected, photoTexture } from "@/components/three-d/photo-kit";
import { runStage } from "@/components/three-d/scene-engine";
import { CANDIDATE_SELECTED_EVENT, GAME_POINT_EVENT, GAME_SCORES_EVENT, SELECT_CANDIDATE_REQUEST_EVENT } from "@/config/visuals";
import type { StagePerson, ThemeScene } from "../types";
import { COLORS, flat } from "../fair/minimal-look";

/**
 * 21 · Кеглі — minimal 3D bowling seen from behind the bowler. One lane per candidate, their photo
 * standing at the far end. Put a finger on a lane's ball, slide sideways to line up, swipe up to
 * bowl: the swipe's speed and direction become the ball's. Leave the lane and the ball rolls down
 * the gutter. Every pin knocked down is a point; whoever has the most is the choice (a tie: nobody).
 *
 * Physics is 2D on the lane (x across, y along it, 0 at the ball); drawing maps it to 3D as
 * (x, height, -y), so the camera looks down the lanes with real perspective.
 */

const CONFIG = {
  fov: 42,
  physicsStep: 1 / 120,
  /** World units; everything else is relative to a lane 1 wide. */
  laneWidth: 1,
  /** Share of a column the lane takes (the rest is gutters and gaps). */
  laneShare: 0.66,
  laneLength: 6,
  gutterWidth: 0.13,
  ballRadius: 0.12,
  pinRadius: 0.065,
  pinHeight: 0.4,
  pinRowGap: 0.18,
  pinColumnGap: 0.2,
  /** Pin rows from the head pin back: 1, 2, 3 pins. */
  pinRows: 3,
  /** Head pin's distance from the ball, along the lane. */
  headPinY: 5,
  photo: { radius: 0.36, height: 0.75, behindLane: 0.35 },
  /** Swipe limits, lane widths/s. */
  minThrowSpeed: 1.2,
  maxThrowSpeed: 9,
  /** Ball speed (lane widths/s) per finger speed (stage heights/s). */
  throwGain: 2.6,
  /**
   * Swipe tilt vs the lane on screen: within the dead zone it counts as straight (people swipe
   * "up", not exactly along a lane drawn in perspective); beyond it, `steer` of the extra tilt steers.
   */
  steerDeadZone: THREE.MathUtils.degToRad(12),
  steer: 0.5,
  /** Velocity is measured over the last part of the swipe. */
  swipeWindowMs: 90,
  ballMass: 5,
  pinMass: 1,
  restitution: 0.7,
  /** A pin moving faster than this (lane widths/s) goes down. */
  knockSpeed: 0.35,
  ballFriction: 0.08,
  pinFriction: 2.6,
  /** Seconds a knocked pin takes to tip over. */
  tipSeconds: 0.25,
  /** After a throw ends (ball off the end, or stopped), the lane is re-racked after this. */
  resetSeconds: 1.2,
} as const;

const LANE_COLOR = 0xefe8da;
const GUTTER_COLOR = 0xdcd5c7;

type Body = { position: THREE.Vector2; velocity: THREE.Vector2 };

type Pin = Body & {
  mesh: THREE.Group;
  home: THREE.Vector2;
  down: boolean;
  /** 0 standing → 1 lying, and the direction it falls toward. */
  tip: number;
  fallDirection: THREE.Vector2;
};

type Lane = {
  person: StagePerson;
  center: number;
  pins: Pin[];
  ball: THREE.Group;
  ballBody: Body;
  state: "ready" | "held" | "rolling" | "done";
  gutter: number;
  resetIn: number;
  photo: THREE.Group;
  photoRing: THREE.MeshBasicMaterial;
  halo: THREE.Mesh;
  bump: number;
};

/** Lane coordinates → world: across stays x, along the lane goes into the screen (-z). */
const toWorld3 = (x: number, y: number, height = 0) => new THREE.Vector3(x, height, -y);

/** Bowling pin silhouette (radius by height, both in pin heights), turned on a lathe. */
const PIN_PROFILE: [number, number][] = [
  [0, 0.11],
  [0.08, 0.15],
  [0.3, 0.19],
  [0.5, 0.14],
  [0.62, 0.075],
  [0.7, 0.065],
  [0.82, 0.095],
  [0.92, 0.085],
  [0.98, 0.04],
  [1, 0],
];

const buildPin = () => {
  const pin = new THREE.Group();
  const points = PIN_PROFILE.map(([y, r]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(points, 28),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
  );
  body.castShadow = true;
  pin.add(body);
  const stripe = new THREE.MeshStandardMaterial({ color: COLORS.accent, roughness: 0.4 });
  [0.6, 0.66].forEach((y) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.087, 0.025, 24, 1, true), stripe);
    band.position.y = y;
    pin.add(band);
  });
  return pin;
};

const buildBall = () => {
  const ball = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.25, metalness: 0.1 }),
  );
  sphere.castShadow = true;
  ball.add(sphere);
  // Three finger holes, so you can see it roll.
  const holeMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.8 });
  [
    [0.3, 0.88, 0.36],
    [-0.25, 0.9, 0.35],
    [0, 0.86, -0.5],
  ].forEach(([x, y, z]) => {
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), holeMaterial);
    hole.position.set(x, y, z).setLength(0.95);
    ball.add(hole);
  });
  return ball;
};

/** Elastic-ish hit between two discs. */
const collide = (a: Body, ra: number, ma: number, b: Body, rb: number, mb: number) => {
  const normal = new THREE.Vector2().subVectors(b.position, a.position);
  const distance = normal.length();
  if (distance >= ra + rb || distance === 0) return;
  normal.divideScalar(distance);
  const overlap = ra + rb - distance;
  const total = ma + mb;
  a.position.addScaledVector(normal, -overlap * (mb / total));
  b.position.addScaledVector(normal, overlap * (ma / total));
  const closing = new THREE.Vector2().subVectors(a.velocity, b.velocity).dot(normal);
  if (closing <= 0) return;
  const impulse = ((1 + CONFIG.restitution) * closing) / total;
  a.velocity.addScaledVector(normal, -impulse * mb);
  b.velocity.addScaledVector(normal, impulse * ma);
};

const scene: ThemeScene = (canvas, options, container) =>
  runStage(
    canvas,
    options,
    ({ scene: stage, camera, renderer }) => {
      camera.fov = CONFIG.fov;
      stage.background = new THREE.Color(COLORS.paper);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      stage.add(new THREE.HemisphereLight(0xffffff, 0xd8cfbf, 2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.radius = 4;
      // Without a bias, the lane shadows itself in stripes ("shadow acne").
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.02;
      stage.add(sun, sun.target);

      const people: StagePerson[] = options.people?.length
        ? options.people
        : options.photos.map((photo, index) => ({ id: String(index), initials: "", photo }));

      const w = CONFIG.laneWidth;
      const column = w / CONFIG.laneShare;
      const totalWidth = column * Math.max(people.length, 1);
      const L = CONFIG.laneLength;

      // Floor under everything (catches shadows), then lanes with gutters and minimal markings.
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth + 4, L + 6), new THREE.MeshStandardMaterial({ color: COLORS.paper, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2;
      // Below the gutters, so the two surfaces never fight over the same depth (flicker).
      floor.position.set(0, -0.08, -L / 2);
      floor.receiveShadow = true;
      stage.add(floor);

      const lanes: Lane[] = people.map((person, index) => {
        const center = -totalWidth / 2 + column * (index + 0.5);
        const surface = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, L + 0.6), new THREE.MeshStandardMaterial({ color: LANE_COLOR, roughness: 0.55 }));
        surface.position.set(center, -0.02, -L / 2 + 0.1);
        surface.receiveShadow = true;
        stage.add(surface);
        [-1, 1].forEach((side) => {
          const gutter = new THREE.Mesh(
            new THREE.BoxGeometry(w * CONFIG.gutterWidth, 0.02, L + 0.6),
            new THREE.MeshStandardMaterial({ color: GUTTER_COLOR, roughness: 0.8 }),
          );
          gutter.position.set(center + side * (w / 2 + (w * CONFIG.gutterWidth) / 2), -0.03, -L / 2 + 0.1);
          gutter.receiveShadow = true;
          const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, L + 0.6), flat(COLORS.hairline));
          edge.position.set(center + side * (w / 2), -0.015, -L / 2 + 0.1);
          stage.add(gutter, edge);
        });
        // Foul line and three aiming arrows — the only markings.
        const foul = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.015), flat(COLORS.ink));
        foul.rotation.x = -Math.PI / 2;
        foul.position.set(center, 0.002, -0.35);
        stage.add(foul);
        [-0.25, 0, 0.25].forEach((dx) => {
          const arrow = new THREE.Mesh(new THREE.CircleGeometry(0.035, 3), flat(COLORS.accent));
          arrow.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
          arrow.position.set(center + dx * w, 0.002, -(L * 0.35 + Math.abs(dx) * 0.6));
          stage.add(arrow);
        });

        const pins: Pin[] = [];
        for (let row = 0; row < CONFIG.pinRows; row++) {
          for (let columnIndex = 0; columnIndex <= row; columnIndex++) {
            const mesh = buildPin();
            mesh.scale.setScalar(CONFIG.pinHeight);
            stage.add(mesh);
            pins.push({
              mesh,
              home: new THREE.Vector2(center + (columnIndex - row / 2) * CONFIG.pinColumnGap, CONFIG.headPinY + row * CONFIG.pinRowGap),
              position: new THREE.Vector2(),
              velocity: new THREE.Vector2(),
              down: false,
              tip: 0,
              fallDirection: new THREE.Vector2(0, 1),
            });
          }
        }

        const ball = buildBall();
        ball.scale.setScalar(CONFIG.ballRadius);
        stage.add(ball);

        // The candidate's photo stands at the end of the lane, facing the bowler.
        const photo = new THREE.Group();
        const face = person.photo ? photoTexture(person.photo) : initialsFace(person.initials, index);
        const ringMaterial = flat(COLORS.ink);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.04, 64), ringMaterial);
        ring.position.z = 0.01;
        photo.add(new THREE.Mesh(new THREE.CircleGeometry(1.08, 64), flat(COLORS.paper)), ring, faceDisc(face, 0.9, 0.02));
        const halo = new THREE.Mesh(new THREE.RingGeometry(1.14, 1.24, 64), flat(COLORS.accent));
        halo.position.z = 0.03;
        halo.visible = false;
        photo.add(halo);
        photo.scale.setScalar(CONFIG.photo.radius);
        photo.position.copy(toWorld3(center, L + CONFIG.photo.behindLane, CONFIG.photo.height));
        stage.add(photo);

        return {
          person,
          center,
          pins,
          ball,
          ballBody: { position: new THREE.Vector2(center, 0), velocity: new THREE.Vector2() },
          state: "ready",
          gutter: 0,
          resetIn: 0,
          photo,
          photoRing: ringMaterial,
          halo,
          bump: 0,
        };
      });

      const rackPins = (lane: Lane) =>
        lane.pins.forEach((pin) => {
          pin.position.copy(pin.home);
          pin.velocity.set(0, 0);
          pin.down = false;
          pin.tip = 0;
        });
      const readyBall = (lane: Lane) => {
        lane.ballBody.position.set(lane.center, 0);
        lane.ballBody.velocity.set(0, 0);
        lane.ball.quaternion.identity();
        lane.state = "ready";
        lane.gutter = 0;
      };
      lanes.forEach((lane) => {
        rackPins(lane);
        readyBall(lane);
      });

      // Light from behind-left so pins throw short shadows toward the bowler.
      sun.position.set(-totalWidth, 6, -L - 2);
      sun.target.position.set(0, 0, -L / 2);
      sun.shadow.camera.left = -totalWidth;
      sun.shadow.camera.right = totalWidth;
      sun.shadow.camera.top = L;
      sun.shadow.camera.bottom = -L;
      sun.shadow.camera.far = 30;

      /** Camera behind and above the bowlers, pulled back until every lane end-to-end fits. */
      const layout = () => {
        const target = new THREE.Vector3(0, 0, -L * 0.5);
        const direction = new THREE.Vector3(0, 0.62, 1).normalize();
        const corners = [
          toWorld3(-totalWidth / 2, -0.3),
          toWorld3(totalWidth / 2, -0.3),
          toWorld3(-totalWidth / 2, L + CONFIG.photo.behindLane, CONFIG.photo.height + CONFIG.photo.radius * 1.3),
          toWorld3(totalWidth / 2, L + CONFIG.photo.behindLane, CONFIG.photo.height + CONFIG.photo.radius * 1.3),
        ];
        const ndc = new THREE.Vector3();
        for (let distance = 4; distance < 40; distance += 0.1) {
          camera.position.copy(target).addScaledVector(direction, distance);
          camera.lookAt(target);
          camera.updateMatrixWorld();
          camera.updateProjectionMatrix();
          const fits = corners.every((corner) => {
            ndc.copy(corner).project(camera);
            return Math.abs(ndc.x) < 0.94 && ndc.y > -0.97 && ndc.y < 0.9;
          });
          if (fits) break;
        }
      };

      // ── scoring (same rules as the scoring cannon games)
      const scores: Record<string, number> = Object.fromEntries(lanes.map((lane) => [lane.person.id, 0]));
      const announceScores = () => window.dispatchEvent(new CustomEvent(GAME_SCORES_EVENT, { detail: { scores: { ...scores } } }));
      setTimeout(announceScores, 0);
      const score = (lane: Lane) => {
        scores[lane.person.id] += 1;
        window.dispatchEvent(new CustomEvent(GAME_POINT_EVENT, { detail: { candidateId: lane.person.id, points: 1 } }));
        lane.bump = 1;
        announceScores();
        const best = Math.max(...Object.values(scores));
        const leaders = lanes.filter((item) => scores[item.person.id] === best);
        window.dispatchEvent(
          new CustomEvent(SELECT_CANDIDATE_REQUEST_EVENT, {
            detail:
              leaders.length === 1
                ? { candidateId: leaders[0].person.id }
                : { candidateId: null, among: lanes.map((item) => item.person.id) },
          }),
        );
      };

      let selectedId: string | null = null;
      const unsubscribe = onCandidateSelected(CANDIDATE_SELECTED_EVENT, (_photo, candidateId) => {
        selectedId = candidateId;
      });

      // ── swipe: grab a lane's ball, slide to aim, flick up to bowl
      const raycaster = new THREE.Raycaster();
      const lanePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pointerNdc = new THREE.Vector2();
      const hit = new THREE.Vector3();
      const surface = container ?? canvas;
      /** Screen point → lane coordinates (x across, y along), on the lane surface. */
      const toLane = (event: PointerEvent) => {
        const rect = surface.getBoundingClientRect();
        pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
        raycaster.setFromCamera(pointerNdc, camera);
        return raycaster.ray.intersectPlane(lanePlane, hit) ? new THREE.Vector2(hit.x, -hit.z) : null;
      };

      type Sample = { point: THREE.Vector2; screen: THREE.Vector2; time: number };
      const screenOf = (event: PointerEvent) => new THREE.Vector2(event.clientX, event.clientY);
      const projected = new THREE.Vector3();
      /** Where a lane point lands on screen, in CSS px relative to the stage. */
      const toScreen = (x: number, y: number) => {
        const rect = surface.getBoundingClientRect();
        projected.copy(toWorld3(x, y)).project(camera);
        return new THREE.Vector2(rect.left + ((projected.x + 1) / 2) * rect.width, rect.top + ((1 - projected.y) / 2) * rect.height);
      };
      let held: { lane: Lane; pointerId: number; samples: Sample[] } | null = null;

      const handleDown = (event: PointerEvent) => {
        const point = toLane(event);
        if (!point) return;
        const lane = lanes.find((item) => Math.abs(point.x - item.center) < column / 2);
        // Only the bowler's end of the lane picks the ball up.
        if (!lane || lane.state !== "ready" || point.y > L * 0.4) return;
        surface.setPointerCapture?.(event.pointerId);
        lane.state = "held";
        held = { lane, pointerId: event.pointerId, samples: [{ point, screen: screenOf(event), time: event.timeStamp }] };
      };
      const handleMove = (event: PointerEvent) => {
        if (!held || event.pointerId !== held.pointerId) return;
        const point = toLane(event);
        if (!point) return;
        held.samples.push({ point, screen: screenOf(event), time: event.timeStamp });
        if (held.samples.length > 30) held.samples.shift();
        // The ball follows the finger sideways within the lane (that's the aim).
        const { lane } = held;
        const limit = w / 2 - CONFIG.ballRadius;
        lane.ballBody.position.x = THREE.MathUtils.clamp(point.x, lane.center - limit, lane.center + limit);
      };
      const handleUp = (event: PointerEvent) => {
        if (!held || event.pointerId !== held.pointerId) return;
        const { lane, samples } = held;
        held = null;
        const last = samples[samples.length - 1];
        const first = samples.find((sample) => last.time - sample.time <= CONFIG.swipeWindowMs) ?? samples[0];
        const seconds = Math.max((last.time - first.time) / 1000, 0.016);
        // Read the swipe on screen, against the lane as it appears there (perspective makes lanes
        // converge, so "straight up the screen" isn't straight down a side lane).
        const swipe = new THREE.Vector2().subVectors(last.screen, first.screen);
        const laneAxis = new THREE.Vector2().subVectors(toScreen(lane.ballBody.position.x, L), toScreen(lane.ballBody.position.x, 0));
        const forward = swipe.dot(laneAxis);
        const stageHeight = surface.getBoundingClientRect().height || 1;
        const speed = (swipe.length() / stageHeight / seconds) * CONFIG.throwGain * w;
        // Not a flick up the lane: put the ball back.
        if (forward <= 0 || speed < CONFIG.minThrowSpeed * w) {
          readyBall(lane);
          return;
        }
        // Signed angle between the lane and the swipe (screen y points down, so cross > 0 is "to the right").
        const tilt = Math.atan2(laneAxis.x * swipe.y - laneAxis.y * swipe.x, forward);
        const angle = Math.sign(tilt) * Math.max(0, Math.abs(tilt) - CONFIG.steerDeadZone) * CONFIG.steer;
        const velocity = new THREE.Vector2(Math.sin(angle), Math.cos(angle)).multiplyScalar(Math.min(speed, CONFIG.maxThrowSpeed * w));
        lane.ballBody.velocity.copy(velocity);
        lane.state = "rolling";
      };
      const handleCancel = () => {
        if (held) readyBall(held.lane);
        held = null;
      };
      surface.addEventListener("pointerdown", handleDown);
      surface.addEventListener("pointermove", handleMove);
      surface.addEventListener("pointerup", handleUp);
      surface.addEventListener("pointercancel", handleCancel);

      // ── physics (2D on the lane)
      const step = (dt: number) => {
        for (const lane of lanes) {
          const ball = lane.ballBody;
          if (lane.state === "rolling") {
            ball.position.addScaledVector(ball.velocity, dt);
            ball.velocity.multiplyScalar(1 - CONFIG.ballFriction * dt);
            // Off the lane: into the gutter, straight down it, no more pins.
            if (!lane.gutter && Math.abs(ball.position.x - lane.center) > w / 2) {
              lane.gutter = Math.sign(ball.position.x - lane.center);
              ball.velocity.x = 0;
            }
            if (lane.gutter) ball.position.x = lane.center + lane.gutter * (w / 2 + (w * CONFIG.gutterWidth) / 2);
            else for (const pin of lane.pins) collide(ball, CONFIG.ballRadius, CONFIG.ballMass, pin, CONFIG.pinRadius, CONFIG.pinMass);
            if (ball.position.y > L + 0.4 || ball.velocity.length() < 0.15 * w) {
              lane.state = "done";
              lane.resetIn = CONFIG.resetSeconds;
            }
          }

          // Pins: slide, scatter each other, and go down once they move.
          for (let i = 0; i < lane.pins.length; i++) {
            const pin = lane.pins[i];
            pin.position.addScaledVector(pin.velocity, dt);
            pin.velocity.multiplyScalar(Math.max(0, 1 - CONFIG.pinFriction * dt));
            if (pin.down) pin.tip = Math.min(1, pin.tip + dt / CONFIG.tipSeconds);
            for (let j = i + 1; j < lane.pins.length; j++) collide(pin, CONFIG.pinRadius, CONFIG.pinMass, lane.pins[j], CONFIG.pinRadius, CONFIG.pinMass);
          }
          for (const pin of lane.pins) {
            if (!pin.down && pin.velocity.length() > CONFIG.knockSpeed * w) {
              pin.down = true;
              pin.fallDirection.copy(pin.velocity).normalize();
              score(lane);
            }
          }

          if (lane.state === "done") {
            lane.resetIn -= dt;
            if (lane.resetIn <= 0) {
              rackPins(lane);
              readyBall(lane);
            }
          }
        }
      };

      const up = new THREE.Vector3(0, 1, 0);
      const axis = new THREE.Vector3();
      const spin = new THREE.Quaternion();
      let accumulator = 0;

      return {
        resize: () => layout(),
        update: (_time, delta) => {
          accumulator += delta;
          let steps = 0;
          while (accumulator >= CONFIG.physicsStep && steps < 24) {
            step(CONFIG.physicsStep);
            accumulator -= CONFIG.physicsStep;
            steps++;
          }
          for (const lane of lanes) {
            const ball = lane.ballBody;
            lane.ball.position.copy(toWorld3(ball.position.x, ball.position.y, CONFIG.ballRadius - (lane.gutter ? 0.05 : 0)));
            lane.ball.visible = ball.position.y < L + 0.3;
            // Roll: turn about the axis across the motion, by distance travelled.
            const speed = ball.velocity.length();
            if (lane.state === "rolling" && speed > 0) {
              axis.set(ball.velocity.x, 0, -ball.velocity.y).normalize().cross(up).negate();
              spin.setFromAxisAngle(axis, (speed / CONFIG.ballRadius) * delta);
              lane.ball.quaternion.premultiply(spin);
            }

            for (const pin of lane.pins) {
              pin.mesh.position.copy(toWorld3(pin.position.x, pin.position.y));
              // Knocked pins tip over toward where they were hit.
              axis.set(pin.fallDirection.x, 0, -pin.fallDirection.y).cross(up).negate();
              pin.mesh.quaternion.setFromAxisAngle(axis.lengthSq() > 0 ? axis.normalize() : up, (pin.tip * Math.PI) / 2);
            }

            lane.bump = Math.max(0, lane.bump - delta * 4);
            const isSelected = lane.person.id === selectedId;
            lane.halo.visible = isSelected;
            lane.photoRing.color.setHex(isSelected ? COLORS.accent : COLORS.ink);
            lane.photo.position.y = CONFIG.photo.height + Math.sin(lane.bump * Math.PI) * 0.08;
            lane.photo.lookAt(camera.position);
          }
        },
        dispose: () => {
          unsubscribe();
          surface.removeEventListener("pointerdown", handleDown);
          surface.removeEventListener("pointermove", handleMove);
          surface.removeEventListener("pointerup", handleUp);
          surface.removeEventListener("pointercancel", handleCancel);
        },
      };
    },
    container,
  );

export default scene;
