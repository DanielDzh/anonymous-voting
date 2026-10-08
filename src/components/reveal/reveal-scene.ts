import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { faceDisc } from "@/components/three-d/cannon-game";
import { initialsFace, photoTexture } from "@/components/three-d/photo-kit";

/**
 * The results show's stage — a small film set: a mirror floor, roaming spotlights with dust in
 * the beams, glossy pedestals with neon rims, bloom on everything that glows, and a directed
 * camera. React drives it step by step through `setStep`; the scene animates toward each step.
 */

export type RevealCandidate = { id: string; name: string; initials: string; photo: string | null };

/** Screen positions (CSS px) the HTML labels follow every frame. */
export type LabelAnchor = { x: number; baseY: number; topY: number; dim: boolean };

/**
 * "intro": the turnout over the stage; "ready": candidates on short pedestals;
 * "race": everyone rises slowly together, each stops at their result (fewest votes first),
 * the leader keeps going alone, breaks away — and wins.
 */
export type RevealStep = { kind: "intro" } | { kind: "ready" } | { kind: "race"; heights: number[]; winners: number[] };

export type RevealController = {
  setCandidates: (candidates: RevealCandidate[]) => void;
  setStep: (step: RevealStep) => void;
  onFrame: (callback: (anchors: LabelAnchor[]) => void) => void;
  /** Called when a pedestal stops (its result can be shown) and when the winner lands. */
  onProgress: (callback: (stopped: number[], finished: boolean) => void) => void;
};

export const REVEAL_MAX_HEIGHT = 2.9;
/** Race phases in seconds (the music follows them). */
export const REVEAL_RACE = { duel: 7.5, settle: 2.4, breakaway: 1.4 } as const;

const CONFIG = {
  fov: 30,
  spacing: 2.7,
  width: 1.3,
  minHeight: 0.05,
  photoRadius: 0.62,
  /** Where everyone stands before the race (world units). */
  startHeight: 0.35,
  /**
   * The race, in seconds: the pack climbs while the lead changes hands a few times (`duel`),
   * then the others settle one by one onto their results (`settle`), then the leader breaks away.
   */
  race: REVEAL_RACE,
  /** How high the pack climbs during the duel, as a share of the maximum height. */
  packHeight: 0.55,
  /** How far ahead the current leader pulls during the duel (share of the pack height). */
  leadBoost: 0.32,
  // Only truly bright things bloom (rims, beams) — photos and text stay crisp and unblinding.
  bloom: { strength: 0.5, radius: 0.45, threshold: 0.9, flash: 1.2 },
  /** Photos are drawn this much darker than the raw image, so they never glare on a projector. */
  photoBrightness: 0.74,
  dust: 420,
  confetti: 340,
  colors: {
    background: 0x050509,
    pedestal: 0x1a1c28,
    rim: 0xcfd8ff,
    gold: 0xffc94d,
    photoRing: 0x9aa1b4,
    photoRingWinner: 0xd9a93a,
    beam: 0xfff1d8,
    confetti: [0xffc94d, 0xff4f86, 0x4f8dff, 0x2ee6b0, 0xffffff, 0xb57bff],
  },
} as const;

type Pedestal = {
  group: THREE.Group;
  column: THREE.Mesh;
  rim: THREE.Mesh;
  rimMaterial: THREE.MeshStandardMaterial;
  glow: THREE.PointLight;
  photo: THREE.Group;
  ring: THREE.MeshBasicMaterial;
  height: number;
  target: number;
  stopped: boolean;
  dim: number;
};

type Beam = { light: THREE.SpotLight; cone: THREE.Mesh; phase: number; aim: THREE.Vector3 };

const ease = (current: number, target: number, rate: number, delta: number) => current + (target - current) * (1 - Math.exp(-delta * rate));

