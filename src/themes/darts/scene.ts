import * as THREE from "three";
import { initialsFace, onCandidateSelected, photoTexture } from "@/components/three-d/photo-kit";
import { runStage } from "@/components/three-d/scene-engine";
import { CANDIDATE_SELECTED_EVENT, GAME_POINT_EVENT, GAME_SCORES_EVENT, SELECT_CANDIDATE_REQUEST_EVENT } from "@/config/visuals";
import type { StagePerson, ThemeScene } from "../types";
import { COLORS } from "../fair/minimal-look";

/**
 * 22 · Дартс — a real dartboard (standard proportions, colours and numbering) in minimal 3D.
 * Each candidate owns ONE sector, with their photo on it (cropped to the wedge, not warped);
 * the rest of the board scores nothing. Hit a candidate's sector: single 1, treble 3, double 2.
 * Swipe up to throw: a faster swipe lands higher, a tilted one drifts sideways. Most points wins
 * the vote (a tie chooses nobody). Darts stay stuck in the board.
 */

/** Standard board, in millimetres from the centre. */
const BOARD_MM = {
  bull: 6.35,
  outerBull: 15.9,
  trebleInner: 99,
  trebleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
  /** The black surround carrying the numbers. */
  surround: 225,
} as const;

/** Clockwise from the top. */
const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const SECTOR = (Math.PI * 2) / NUMBERS.length;

const BOARD_COLORS = {
  black: "#1b1b1b",
  cream: "#efe2c2",
  red: "#d0312d",
  green: "#1f8a4c",
  wire: "#c9c9c9",
  numbers: "#ffffff",
} as const;

const CONFIG = {
  fov: 38,
  /** World radius of the whole board (surround included). */
  boardRadius: 1.5,
  points: { single: 1, treble: 3, double: 2 },
  /** Where the dart waits, relative to the board centre (world units). */
  dartStart: new THREE.Vector3(0, -2.25, 1.4),
  flightSeconds: 0.42,
  arcHeight: 0.3,
  /**
   * Swipe → landing point. Finger speed is in stage heights/s; `aimSpeed` lands on the board
   * centre, each stage height/s more or less moves the landing by `liftPerSpeed` (world units).
   */
  aimSpeed: 2.4,
  liftPerSpeed: 0.55,
  sidePerSpeed: 0.55,
  minSwipeSpeed: 0.8,
  swipeWindowMs: 90,
  maxStuckDarts: 9,
} as const;

type Flight = { dart: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t: number };

/** Centre angle (radians, counter-clockwise from +x) of sector `index` (0 = the 20 at the top). */
const sectorAngle = (index: number) => Math.PI / 2 - index * SECTOR;

/**
 * Ring segment whose UVs crop the photo into `box` (the whole sector's square box), so the
 * photo pieces either side of the treble ring line up as one picture, upright and not warped.
 */
const wedgeGeometry = (inner: number, outer: number, start: number, length: number, box: THREE.Box2) => {
  const geometry = new THREE.RingGeometry(inner, outer, 16, 2, start, length);
  const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
  const center = box.getCenter(new THREE.Vector2());
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) - center.x) / size + 0.5, (position.getY(i) - center.y) / size + 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
};

