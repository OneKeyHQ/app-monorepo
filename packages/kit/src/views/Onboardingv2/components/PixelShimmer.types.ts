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
  className?: string;
  style?: CSSProperties;
}