export const createRevealStage = (canvas: HTMLCanvasElement, reducedMotion: boolean) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.background);
  scene.fog = new THREE.FogExp2(CONFIG.colors.background, 0.035);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0x8a93c8, 0x050507, 0.5));

  // ── mirror floor: a reflector under a dark, slightly see-through glossy plane
  const mirror = new Reflector(new THREE.PlaneGeometry(120, 120), {
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x202230,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -0.002;
  scene.add(mirror);
  const floorTint = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x07070c, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 0.82 }),
  );
  floorTint.rotation.x = -Math.PI / 2;
  scene.add(floorTint);

  // ── spotlights with additive cones (bloom makes them read as volumetric)
  const beams: Beam[] = Array.from({ length: 4 }, (_, index) => {
    const light = new THREE.SpotLight(CONFIG.colors.beam, 90, 40, 0.15, 0.55, 1.3);
    light.position.set((index - 1.5) * 4, 11, 2 + (index % 2) * 2);
    scene.add(light, light.target);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1, 1, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: CONFIG.colors.beam,
        transparent: true,
        opacity: 0.028,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(cone);
    return { light, cone, phase: index * 1.9, aim: new THREE.Vector3(0, 0, 0) };
  });

  // ── dust drifting through the light
  const dustPositions = new Float32Array(CONFIG.dust * 3);
  for (let i = 0; i < CONFIG.dust; i++) dustPositions.set([(Math.random() - 0.5) * 18, Math.random() * 9, (Math.random() - 0.5) * 8], i * 3);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({ color: 0xfff3dc, size: 0.035, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(dust);

  // ── confetti cannons (instanced)
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.08, 0.13),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.15 }),
    CONFIG.confetti,
  );
  const pieces = Array.from({ length: CONFIG.confetti }, (_, index) => ({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
    rotation: new THREE.Euler(),
    color: new THREE.Color(CONFIG.colors.confetti[index % CONFIG.colors.confetti.length]),
  }));
  pieces.forEach((piece, index) => confetti.setColorAt(index, piece.color));
  confetti.visible = false;
  scene.add(confetti);
  const dummy = new THREE.Object3D();

  // ── post-processing: bloom for the glow, output pass for tone mapping / colour space
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), CONFIG.bloom.strength, CONFIG.bloom.radius, CONFIG.bloom.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let pedestals: Pedestal[] = [];
  /** Sizes for the current number of candidates: two get big photos, many get a tighter row. */
  type Dims = { spacing: number; width: number; photoRadius: number };
  let dims: Dims = { spacing: CONFIG.spacing, width: CONFIG.width, photoRadius: CONFIG.photoRadius };
  const dimsFor = (count: number): Dims =>
    count <= 2 ? { spacing: 3.6, width: 1.7, photoRadius: 1.05 } : count === 3 ? { spacing: 3, width: 1.45, photoRadius: 0.82 } : { spacing: dims.spacing, width: dims.width, photoRadius: dims.photoRadius };
  let step: RevealStep = { kind: "intro" };
  let flash = 0;
  let frameCallback: ((anchors: LabelAnchor[]) => void) | null = null;
  let progressCallback: ((stopped: number[], finished: boolean) => void) | null = null;
  let finished = false;
  let raceTime = 0;
  /** Who leads at each moment of the duel: a rotation through everyone, never ending on the winner. */
  let duelOrder: number[] = [];
  /** Height each pedestal held when the settle phase started (they ease from here to the result). */
  const settleFrom: number[] = [];

  const smooth = (t: number) => t * t * (3 - 2 * t);
  /** 0…1 bump: how much `index` leads at duel progress `t` (one smooth bump per turn in front). */
  const leadAt = (index: number, t: number) => {
    const turns = duelOrder.length;
    if (turns === 0) return 0;
    const position = t * turns;
    return duelOrder.reduce((sum, leader, turn) => {
      if (leader !== index) return sum;
      const distance = Math.abs(position - (turn + 0.5));
      return sum + (distance < 1 ? Math.cos(distance * Math.PI) * 0.5 + 0.5 : 0);
    }, 0);
  };

  const clearPedestals = () => {
    pedestals.forEach((pedestal) => {
      scene.remove(pedestal.group);
      pedestal.group.traverse((child) => (child as THREE.Mesh).geometry?.dispose());
    });
    pedestals = [];
  };

  const xOf = (index: number) => (index - (pedestals.length - 1) / 2) * dims.spacing;

  // ── camera direction: each step has a shot; the camera glides between them
  const shot = { position: new THREE.Vector3(0, 5, 18), look: new THREE.Vector3(0, 2, 0) };
  const look = new THREE.Vector3(0, 2, 0);
  const fitDistance = (width: number, height: number) => {
    const vertical = THREE.MathUtils.degToRad(CONFIG.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    return Math.max(height / 2 / Math.tan(vertical), width / 2 / Math.tan(horizontal));
  };
  /**
   * Every shot keeps the whole stage — names under the pedestals, numbers above the photos —
   * in frame; steps differ by gentle moves only (drift, a slight push-in, a lean to the winner).
   */
  const aimShot = (time: number) => {
    const width = Math.max(pedestals.length - 1, 1) * dims.spacing + dims.width + 2.6;
    // Height covers pedestal + photo + room for the HTML numbers above and names below.
    const wide = fitDistance(width, REVEAL_MAX_HEIGHT + dims.photoRadius * 2 + 5);
    // Aim a bit above the middle: the stage sits lower, leaving the top for the title and banner.
    const lookY = (REVEAL_MAX_HEIGHT + dims.photoRadius * 2) / 2 + 0.9;
    // Slow drift; once the winner lands, lean a little toward them.
    const middle = finished && step.kind === "race" ? step.winners.reduce((sum, index) => sum + xOf(index), 0) / Math.max(step.winners.length, 1) : 0;
    const sway = Math.sin(time * 0.12) * 0.08;
    shot.position.set(middle * 0.15 + Math.sin(sway) * wide, 3.4, Math.cos(sway) * wide);
    shot.look.set(middle * 0.15, lookY, 0);
  };


  const controller: RevealController = {
    setCandidates: (candidates) => {
      clearPedestals();
      dims = dimsFor(candidates.length);
      pedestals = candidates.map((candidate, index) => {
        const group = new THREE.Group();
        const column = new THREE.Mesh(
          new RoundedBoxGeometry(dims.width, 1, dims.width, 4, 0.08),
          new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.pedestal, metalness: 0.75, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 }),
        );
        const rimMaterial = new THREE.MeshStandardMaterial({ color: CONFIG.colors.rim, emissive: CONFIG.colors.rim, emissiveIntensity: 0.45 });
        const rim = new THREE.Mesh(new THREE.BoxGeometry(dims.width * 1.02, 0.045, dims.width * 1.02), rimMaterial);
        const glow = new THREE.PointLight(CONFIG.colors.rim, 4, 4, 1.6);

        const photo = new THREE.Group();
        const face = candidate.photo ? photoTexture(candidate.photo) : initialsFace(candidate.initials, index);
        const ring = new THREE.MeshBasicMaterial({ color: CONFIG.colors.photoRing });
        const disc = faceDisc(face, 0.92, 0.01);
        // Dimmed and tone-mapped like the rest of the scene, so the face doesn't glare.
        const discMaterial = disc.material as THREE.MeshBasicMaterial;
        discMaterial.color.setScalar(CONFIG.photoBrightness);
        discMaterial.toneMapped = true;
        // Drawn after the (transparent) light beams and without fog, so the face stays clear.
        // Transparent so it joins the same render list as the beams, where renderOrder applies.
        discMaterial.fog = false;
        discMaterial.depthTest = false;
        discMaterial.transparent = true;
        disc.renderOrder = 10;
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.04, 96), ring);
        ring.fog = false;
        ring.depthTest = false;
        ring.transparent = true;
        ringMesh.renderOrder = 10;
        photo.add(ringMesh, disc);
        photo.scale.setScalar(dims.photoRadius);

        group.add(column, rim, glow, photo);
        group.position.x = (index - (candidates.length - 1) / 2) * dims.spacing;
        scene.add(group);
        return { group, column, rim, rimMaterial, glow, photo, ring, height: CONFIG.startHeight, target: CONFIG.startHeight, stopped: false, dim: 0 };
      });
    },
    setStep: (next) => {
      step = next;
      finished = false;
      raceTime = 0;
      if (next.kind === "race") {
        // Everyone takes a turn in front (non-winners twice when there are only two), the winner
        // gets a turn too but never the last one — they come from behind at the end.
        const others = pedestals.map((_, index) => index).filter((index) => !next.winners.includes(index));
        const pool = others.length > 0 ? others : pedestals.map((_, index) => index);
        const rounds = pedestals.length <= 2 ? 2 : 1;
        duelOrder = [];
        for (let round = 0; round < rounds; round++) {
          pool.forEach((index, order) => {
            duelOrder.push(index);
            if (order === 0 && next.winners[0] !== undefined) duelOrder.push(next.winners[0]);
          });
        }
        if (next.winners.includes(duelOrder[duelOrder.length - 1]) && pool.length > 0) duelOrder.push(pool[0]);
      }
      pedestals.forEach((pedestal, index) => {
        pedestal.stopped = false;
        pedestal.target = next.kind === "race" ? Math.max(CONFIG.startHeight, Math.min(next.heights[index] ?? 0, REVEAL_MAX_HEIGHT)) : CONFIG.startHeight;
      });
      progressCallback?.([], false);
    },
    onFrame: (callback) => {
      frameCallback = callback;
    },
    onProgress: (callback) => {
      progressCallback = callback;
    },
  };

  const land = () => {
    finished = true;
    flash = 1;
    // Two confetti cannons fire up from the stage corners.
    const spread = (Math.max(pedestals.length - 1, 1) * dims.spacing) / 2 + 1.5;
    pieces.forEach((piece, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      piece.position.set(side * spread, 0.2, 0.5);
      piece.velocity.set(-side * (1.5 + Math.random() * 2.5), 7 + Math.random() * 5, (Math.random() - 0.5) * 3);
    });
  };

  // ── loop
  const timer = new THREE.Timer();
  let elapsed = 0;
  let frame = 0;
  const beamDirection = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const projected = new THREE.Vector3();
  const toScreen = (point: THREE.Vector3) => {
    projected.copy(point).project(camera);
    return { x: ((projected.x + 1) / 2) * canvas.clientWidth, y: ((1 - projected.y) / 2) * canvas.clientHeight };
  };

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.resolution.set(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const render = () => {
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.1);
    elapsed += delta;
    const leaders = step.kind === "race" ? step.winners : [];
    const winners = finished ? leaders : [];
    const racing = step.kind === "race" && !finished;
    // The leader breaks away once everyone else has stopped.
    const others = pedestals.filter((_, index) => !leaders.includes(index));
    if (racing) raceTime += delta;
    const breakaway = racing && raceTime >= CONFIG.race.duel && others.every((pedestal) => pedestal.stopped);
    let changed = false;

    pedestals.forEach((pedestal, index) => {
      if (step.kind === "race") {
        const { duel, settle, breakaway: breakawayTime } = CONFIG.race;
        const isLeader = leaders.includes(index);
        if (raceTime < duel) {
          // The duel: the pack climbs together, the lead changes hands.
          const t = raceTime / duel;
          const pack = CONFIG.startHeight + (REVEAL_MAX_HEIGHT * CONFIG.packHeight - CONFIG.startHeight) * smooth(t);
          pedestal.height = pack * (1 + CONFIG.leadBoost * leadAt(index, t) * Math.sin(Math.PI * Math.min(t * 1.15, 1)));
          settleFrom[index] = pedestal.height;
        } else if (!isLeader) {
          // The others land on their results, fewest votes first.
          const order = [...others].sort((a, b) => a.target - b.target).indexOf(pedestal);
          const slot = settle / Math.max(others.length, 1);
          const local = THREE.MathUtils.clamp((raceTime - duel - order * slot) / slot, 0, 1);
          pedestal.height = THREE.MathUtils.lerp(settleFrom[index] ?? pedestal.height, pedestal.target, smooth(local));
          if (local >= 1 && !pedestal.stopped) {
            pedestal.stopped = true;
            changed = true;
          }
        } else if (breakaway) {
          // The breakaway: the leader shoots up to the top.
          const startedAt = duel + (others.length > 0 ? settle : 0);
          const local = THREE.MathUtils.clamp((raceTime - startedAt) / breakawayTime, 0, 1);
          const eased = 1 - (1 - local) ** 3;
          pedestal.height = THREE.MathUtils.lerp(settleFrom[index] ?? pedestal.height, pedestal.target, eased);
          if (local >= 1 && !pedestal.stopped) {
            pedestal.stopped = true;
            changed = true;
          }
        }
      } else {
        pedestal.height = ease(pedestal.height, CONFIG.startHeight, 3, delta);
      }
      const height = Math.max(pedestal.height, CONFIG.minHeight);
      pedestal.column.scale.y = height;
      pedestal.column.position.y = height / 2;
      pedestal.rim.position.y = height + 0.02;
      pedestal.glow.position.y = height + 0.4;

      // Photos face the camera from the very start, full size.
      pedestal.photo.position.y = height + dims.photoRadius + 0.22;
      pedestal.photo.lookAt(camera.position);
      const winning = winners.includes(index);
      const scale = dims.photoRadius * (winning ? 1.15 : 1);
      pedestal.photo.scale.setScalar(ease(pedestal.photo.scale.x, scale, 6, delta));

      // Winner glows gold; the others dim a little once the winner is known.
      pedestal.dim = ease(pedestal.dim, finished && !winning ? 1 : 0, 3, delta);
      const rimColor = winning ? CONFIG.colors.gold : CONFIG.colors.rim;
      pedestal.rimMaterial.color.setHex(rimColor);
      pedestal.rimMaterial.emissive.setHex(rimColor);
      pedestal.rimMaterial.emissiveIntensity = winning ? 1.3 + Math.sin(elapsed * 5) * 0.25 : 0.45 * (1 - pedestal.dim * 0.6);
      pedestal.glow.color.setHex(rimColor);
      pedestal.glow.intensity = winning ? 5 : 1.5 * (1 - pedestal.dim * 0.8);
      pedestal.ring.color.setHex(winning ? CONFIG.colors.photoRingWinner : CONFIG.colors.photoRing);
    });

    if (step.kind === "race" && !finished && pedestals.length > 0 && pedestals.every((pedestal) => pedestal.stopped)) {
      land();
      changed = true;
    }
    if (changed) progressCallback?.(pedestals.flatMap((pedestal, index) => (pedestal.stopped ? [index] : [])), finished);

    // Spotlights roam; during the race they sweep fast; on the winner they lock on.
    const span = Math.max(pedestals.length - 1, 1) * dims.spacing * 0.6 + 1.5;
    // Beams sweep faster during the race — the drumroll.
    const speed = racing ? 1.4 : 0.7;
    beams.forEach((beam, index) => {
      // During the breakaway two beams chase the leader; once they win, all lock on.
      const lockOn = winners.length > 0 ? winners : breakaway && index < 2 ? leaders : [];
      const target = lockOn.length > 0 ? pedestals[lockOn[index % lockOn.length]] : null;
      const goal = target
        ? new THREE.Vector3(target.group.position.x, target.height, 0)
        : new THREE.Vector3(Math.sin(elapsed * speed + beam.phase) * span, 0, Math.cos(elapsed * speed * 0.7 + beam.phase * 2) * 1.5);
      beam.aim.lerp(goal, 1 - Math.exp(-delta * (target ? 5 : 2.5)));
      beam.light.target.position.copy(beam.aim);
      beam.light.intensity = target ? 110 : 70;
      beamDirection.subVectors(beam.aim, beam.light.position);
      const length = beamDirection.length();
      const radius = Math.tan(beam.light.angle) * length;
      beam.cone.scale.set(radius, length, radius);
      beam.cone.position.copy(beam.light.position).addScaledVector(beamDirection, 0.5);
      beam.cone.quaternion.setFromUnitVectors(up, beamDirection.normalize().negate());
    });

    // Dust drifts up slowly.
    const positions = dustGeometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < CONFIG.dust; i++) {
      let y = positions.getY(i) + delta * 0.12;
      if (y > 9) y = 0;
      positions.setY(i, y);
      positions.setX(i, positions.getX(i) + Math.sin(elapsed * 0.3 + i) * delta * 0.05);
    }
    positions.needsUpdate = true;

    // Confetti: burst up, then flutter down.
    confetti.visible = finished;
    if (confetti.visible) {
      pieces.forEach((piece, index) => {
        piece.velocity.y -= 9 * delta;
        piece.velocity.multiplyScalar(1 - 1.4 * delta);
        if (piece.velocity.y < -1.6) piece.velocity.y = -1.6;
        piece.velocity.x += Math.sin(elapsed * 3 + index) * delta * 0.8;
        piece.position.addScaledVector(piece.velocity, delta);
        if (piece.position.y < 0) {
          piece.position.set((Math.random() - 0.5) * span * 2, 8 + Math.random() * 3, (Math.random() - 0.5) * 3);
          piece.velocity.set(0, -1, 0);
        }
        piece.rotation.x += piece.spin.x * delta;
        piece.rotation.y += piece.spin.y * delta;
        dummy.position.copy(piece.position);
        dummy.rotation.copy(piece.rotation);
        dummy.updateMatrix();
        confetti.setMatrixAt(index, dummy.matrix);
      });
      confetti.instanceMatrix.needsUpdate = true;
    }

    // Winner flash: a bloom spike that settles.
    flash = Math.max(0, flash - delta * 1.2);
    bloom.strength = CONFIG.bloom.strength + flash * CONFIG.bloom.flash;

    aimShot(elapsed);
    const glide = 0.9;
    camera.position.lerp(shot.position, 1 - Math.exp(-delta * glide));
    look.lerp(shot.look, 1 - Math.exp(-delta * glide));
    camera.lookAt(look);

    composer.render();

    frameCallback?.(
      pedestals.map((pedestal) => {
        const base = toScreen(new THREE.Vector3(pedestal.group.position.x, 0, dims.width / 2 + 0.2));
        const top = toScreen(new THREE.Vector3(pedestal.group.position.x, pedestal.photo.position.y + dims.photoRadius * 1.25, 0));
        return { x: base.x, baseY: base.y, topY: top.y, dim: pedestal.dim > 0.5 };
      }),
    );
  };

  const loop = () => {
    render();
    frame = requestAnimationFrame(loop);
  };
  if (reducedMotion) render();
  else loop();

  return {
    controller,
    dispose: () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      clearPedestals();
      composer.dispose();
      environment.dispose();
      pmrem.dispose();
      mirror.dispose();
      renderer.dispose();
    },
  };
};
