import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export type ICustomInjectedProtocolRuntimeScope = Readonly<{
  instanceKey: string;
  protocolId: string;
  sessionId: string;
  tabId: string;
}>;

type IRuntimeState = {
  ready: boolean;
  scope: ICustomInjectedProtocolRuntimeScope;
  waiters: Set<(ready: boolean) => void>;
};

export type ICustomInjectedProtocolSelectionLock = Readonly<{
  reason: string;
  sessionId: string;
  token: string;
  release: () => void;
}>;

type ISelectionLockState = Omit<
  ICustomInjectedProtocolSelectionLock,
  'release'
>;

let activeRuntime: IRuntimeState | undefined;
let activeSelectionLock: ISelectionLockState | undefined;
let selectionLockSequence = 0;
let hasAppliedInitialProtocolUrl = false;
const selectionLockListeners = new Set<
  (lock: ISelectionLockState | undefined) => void
>();
const E2E_CLEAN_SESSION_LOCK_REASONS = new Set([
  'E2E generation',
  'E2E validation',
  'pending E2E validation',
]);

function isSameScope(
  left: ICustomInjectedProtocolRuntimeScope | undefined,
  right: ICustomInjectedProtocolRuntimeScope | undefined,
) {
  return Boolean(
    left &&
    right &&
    left.instanceKey === right.instanceKey &&
    left.protocolId === right.protocolId &&
    left.sessionId === right.sessionId &&
    left.tabId === right.tabId,
  );
}

function settleRuntime(runtime: IRuntimeState, ready: boolean) {
  runtime.waiters.forEach((resolve) => resolve(ready));
  runtime.waiters.clear();
}

export function activateCustomInjectedProtocolRuntime(
  scope: ICustomInjectedProtocolRuntimeScope,
) {
  if (activeRuntime && isSameScope(activeRuntime.scope, scope)) {
    return activeRuntime.scope;
  }
  if (activeRuntime) {
    settleRuntime(activeRuntime, false);
  }
  activeRuntime = {
    ready: false,
    scope: Object.freeze({ ...scope }),
    waiters: new Set(),
  };
  return activeRuntime.scope;
}

export function deactivateCustomInjectedProtocolRuntime(
  expectedScope?: ICustomInjectedProtocolRuntimeScope,
) {
  if (
    !activeRuntime ||
    (expectedScope && !isSameScope(activeRuntime.scope, expectedScope))
  ) {
    return;
  }
  settleRuntime(activeRuntime, false);
  activeRuntime = undefined;
}

export function getActiveCustomInjectedProtocolRuntime() {
  return activeRuntime?.scope;
}

/**
 * Custom Injection may replace the current tab URL once when its runtime is
 * first initialized. The flag deliberately lives at module scope so React
 * unmounts, tab switches and workspace refreshes cannot re-arm the redirect
 * during the same Desktop app run.
 */
export function consumeCustomInjectedInitialProtocolUrl() {
  if (hasAppliedInitialProtocolUrl) {
    return false;
  }
  hasAppliedInitialProtocolUrl = true;
  return true;
}

export function isCustomInjectedProtocolRuntimeActive(
  scope: ICustomInjectedProtocolRuntimeScope | undefined,
) {
  return isSameScope(activeRuntime?.scope, scope);
}

export function markCustomInjectedProtocolRuntimeReady(
  scope: ICustomInjectedProtocolRuntimeScope,
) {
  if (!activeRuntime || !isSameScope(activeRuntime.scope, scope)) {
    return false;
  }
  activeRuntime.ready = true;
  settleRuntime(activeRuntime, true);
  return true;
}

export function waitForCustomInjectedProtocolRuntimeReady(
  scope: ICustomInjectedProtocolRuntimeScope,
  { timeoutMs = 45_000 }: { timeoutMs?: number } = {},
) {
  const runtime = activeRuntime;
  if (!runtime || !isSameScope(runtime.scope, scope)) {
    return Promise.resolve(false);
  }
  if (runtime.ready) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timeoutRef: {
      current?: ReturnType<typeof setTimeout>;
    } = {};
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
      runtime.waiters.delete(finish);
      resolve(ready);
    };
    timeoutRef.current = setTimeout(() => finish(false), timeoutMs);
    runtime.waiters.add(finish);
  });
}

export function getCustomInjectedProtocolSelectionLock() {
  return activeSelectionLock;
}

export function isCustomInjectedProtocolSelectionAllowed({
  lockToken,
  sessionId,
}: {
  lockToken?: string;
  sessionId: string;
}) {
  return Boolean(
    !activeSelectionLock ||
    (activeSelectionLock.sessionId === sessionId &&
      activeSelectionLock.token === lockToken),
  );
}

export function isCustomInjectedE2ECleanSessionAllowed({
  sessionId,
}: {
  sessionId: string;
}) {
  return Boolean(
    !activeSelectionLock ||
    (activeSelectionLock.sessionId === sessionId &&
      E2E_CLEAN_SESSION_LOCK_REASONS.has(activeSelectionLock.reason)),
  );
}

export function acquireCustomInjectedProtocolSelectionLock({
  reason,
  sessionId,
}: {
  reason: string;
  sessionId: string;
}): ICustomInjectedProtocolSelectionLock {
  if (activeSelectionLock) {
    throw new OneKeyLocalError(
      `Protocol switching is locked by ${activeSelectionLock.reason}`,
    );
  }
  selectionLockSequence += 1;
  const lock: ISelectionLockState = Object.freeze({
    reason,
    sessionId,
    token: `custom-injected-selection-lock-${String(selectionLockSequence)}`,
  });
  activeSelectionLock = lock;
  selectionLockListeners.forEach((listener) => listener(lock));
  let released = false;
  return Object.freeze({
    ...lock,
    release: () => {
      if (released) return;
      released = true;
      if (activeSelectionLock === lock) {
        activeSelectionLock = undefined;
        selectionLockListeners.forEach((listener) => listener(undefined));
      }
    },
  });
}

export function subscribeCustomInjectedProtocolSelectionLock(
  listener: (lock: ISelectionLockState | undefined) => void,
) {
  selectionLockListeners.add(listener);
  return () => {
    selectionLockListeners.delete(listener);
  };
}

export function resetCustomInjectedProtocolRuntimeForTest() {
  deactivateCustomInjectedProtocolRuntime();
  activeSelectionLock = undefined;
  selectionLockSequence = 0;
  hasAppliedInitialProtocolUrl = false;
  selectionLockListeners.clear();
}
