import type { ReactNode } from 'react';

import { createPortal } from 'react-dom';

// Web: the hint goes on <body>. Inside the Spot page it would sit in the
// pager's transformed scroll box, where a fixed layer is placed and stacked
// within that box, under the tab bar that hid the caret.
export function HintLayerHost({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
