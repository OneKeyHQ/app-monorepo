import type { ReactNode } from 'react';

// Native draws the hint in place, over the Spot page.
export function HintLayerHost({ children }: { children: ReactNode }) {
  return children;
}
