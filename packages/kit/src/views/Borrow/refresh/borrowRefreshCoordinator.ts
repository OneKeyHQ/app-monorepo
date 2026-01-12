export type IBorrowRefreshScope = {
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
};

export type IBorrowRefreshReason =
  | 'pendingCompleted'
  | 'txSuccess'
  | 'manual'
  | 'unknown';

export type IBorrowRefreshRequest = {
  id: string;
  scope: IBorrowRefreshScope;
  reason: IBorrowRefreshReason;
  requestedAt: number;
  delayMs?: number;
};

type IBorrowRefreshHandler = (
  request: IBorrowRefreshRequest,
) => void | Promise<void>;

enum EBorrowRefreshStatus {
  Idle = 'idle',
  Waiting = 'waiting',
  Running = 'running',
}

type IScopeState = {
  scope: IBorrowRefreshScope;
  status: EBorrowRefreshStatus;
  lastRequestedAt: number | null;
  lastHandledAt: number | null;
  pendingRequest: IBorrowRefreshRequest | null;
  listeners: Map<string, IBorrowRefreshHandler>;
  timer?: ReturnType<typeof setTimeout>;
  nextRunAt?: number;
};

const DEFAULT_COALESCE_MS = 1000;

const scopeStateMap = new Map<string, IScopeState>();

const normalizeScopeKeyPart = (value: string) => value.trim().toLowerCase();

const getScopeKey = (scope: IBorrowRefreshScope) =>
  [
    scope.accountId,
    scope.networkId,
    normalizeScopeKeyPart(scope.provider),
    normalizeScopeKeyPart(scope.marketAddress),
  ].join('|');

const getScopeState = (scope: IBorrowRefreshScope) => {
  const key = getScopeKey(scope);
  let state = scopeStateMap.get(key);
  if (!state) {
    state = {
      scope,
      status: EBorrowRefreshStatus.Idle,
      lastRequestedAt: null,
      lastHandledAt: null,
      pendingRequest: null,
      listeners: new Map(),
    };
    scopeStateMap.set(key, state);
  }
  return { key, state };
};

const computeRunAt = (request: IBorrowRefreshRequest) =>
  Math.max(
    request.requestedAt + (request.delayMs ?? 0),
    request.requestedAt + DEFAULT_COALESCE_MS,
  );

const cleanupStateIfIdle = (key: string, state: IScopeState) => {
  if (
    state.status !== EBorrowRefreshStatus.Running &&
    state.listeners.size === 0 &&
    !state.pendingRequest
  ) {
    if (state.timer) {
      clearTimeout(state.timer);
    }
    scopeStateMap.delete(key);
  }
};

async function processState(key: string) {
  const state = scopeStateMap.get(key);
  if (!state) {
    return;
  }

  if (!state.pendingRequest || state.listeners.size === 0) {
    state.status = EBorrowRefreshStatus.Idle;
    state.timer = undefined;
    state.nextRunAt = undefined;
    cleanupStateIfIdle(key, state);
    return;
  }

  if (state.status === EBorrowRefreshStatus.Running) {
    return;
  }

  const runAt = computeRunAt(state.pendingRequest);
  const delay = runAt - Date.now();
  if (delay > 0) {
    if (state.timer) {
      clearTimeout(state.timer);
    }
    state.status = EBorrowRefreshStatus.Waiting;
    state.nextRunAt = runAt;
    state.timer = setTimeout(() => {
      void processState(key);
    }, delay);
    return;
  }

  const request = state.pendingRequest;
  state.pendingRequest = null;
  state.status = EBorrowRefreshStatus.Running;
  state.timer = undefined;
  state.nextRunAt = undefined;

  const listeners = Array.from(state.listeners.values());
  for (const listener of listeners) {
    try {
      await listener(request);
    } catch {
      // Ignore listener errors to keep refresh flow resilient.
    }
  }

  const currentState = scopeStateMap.get(key);
  if (!currentState) {
    return;
  }
  currentState.lastHandledAt = Date.now();
  currentState.status = EBorrowRefreshStatus.Idle;
  if (currentState.pendingRequest && currentState.listeners.size > 0) {
    void processState(key);
  } else {
    cleanupStateIfIdle(key, currentState);
  }
}

export const createBorrowRefreshScope = ({
  accountId,
  networkId,
  provider,
  marketAddress,
}: {
  accountId?: string;
  networkId?: string;
  provider?: string;
  marketAddress?: string;
}): IBorrowRefreshScope | null => {
  if (!accountId || !networkId || !provider || !marketAddress) {
    return null;
  }
  return {
    accountId,
    networkId,
    provider,
    marketAddress,
  };
};

export const requestBorrowRefresh = ({
  scope,
  reason,
  delayMs,
  requestedAt,
  id,
}: {
  scope: IBorrowRefreshScope;
  reason: IBorrowRefreshReason;
  delayMs?: number;
  requestedAt?: number;
  id?: string;
}) => {
  const { key, state } = getScopeState(scope);
  const request: IBorrowRefreshRequest = {
    id: id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    scope,
    reason,
    requestedAt: requestedAt ?? Date.now(),
    delayMs,
  };

  state.pendingRequest = request;
  state.lastRequestedAt = request.requestedAt;

  void processState(key);
};

export const registerBorrowRefreshHandler = (
  scope: IBorrowRefreshScope,
  handler: IBorrowRefreshHandler,
) => {
  const { key, state } = getScopeState(scope);
  const handlerId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.listeners.set(handlerId, handler);

  void processState(key);

  return () => {
    const currentState = scopeStateMap.get(key);
    if (!currentState) {
      return;
    }
    currentState.listeners.delete(handlerId);
    cleanupStateIfIdle(key, currentState);
  };
};

export const getBorrowRefreshState = (scope: IBorrowRefreshScope) => {
  const { state } = getScopeState(scope);
  return {
    lastRequestedAt: state.lastRequestedAt,
    lastHandledAt: state.lastHandledAt,
    inFlight: state.status === EBorrowRefreshStatus.Running,
  };
};
