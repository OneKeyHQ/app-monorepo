import type { CSSProperties } from 'react';

export interface IPixelShimmerProps {
  /** Pixel color palette; every pixel picks one at random. */
  colors?: string[];
  /** Grid spacing in CSS px (clamped 4–50). */
  gap?: number;
  /** Animation speed 0–100 (internally scaled by 0.001). */
  speed?: number;
  /** Also play while the host card has keyboard focus (default true). */
  playOnFocus?: boolean;
  /**
   * Play continuously without any hover/focus — an always-on background.
   * When set, the shimmer starts as soon as the grid is built and never stops,
   * and no pointer/focus listeners are wired. Default false.
   */
  autoPlay?: boolean;
  className?: string;
  style?: CSSProperties;
}