/** The printed face of a standard board, drawn once into a texture. */
const boardTexture = () => {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const c = size / 2;
  const mm = c / BOARD_MM.surround;
  const ring = (inner: number, outer: number, index: number, color: string) => {
    // Canvas angles run clockwise from +x; sector centres are mirrored from the math ones.
    const middle = -sectorAngle(index);
    context.beginPath();
    context.arc(c, c, outer * mm, middle - SECTOR / 2, middle + SECTOR / 2);
    context.arc(c, c, inner * mm, middle + SECTOR / 2, middle - SECTOR / 2, true);
    context.closePath();
    context.fillStyle = color;
    context.fill();
  };
  context.fillStyle = BOARD_COLORS.black;
  context.beginPath();
  context.arc(c, c, BOARD_MM.surround * mm, 0, Math.PI * 2);
  context.fill();
  NUMBERS.forEach((_number, index) => {
    // The 20 is black with red rings; colours alternate from there.
    const dark = index % 2 === 0;
    const single = dark ? BOARD_COLORS.black : BOARD_COLORS.cream;
    const scoring = dark ? BOARD_COLORS.red : BOARD_COLORS.green;
    ring(BOARD_MM.outerBull, BOARD_MM.trebleInner, index, single);
    ring(BOARD_MM.trebleInner, BOARD_MM.trebleOuter, index, scoring);
    ring(BOARD_MM.trebleOuter, BOARD_MM.doubleInner, index, single);
    ring(BOARD_MM.doubleInner, BOARD_MM.doubleOuter, index, scoring);
  });
  context.fillStyle = BOARD_COLORS.green;
  context.beginPath();
  context.arc(c, c, BOARD_MM.outerBull * mm, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = BOARD_COLORS.red;
  context.beginPath();
  context.arc(c, c, BOARD_MM.bull * mm, 0, Math.PI * 2);
  context.fill();

  // Wires.
  context.strokeStyle = BOARD_COLORS.wire;
  context.lineWidth = 2;
  [BOARD_MM.bull, BOARD_MM.outerBull, BOARD_MM.trebleInner, BOARD_MM.trebleOuter, BOARD_MM.doubleInner, BOARD_MM.doubleOuter].forEach((r) => {
    context.beginPath();
    context.arc(c, c, r * mm, 0, Math.PI * 2);
    context.stroke();
  });
  NUMBERS.forEach((_number, index) => {
    const edge = -sectorAngle(index) - SECTOR / 2;
    context.beginPath();
    context.moveTo(c + Math.cos(edge) * BOARD_MM.outerBull * mm, c + Math.sin(edge) * BOARD_MM.outerBull * mm);
    context.lineTo(c + Math.cos(edge) * BOARD_MM.doubleOuter * mm, c + Math.sin(edge) * BOARD_MM.doubleOuter * mm);
    context.stroke();
  });

  // Numbers, upright, on the surround.
  context.fillStyle = BOARD_COLORS.numbers;
  context.font = `600 ${Math.round(26 * mm)}px Inter, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  NUMBERS.forEach((number, index) => {
    const angle = -sectorAngle(index);
    const r = ((BOARD_MM.doubleOuter + BOARD_MM.surround) / 2) * mm;
    context.fillText(String(number), c + Math.cos(angle) * r, c + Math.sin(angle) * r);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const buildDart = () => {
  // Tip at the origin pointing -z (into the board); the body trails behind along +z.
  const dart = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.8, roughness: 0.3 });
  const ink = new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.4 });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.14, 10), steel);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = 0.07;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 12), ink);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.25;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), ink);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.46;
  dart.add(tip, barrel, shaft);
  const flightMaterial = new THREE.MeshStandardMaterial({ color: COLORS.accent, side: THREE.DoubleSide, roughness: 0.6 });
  [0, Math.PI / 2].forEach((angle) => {
    const flight = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), flightMaterial);
    flight.rotation.set(Math.PI / 2, 0, angle);
    flight.position.z = 0.56;
    dart.add(flight);
  });
  dart.traverse((child) => {
    child.castShadow = true;
  });
  return dart;
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
      stage.add(new THREE.HemisphereLight(0xffffff, 0xd8cfbf, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(-2, 3, 5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.bias = -0.0005;
      stage.add(sun);

      const people: StagePerson[] = options.people?.length
        ? options.people
        : options.photos.map((photo, index) => ({ id: String(index), initials: "", photo }));
      const count = Math.max(people.length, 1);
      const R = CONFIG.boardRadius;

      // Wall that catches the board's and the darts' shadows.
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: COLORS.paper, roughness: 1 }));
      wall.position.z = -0.2;
      wall.receiveShadow = true;
      stage.add(wall);

      const board = new THREE.Group();
      stage.add(board);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.12, 96), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }));
      back.rotation.x = Math.PI / 2;
      back.position.z = -0.06;
      back.castShadow = true;
      const face = new THREE.Mesh(new THREE.CircleGeometry(R, 128), new THREE.MeshBasicMaterial({ map: boardTexture(), toneMapped: false }));
      face.position.z = 0.005;
      board.add(back, face);

      // Board millimetres → world units.
      const mm = R / BOARD_MM.surround;
      // Candidates' sectors, spread evenly round the board (2 → the 20 and the 3).
      const ownedSectors = people.map((_person, index) => Math.round((index * NUMBERS.length) / count) % NUMBERS.length);
      const outlineMaterials = people.map(() => new THREE.MeshBasicMaterial({ color: COLORS.paper }));
      people.forEach((person, index) => {
        const sector = ownedSectors[index];
        const start = sectorAngle(sector) - SECTOR / 2;
        const photoMap = person.photo ? photoTexture(person.photo) : initialsFace(person.initials, index);
        const material = new THREE.MeshBasicMaterial({ map: photoMap, toneMapped: false });
        // The photo covers both single areas; the treble and double rings stay visible between them.
        const box = new THREE.Box2();
        const probe = new THREE.RingGeometry(BOARD_MM.outerBull * mm, BOARD_MM.doubleOuter * mm, 16, 1, start, SECTOR);
        probe.computeBoundingBox();
        box.min.set(probe.boundingBox!.min.x, probe.boundingBox!.min.y);
        box.max.set(probe.boundingBox!.max.x, probe.boundingBox!.max.y);
        probe.dispose();
        [
          [BOARD_MM.outerBull, BOARD_MM.trebleInner],
          [BOARD_MM.trebleOuter, BOARD_MM.doubleInner],
        ].forEach(([inner, outer]) => {
          const piece = new THREE.Mesh(wedgeGeometry(inner * mm, outer * mm, start, SECTOR, box), material);
          piece.position.z = 0.012;
          board.add(piece);
        });
        // Outline round the whole sector: light normally, red for the leader.
        const outline = outlineMaterials[index];
        const thickness = 0.014;
        [BOARD_MM.outerBull, BOARD_MM.doubleOuter].forEach((r) => {
          const arc = new THREE.Mesh(new THREE.RingGeometry(r * mm - thickness / 2, r * mm + thickness / 2, 12, 1, start, SECTOR), outline);
          arc.position.z = 0.016;
          board.add(arc);
        });
        [start, start + SECTOR].forEach((edge) => {
          const length = (BOARD_MM.doubleOuter - BOARD_MM.outerBull) * mm;
          const side = new THREE.Mesh(new THREE.PlaneGeometry(length, thickness), outline);
          const middle = ((BOARD_MM.doubleOuter + BOARD_MM.outerBull) / 2) * mm;
          side.position.set(Math.cos(edge) * middle, Math.sin(edge) * middle, 0.016);
          side.rotation.z = edge;
          board.add(side);
        });
      });

      // ── darts
      const waiting = buildDart();
      stage.add(waiting);
      const stuck: THREE.Group[] = [];
      let flight: Flight | null = null;

      // ── scoring
      const scores: Record<string, number> = Object.fromEntries(people.map((person) => [person.id, 0]));
      const announceScores = () => window.dispatchEvent(new CustomEvent(GAME_SCORES_EVENT, { detail: { scores: { ...scores } } }));
      setTimeout(announceScores, 0);
      let pulse = 0;
      const land = (point: THREE.Vector3) => {
        const r = Math.hypot(point.x, point.y) / mm;
        if (r < BOARD_MM.outerBull || r > BOARD_MM.doubleOuter) return;
        // Which numbered sector: angle from the top, clockwise, rounded to the nearest centre.
        const fromTop = Math.PI / 2 - Math.atan2(point.y, point.x);
        const sector = ((Math.round(fromTop / SECTOR) % NUMBERS.length) + NUMBERS.length) % NUMBERS.length;
        const ownerIndex = ownedSectors.indexOf(sector);
        if (ownerIndex < 0) return;
        const owner = people[ownerIndex];
        const inTreble = r >= BOARD_MM.trebleInner && r <= BOARD_MM.trebleOuter;
        const inDouble = r >= BOARD_MM.doubleInner;
        const points = inTreble ? CONFIG.points.treble : inDouble ? CONFIG.points.double : CONFIG.points.single;
        scores[owner.id] += points;
        window.dispatchEvent(new CustomEvent(GAME_POINT_EVENT, { detail: { candidateId: owner.id, points: points } }));
        pulse = 1;
        announceScores();
        const best = Math.max(...Object.values(scores));
        const leaders = people.filter((person) => scores[person.id] === best);
        window.dispatchEvent(
          new CustomEvent(SELECT_CANDIDATE_REQUEST_EVENT, {
            detail:
              leaders.length === 1 ? { candidateId: leaders[0].id } : { candidateId: null, among: people.map((person) => person.id) },
          }),
        );
      };

      let selectedId: string | null = null;
      const unsubscribe = onCandidateSelected(CANDIDATE_SELECTED_EVENT, (_photo, candidateId) => {
        selectedId = candidateId;
      });

      // ── swipe to throw
      const surface = container ?? canvas;
      type Sample = { x: number; y: number; time: number };
      let swipe: { pointerId: number; samples: Sample[] } | null = null;
      const handleDown = (event: PointerEvent) => {
        if (flight) return;
        surface.setPointerCapture?.(event.pointerId);
        swipe = { pointerId: event.pointerId, samples: [{ x: event.clientX, y: event.clientY, time: event.timeStamp }] };
      };
      const handleMove = (event: PointerEvent) => {
        if (!swipe || event.pointerId !== swipe.pointerId) return;
        swipe.samples.push({ x: event.clientX, y: event.clientY, time: event.timeStamp });
        if (swipe.samples.length > 30) swipe.samples.shift();
      };
      const handleUp = (event: PointerEvent) => {
        if (!swipe || event.pointerId !== swipe.pointerId) return;
        const { samples } = swipe;
        swipe = null;
        const last = samples[samples.length - 1];
        const first = samples.find((sample) => last.time - sample.time <= CONFIG.swipeWindowMs) ?? samples[0];
        const seconds = Math.max((last.time - first.time) / 1000, 0.016);
        const height = surface.getBoundingClientRect().height || 1;
        const up = (first.y - last.y) / height / seconds;
        const side = (last.x - first.x) / height / seconds;
        if (up < CONFIG.minSwipeSpeed) return;
        const to = new THREE.Vector3(
          side * CONFIG.sidePerSpeed,
          (up - CONFIG.aimSpeed) * CONFIG.liftPerSpeed,
          0.07,
        );
        flight = { dart: waiting, from: CONFIG.dartStart.clone(), to, t: 0 };
      };
      const handleCancel = () => {
        swipe = null;
      };
      surface.addEventListener("pointerdown", handleDown);
      surface.addEventListener("pointermove", handleMove);
      surface.addEventListener("pointerup", handleUp);
      surface.addEventListener("pointercancel", handleCancel);

      /**
       * Frame the board and the waiting dart, whatever the stage's shape. The camera sits a little
       * below and to the side, so stuck darts stand out of the board instead of hiding end-on.
       */
      const layout = () => {
        const target = new THREE.Vector3(0, -0.45, 0);
        const direction = new THREE.Vector3(0.22, -0.3, 1).normalize();
        const corners = [
          new THREE.Vector3(-R * 1.05, R * 1.05, 0),
          new THREE.Vector3(R * 1.05, R * 1.05, 0),
          new THREE.Vector3(-R * 1.05, -R, 0),
          new THREE.Vector3(R * 1.05, -R, 0),
          CONFIG.dartStart.clone().add(new THREE.Vector3(0, -0.25, 0)),
        ];
        const ndc = new THREE.Vector3();
        for (let distance = 4; distance < 40; distance += 0.1) {
          camera.position.copy(target).addScaledVector(direction, distance);
          camera.lookAt(target);
          camera.updateMatrixWorld();
          camera.updateProjectionMatrix();
          if (corners.every((corner) => (ndc.copy(corner).project(camera), Math.abs(ndc.x) < 0.94 && Math.abs(ndc.y) < 0.94))) break;
        }
      };

      const resetWaiting = () => {
        waiting.position.copy(CONFIG.dartStart);
        // Tilted up toward the board, so it reads as a dart, not a dot.
        waiting.rotation.set(1.0, -0.15, 0);
      };
      resetWaiting();

      return {
        resize: () => layout(),
        update: (time, delta) => {
          if (flight) {
            flight.t = Math.min(1, flight.t + delta / CONFIG.flightSeconds);
            const { from, to, t } = flight;
            const position = new THREE.Vector3().lerpVectors(from, to, t);
            position.y += Math.sin(t * Math.PI) * CONFIG.arcHeight;
            const ahead = new THREE.Vector3().lerpVectors(from, to, Math.min(1, t + 0.05));
            ahead.y += Math.sin(Math.min(1, t + 0.05) * Math.PI) * CONFIG.arcHeight;
            flight.dart.position.copy(position);
            // Point the tip (-z) along the flight.
            flight.dart.lookAt(position.clone().multiplyScalar(2).sub(ahead));
            if (t >= 1) {
              const dart = flight.dart.clone();
              dart.position.copy(to);
              dart.rotation.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, Math.random() * Math.PI);
              stage.add(dart);
              stuck.push(dart);
              if (stuck.length > CONFIG.maxStuckDarts) stage.remove(stuck.shift()!);
              land(to);
              flight = null;
              resetWaiting();
            }
          } else {
            // The waiting dart bobs gently, inviting a throw.
            waiting.position.y = CONFIG.dartStart.y + Math.sin(time * 2) * 0.03;
          }
          pulse = Math.max(0, pulse - delta * 5);
          board.scale.setScalar(1 + Math.sin(pulse * Math.PI) * 0.015);
          people.forEach((person, index) => outlineMaterials[index].color.setHex(person.id === selectedId ? COLORS.accent : COLORS.paper));
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
