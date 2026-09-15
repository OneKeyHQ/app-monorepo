import type { ReactElement } from 'react';

export type ITradingViewNativeIndicatorQuickBarState =
  | { status: 'loading'; quickBar: null }
  | { status: 'hidden'; quickBar: null }
  | { status: 'visible'; quickBar: ReactElement };

export function resolveTradingViewNativeIndicatorQuickBarState({
  isAvailabilityResolved,
  quickBar,
}: {
  isAvailabilityResolved: boolean;
  quickBar: ReactElement | null;
}): ITradingViewNativeIndicatorQuickBarState {
  if (!isAvailabilityResolved) {
    return { status: 'loading', quickBar: null };
  }
  if (!quickBar) {
    return { status: 'hidden', quickBar: null };
  }
  return { status: 'visible', quickBar };
}

export function shouldReserveTradingViewNativeIndicatorQuickBar(
  state: ITradingViewNativeIndicatorQuickBarState,
) {
  return state.status !== 'hidden';
}
