import type { IOverlaySpring } from './types';

export function springNaturalFrequency(spring: IOverlaySpring): number {
  return Math.sqrt(spring.stiffness / spring.mass);
}

export function springDampingRatio(spring: IOverlaySpring): number {
  return spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
}

/**
 * Android `SpringForce` assumes unit mass, so it takes
 * stiffness / mass and the damping ratio.
 */
export function springToAndroidSpringForce(spring: IOverlaySpring): {
  stiffness: number;
  dampingRatio: number;
} {
  return {
    stiffness: spring.stiffness / spring.mass,
    dampingRatio: springDampingRatio(spring),
  };
}

/** Normalized step response: progress from 0 to 1 at `tMs`, zero start velocity. */
export function springProgressAt(spring: IOverlaySpring, tMs: number): number {
  const t = tMs / 1000;
  const w0 = springNaturalFrequency(spring);
  const zeta = springDampingRatio(spring);
  let progress: number;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    progress =
      1 -
      Math.exp(-zeta * w0 * t) *
        (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  } else if (zeta === 1) {
    progress = 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  } else {
    const root = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - root);
    const r2 = -w0 * (zeta + root);
    progress = 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }
  return spring.overshootClamping ? Math.min(progress, 1) : progress;
}

const MAX_SETTLE_MS = 10_000;

/** First time after which the response stays within `epsilon` of the target. */
export function springSettleTimeMs(
  spring: IOverlaySpring,
  epsilon = 0.001,
): number {
  let lastOutside = 0;
  for (let t = 0; t <= MAX_SETTLE_MS; t += 1) {
    if (Math.abs(1 - springProgressAt(spring, t)) >= epsilon) {
      lastOutside = t;
    }
  }
  return lastOutside + 1;
}

/**
 * CSS `linear()` easing sampled from the spring, for the Web Animations API when a
 * caller passes a custom spring. Presets use `WEB_MOTION_PRESETS` instead.
 */
export function springToCssLinear(
  spring: IOverlaySpring,
  stops = 40,
): { durationMs: number; easing: string } {
  const durationMs = springSettleTimeMs(spring);
  const points: string[] = [];
  for (let i = 0; i <= stops; i += 1) {
    const value =
      i === stops ? 1 : springProgressAt(spring, (durationMs * i) / stops);
    points.push(String(Math.round(value * 10_000) / 10_000));
  }
  return { durationMs, easing: `linear(${points.join(', ')})` };
}
