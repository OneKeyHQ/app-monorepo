import type { ReactNode } from 'react';

import { createPortal } from 'react-dom';

export function StickyHeaderPortal({
  children,
  target,
}: {
  children: ReactNode;
  target: HTMLElement;
}) {
  return createPortal(children, target);
}
