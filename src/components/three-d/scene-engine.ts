import * as THREE from "three";
import type { SceneOptions } from "@/themes/types";

/** Full-screen backgrounds: capped, since they cover the whole (often 3×) phone screen. */
const MAX_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO_LOW_POWER = 1.5;
/** A boxed stage is small, so it renders at (almost) full screen density — always crisp. */
const MAX_PIXEL_RATIO_BOXED = 2.5;
const POINTER_EASE = 0.05;
const MAX_DELTA = 0.1;
/** Height changes below this share of the screen are the mobile browser bars, not a real resize. */
const BAR_JITTER_RATIO = 0.2;

export type StageContext = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Eased pointer in -1..1 (y up). Stays at 0 on touch devices until the first touch. */
  pointer: { x: number; y: number };
  options: SceneOptions;
  /** True on narrow screens, so scenes can pull the camera back. */
  isNarrow: () => boolean;
};

export type StageContent = {
  /** `time` and `delta` are in seconds. */
  update: (time: number, delta: number) => void;
  resize?: (width: number, height: number) => void;
  /** For resources the scene graph traversal can't see (environment maps, render targets). */
  dispose?: () => void;
};

const disposeScene = (scene: THREE.Scene) => {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach((material) => {
      // Textures (photos, canvas-drawn labels) aren't freed by material.dispose().
      Object.values(material).forEach((value) => (value as THREE.Texture | null)?.isTexture && (value as THREE.Texture).dispose());
      material.dispose();
    });
  });
};

/**
 * Shared plumbing for every theme scene: renderer, camera, resize, pointer,
 * render loop that pauses in background tabs, single still frame for
 * reduced motion, and full disposal. A theme only supplies `setup`.
 *
 * Without `container` the canvas is a full-screen background sized to the window.
 * With `container` it is a boxed stage: sized to that element, pointer measured
 * relative to it, and the loop pauses while the stage is scrolled out of view.
 */
export const runStage = (
  canvas: HTMLCanvasElement,
  options: SceneOptions,
  setup: (context: StageContext) => StageContent,
  container?: HTMLElement,
): (() => void) => {
  let renderer: THREE.WebGLRenderer;
  try {
    // Antialiasing stays on everywhere: without it edges turn into visible stairs on phones.
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "default" });
  } catch {
    // No WebGL: the theme's CSS background stays visible.
    canvas.style.display = "none";
    return () => undefined;
  }

  const maxRatio = container ? MAX_PIXEL_RATIO_BOXED : options.lowPower ? MAX_PIXEL_RATIO_LOW_POWER : MAX_PIXEL_RATIO;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const isNarrow = () => window.innerWidth < 720;

  const content = setup({ scene, camera, renderer, pointer, options, isNarrow });

  const size = () =>
    container
      ? { width: container.clientWidth, height: container.clientHeight }
      : // The canvas' own CSS box (100vw × 100lvh) — stable while mobile browser bars move.
        { width: canvas.clientWidth || window.innerWidth, height: canvas.clientHeight || window.innerHeight };

  let last = { width: 0, height: 0 };
  const resize = () => {
    const { width, height } = size();
    if (width === 0 || height === 0) return;
    // Mobile browsers resize the window while scrolling (address bar slides in/out). Re-laying
    // out the scene on each of those made everything jump; only real size changes count:
    // a new width (rotation, desktop resize) or a height change bigger than the browser bars.
    const barJitter = last.width === width && Math.abs(last.height - height) < height * BAR_JITTER_RATIO;
    if ((last.width === width && last.height === height) || barJitter) return;
    last = { width, height };
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    content.resize?.(width, height);
  };

  const timer = new THREE.Timer();
  let elapsed = 0;
  let frame = 0;

  const render = () => {
    timer.update();
    // Accumulate clamped deltas ourselves so a paused tab doesn't make scenes jump ahead.
    const delta = Math.min(timer.getDelta(), MAX_DELTA);
    elapsed += delta;
    pointer.x += (target.x - pointer.x) * POINTER_EASE;
    pointer.y += (target.y - pointer.y) * POINTER_EASE;
    content.update(elapsed, delta);
    renderer.render(scene, camera);
  };

  const loop = () => {
    render();
    frame = requestAnimationFrame(loop);
  };

  let onScreen = true;
  const start = () => {
    if (frame || options.reducedMotion || !onScreen || document.hidden) return;
    timer.update();
    frame = requestAnimationFrame(loop);
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const handlePointerMove = (event: PointerEvent) => {
    // A finger dragging across the screen is a scroll, not a cursor: scenes ignore it.
    if (event.pointerType === "touch") return;
    const rect = container?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    target.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const handleVisibility = () => (document.hidden ? stop() : start());
  const handleResize = () => {
    resize();
    if (options.reducedMotion) render();
  };

  resize();
  if (options.reducedMotion) render();
  start();

  const pointerSource: HTMLElement | Window = container ?? window;
  const resizeObserver = container ? new ResizeObserver(handleResize) : null;
  resizeObserver?.observe(container!);
  // Boxed stages stop rendering once scrolled away — saves battery on phones.
  const visibilityObserver = container
    ? new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      })
    : null;
  visibilityObserver?.observe(container!);

  if (!container) window.addEventListener("resize", handleResize);
  pointerSource.addEventListener("pointermove", handlePointerMove as EventListener, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    stop();
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    if (!container) window.removeEventListener("resize", handleResize);
    pointerSource.removeEventListener("pointermove", handlePointerMove as EventListener);
    document.removeEventListener("visibilitychange", handleVisibility);
    content.dispose?.();
    disposeScene(scene);
    timer.dispose();
    renderer.dispose();
  };
};
