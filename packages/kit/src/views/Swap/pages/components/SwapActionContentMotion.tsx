import type { ReactNode } from 'react';

export interface ISwapActionContentMotionProps {
  // What the button shows: its label, or null for the quote dots.
  contentKey: string | null;
  // Whether the button has its disabled fill.
  fillKey: boolean;
  children: ReactNode;
}

// On web, desktop and extension the content motion works on the button's DOM
// node (useActionContentMotion in SwapActionsState), so the content renders
// as is.
export function SwapActionContentMotion({
  children,
}: ISwapActionContentMotionProps) {
  return children;
}
