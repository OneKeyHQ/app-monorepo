/**
 * Physical spring, identical to Reanimated / Tamagui:
 * mass * x'' + damping * x' + stiffness * x = 0.
 * Springs with a damping ratio above 1 are valid and common (`quick`).
 */
export interface IOverlaySpring {
  mass: number;
  stiffness: number;
  damping: number;
  /** Clamp the value at the target instead of overshooting. */
  overshootClamping?: boolean;
}

export type IOverlayCubicBezier = readonly [number, number, number, number];

export interface IOverlayTiming {
  durationMs: number;
  easing: IOverlayCubicBezier;
}

export type IOverlayMotion =
  | { type: 'spring'; spring: IOverlaySpring }
  | { type: 'timing'; timing: IOverlayTiming };

/** Named motion tokens; each platform maps them to its own curve. */
export type IOverlayMotionPreset =
  | 'quick'
  | 'popoverQuick'
  | 'smooth'
  | 'fast'
  | 'medium'
  | 'slow'
  | 'toastSlide'
  | 'lockFade';

export type IOverlayMotionInput = IOverlayMotionPreset | IOverlayMotion;

export type IOverlayEdge = 'top' | 'bottom' | 'left' | 'right';

export interface IOverlayTransition {
  /** `none` shows / hides immediately; content may animate itself. */
  type: 'none' | 'fade' | 'slide' | 'scale';
  /** `slide`: the edge the overlay travels from (enter) or to (exit). */
  edge?: IOverlayEdge;
  /** `slide`: travel in points; defaults to off-screen. */
  distance?: number;
  /** `scale`: start (enter) or end (exit) scale. */
  scale?: number;
  /** `scale`: extra translate along Y in points, e.g. -20 for custom toasts. */
  offsetY?: number;
  /** Fade opacity alongside slide / scale. Defaults to true for scale. */
  fade?: boolean;
  /** `scale`: `anchor` scales from the resolved anchor placement. */
  origin?: 'center' | 'anchor';
  motion?: IOverlayMotionInput;
}

export interface IOverlayAnimation {
  enter?: IOverlayTransition;
  /** Defaults to the reverse of `enter`. */
  exit?: IOverlayTransition;
  /** Backdrop fade; runs on the same clock as the content by default. */
  backdrop?: { motion?: IOverlayMotionInput };
}

export type IOverlayPresentation =
  | 'sheet'
  | 'center'
  | 'fullscreen'
  | 'toast'
  | 'anchored';
