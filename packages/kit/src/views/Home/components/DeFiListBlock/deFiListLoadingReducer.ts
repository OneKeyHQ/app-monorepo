export type IDeFiListLoadingState = {
  isRefreshing: boolean;
  initialized: boolean;
};

export type IDeFiListLoadingEvent =
  | { type: 'start' }
  | { type: 'settled' }
  | { type: 'error'; error: unknown };

const TERMINAL: IDeFiListLoadingState = {
  isRefreshing: false,
  initialized: true,
};

const LOADING: IDeFiListLoadingState = {
  isRefreshing: true,
  initialized: false,
};

export function deFiListLoadingReducer(
  event: IDeFiListLoadingEvent,
): IDeFiListLoadingState {
  switch (event.type) {
    case 'start':
      return LOADING;
    case 'settled':
    case 'error':
      return TERMINAL;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
