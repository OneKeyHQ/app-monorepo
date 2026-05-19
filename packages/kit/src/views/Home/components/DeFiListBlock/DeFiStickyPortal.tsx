import type { ReactNode } from 'react';

import { createPortal } from 'react-dom';

export function DeFiStickyPortal({
  children,
  target,
}: {
  children: ReactNode;
  target?: HTMLElement | null;
}) {
  if (!target) return null;
  return createPortal(children, target);
}
