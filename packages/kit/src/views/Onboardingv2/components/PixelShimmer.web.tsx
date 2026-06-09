/* eslint-disable max-classes-per-file -- vendored pixel-canvas algorithm: Pixel and its controller are one cohesive unit */
import { useEffect, useRef } from 'react';

import type { IPixelShimmerProps } from './PixelShimmer.types';

/**
 * Clerk-style pixel shimmer for web + desktop card hovers.
 *
 * Vendored from Ryan Mulligan's `pixel-canvas` web component
 * (MIT, © 2024 Ryan Mulligan — https://github.com/hexagoncircle/pixel-canvas),
 * itself a reverse-engineering of clerk.com. Re-implemented as a React
 * component instead of a global `customElements.define`, with two additions the
 * original lacks:
 *   - devicePixelRatio scaling (capped at 2) so the squares stay crisp on
 *     retina/4K. The grid, per-pixel delay and counterStep are all computed in
 *     CSS px, so the centre-out spread rhythm is identical regardless of dpr.
 *   - SSR-safe lifecycle: every DOM / `window` access lives inside useEffect.
 *
 * Renders a single absolute, pointer-events:none, aria-hidden <canvas>. Hover
 * and focus are read from the canvas's parentElement, so the host card must be
 * position:relative; overflow:hidden.
 */

const DEFAULT_COLORS = ['#32B826', '#3EDC2F', '#56BF4C', '#88D380'];

// Top-dense, bottom-fading veil ("上密下疏"). This is a CSS mask, not canvas
// logic — the canvas itself paints an even field.
const MASK_IMAGE =
  'linear-gradient(to bottom, #000 0%, #000 10%, transparent 92%)';

const MAX_DPR = 2;
const FRAME_INTERVAL = 1000 / 60;
const GAP_MIN = 4;
const GAP_MAX = 50;
const SPEED_THROTTLE = 0.001;
// Per-pixel size bounds (constant for every pixel, so kept at module scope).
const MIN_SIZE = 0.5;
const MAX_SIZE_INTEGER = 2;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

function distanceToCenter(x: number, y: number, width: number, height: number) {
  const dx = x - width / 2;
  const dy = y - height / 2;
  return Math.sqrt(dx * dx + dy * dy);
}

type IAnimationName = 'appear' | 'disappear';

// One square. Only its `size` animates: grows in → shimmers → shrinks out.
class Pixel {
  private readonly ctx: CanvasRenderingContext2D;

  private readonly x: number;

  private readonly y: number;

  private readonly color: string;

  private readonly speed: number;

  private readonly maxSize = rand(MIN_SIZE, MAX_SIZE_INTEGER);

  private readonly sizeStep = Math.random() * 0.4;

  private readonly counterStep: number;

  private readonly delay: number;

  private size = 0;

  private counter = 0;

  private isReverse = false;

  private isShimmer = false;

  isIdle = false;

  constructor(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number,
    fieldWidth: number,
    fieldHeight: number,
  ) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = rand(0.1, 0.9) * speed;
    this.delay = delay;
    this.counterStep = Math.random() * 4 + (fieldWidth + fieldHeight) * 0.01;
  }

  private draw() {
    const centerOffset = MAX_SIZE_INTEGER * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(
      this.x + centerOffset,
      this.y + centerOffset,
      this.size,
      this.size,
    );
  }

  appear() {
    this.isIdle = false;

    // Centre-out spread: nearer-the-centre pixels have a smaller delay, so they
    // start growing first.
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }

    if (this.size >= this.maxSize) {
      this.isShimmer = true;
    }

    if (this.isShimmer) {
      this.shimmer();
    } else {
      this.size += this.sizeStep;
    }

    this.draw();
  }

  disappear() {
    this.isShimmer = false;
    this.counter = 0;

    if (this.size <= 0) {
      this.isIdle = true;
      return;
    }

    this.size -= 0.1;
    this.draw();
  }

  private shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true;
    } else if (this.size <= MIN_SIZE) {
      this.isReverse = false;
    }

    this.size += this.isReverse ? -this.speed : this.speed;
  }
}

interface IControllerOptions {
  colors: string[];
  gap: number;
  speed: number;
  playOnFocus: boolean;
  autoPlay: boolean;
}

// Drives one canvas: lays out the pixel grid (dpr-aware), wires hover/focus on
// the host element, and runs the rAF loop throttled to ~60fps.
class PixelShimmerController {
  private readonly canvas: HTMLCanvasElement;

  private readonly host: HTMLElement;

  private readonly ctx: CanvasRenderingContext2D;

  private readonly colors: string[];

  private readonly gap: number;

  private readonly pixelSpeed: number;

  private readonly playOnFocus: boolean;

  private readonly autoPlay: boolean;

  private readonly reducedMotion: boolean;

  private readonly resizeObserver: ResizeObserver;

  private pixels: Pixel[] = [];

  private cssWidth = 0;

  private cssHeight = 0;

  private rafId = 0;

  // The hover/focus state the loop is currently driving, so a layout change
  // (ResizeObserver -> init) can resume it against the freshly-built grid.
  private activeAnimation: IAnimationName | null = null;

