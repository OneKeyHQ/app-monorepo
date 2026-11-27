import type { IInterfaceOrientation } from './types';

export type { IInterfaceOrientation } from './types';

// Only iOS reports the window scene's orientation.
export function useInterfaceOrientation(): IInterfaceOrientation {
  return 'unknown';
}
