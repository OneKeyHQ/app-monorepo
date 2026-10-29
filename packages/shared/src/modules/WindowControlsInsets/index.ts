import { ZERO_WINDOW_CONTROLS_INSETS } from './types';

import type { IWindowControlsInsets } from './types';

export type { IWindowControlsInsets } from './types';

// Only iOS draws window controls inside the app window.
export function useWindowControlsInsets(): IWindowControlsInsets {
  return ZERO_WINDOW_CONTROLS_INSETS;
}

export function useWindowControlsLeadingOffset(_contentPadding: number) {
  return 0;
}
