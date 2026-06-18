export type IDeFiListLoadingState = {
  isRefreshing: boolean;
  initialized: boolean;
  loadedOwnerKey?: string;
};

export type IDeFiListLoadingEvent =
  | { type: 'start' }
  | { type: 'settled'; loadedOwnerKey?: string }
  | { type: 'error'; error: unknown; loadedOwnerKey?: string };

const TERMINAL: IDeFiListLoadingState = {
  isRefreshing: false,
  initialized: true,
};

const LOADING: IDeFiListLoadingState = {
  isRefreshing: true,
  initialized: false,
  loadedOwnerKey: undefined,
};

export function deFiListLoadingReducer(
  event: IDeFiListLoadingEvent,
): IDeFiListLoadingState {
  switch (event.type) {
    case 'start':
      return LOADING;
    case 'settled':
    case 'error':
      return {
        ...TERMINAL,
        loadedOwnerKey: event.loadedOwnerKey,
      };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function shouldShowDeFiEmptyState({
  initialized,
  isRefreshing,
  loadedOwnerKey,
  ownerKey,
  protocolsLength,
}: {
  initialized: boolean;
  isRefreshing: boolean;
  loadedOwnerKey?: string;
  ownerKey?: string;
  protocolsLength: number;
}) {
  return (
    protocolsLength === 0 &&
    initialized &&
    !isRefreshing &&
    Boolean(ownerKey) &&
    loadedOwnerKey === ownerKey
  );
}