  private timePrevious: number;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    host: HTMLElement,
    options: IControllerOptions,
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.host = host;
    this.colors = options.colors;
    this.gap = clamp(Math.floor(options.gap), GAP_MIN, GAP_MAX);
    this.playOnFocus = options.playOnFocus;
    this.autoPlay = options.autoPlay;
    this.reducedMotion = globalThis.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.pixelSpeed = this.reducedMotion
      ? 0
      : clamp(options.speed, 0, 100) * SPEED_THROTTLE;
    this.timePrevious = performance.now();

    // observe() always fires the callback once with the initial size, and that
    // does the first grid build — so we deliberately don't call init() eagerly
    // here (that would build the whole grid twice on mount).
    this.resizeObserver = new ResizeObserver(() => this.init());
    this.resizeObserver.observe(canvas);

    if (this.autoPlay) {
      // Always-on background: mark the loop as 'appear' so the first init()
      // (fired by the ResizeObserver with the initial size) starts the shimmer
      // and keeps it running. No pointer/focus listeners.
      this.activeAnimation = 'appear';
    } else {
      host.addEventListener('mouseenter', this.onMouseEnter);
      host.addEventListener('mouseleave', this.onMouseLeave);
      if (this.playOnFocus) {
        host.addEventListener('focusin', this.onFocusIn);
        host.addEventListener('focusout', this.onFocusOut);
      }
    }
  }

  private readonly onMouseEnter = () => this.handleAnimation('appear');

  private readonly onMouseLeave = () => this.handleAnimation('disappear');

  private readonly onFocusIn = (event: FocusEvent) => {
    if (this.isInternalFocusShift(event)) return;
    this.handleAnimation('appear');
  };

  private readonly onFocusOut = (event: FocusEvent) => {
    if (this.isInternalFocusShift(event)) return;
    this.handleAnimation('disappear');
  };

  // Ignore focus moving between children of the host (only react to focus
  // entering/leaving the host as a whole).
  private isInternalFocusShift(event: FocusEvent) {
    const related = event.relatedTarget;
    return related instanceof Node && this.host.contains(related);
  }

  private init() {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DPR);
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.floor(rect.width);
    this.cssHeight = Math.floor(rect.height);
    this.pixels = [];

    if (this.cssWidth < 1 || this.cssHeight < 1) return;

    // Backing store in device px; everything we draw stays in CSS px thanks to
    // the dpr transform, so the layout maths below is resolution-independent.
    this.canvas.width = Math.floor(this.cssWidth * dpr);
    this.canvas.height = Math.floor(this.cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.createPixels();

    // If the host is hovered/focused when a layout change rebuilds the grid (or
    // when the first non-zero size arrives after a sub-1px mount), resume the loop
    // against the fresh pixels — otherwise the shimmer stays blank until the
    // next mouseenter.
    if (this.activeAnimation === 'appear') {
      this.handleAnimation('appear');
    }
  }

  private createPixels() {
    for (let x = 0; x < this.cssWidth; x += this.gap) {
      for (let y = 0; y < this.cssHeight; y += this.gap) {
        const color =
          this.colors[Math.floor(Math.random() * this.colors.length)];
        const delay = this.reducedMotion
          ? 0
          : distanceToCenter(x, y, this.cssWidth, this.cssHeight);
        this.pixels.push(
          new Pixel(
            this.ctx,
            x,
            y,
            color,
            this.pixelSpeed,
            delay,
            this.cssWidth,
            this.cssHeight,
          ),
        );
      }
    }
  }

  private handleAnimation(name: IAnimationName) {
    this.activeAnimation = name;
    cancelAnimationFrame(this.rafId);
    this.animate(name);
  }

  private animate(fnName: IAnimationName) {
    this.rafId = requestAnimationFrame(() => this.animate(fnName));

    const timeNow = performance.now();
    const timePassed = timeNow - this.timePrevious;
    if (timePassed < FRAME_INTERVAL) return;
    this.timePrevious = timeNow - (timePassed % FRAME_INTERVAL);

    // ctx is dpr-transformed, so CSS-px coords clear the whole backing store.
    this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    for (let i = 0; i < this.pixels.length; i += 1) {
      this.pixels[i][fnName]();
    }

    // Guard the empty grid: [].every() is vacuously true, which would otherwise
    // cancel the loop on the first frame after a zero-size init and never
    // recover.
    if (this.pixels.length > 0 && this.pixels.every((pixel) => pixel.isIdle)) {
      cancelAnimationFrame(this.rafId);
      this.activeAnimation = null;
    }
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.host.removeEventListener('mouseenter', this.onMouseEnter);
    this.host.removeEventListener('mouseleave', this.onMouseLeave);
    this.host.removeEventListener('focusin', this.onFocusIn);
    this.host.removeEventListener('focusout', this.onFocusOut);
  }
}

export default function PixelShimmer({
  colors = DEFAULT_COLORS,
  gap = 5,
  speed = 35,
  playOnFocus = true,
  autoPlay = false,
  className,
  style,
}: IPixelShimmerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Re-run when the palette identity changes (callers pass stable arrays).
  const colorsKey = colors.join(',');

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return undefined;

    const controller = new PixelShimmerController(canvas, ctx, host, {
      colors,
      gap,
      speed,
      playOnFocus,
      autoPlay,
    });
    return () => controller.destroy();
    // colorsKey stands in for the `colors` array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorsKey, gap, speed, playOnFocus, autoPlay]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        WebkitMaskImage: MASK_IMAGE,
        maskImage: MASK_IMAGE,
        ...style,
      }}
    />
  );
}
