export type INativeBackgroundThreadReadyReason =
  | 'initial'
  | 'recovered'
  | 'restarted';

export type INativeBackgroundThreadReadySignal = {
  bootId: string;
  reason: INativeBackgroundThreadReadyReason;
  sequence: number;
};

type INativeBackgroundThreadReadyListener = (
  signal: INativeBackgroundThreadReadySignal,
) => void;

type INativeBackgroundThreadReadyState = {
  listeners: Set<INativeBackgroundThreadReadyListener>;
  signal?: INativeBackgroundThreadReadySignal;
};

type INativeBackgroundThreadReadyGlobal = typeof globalThis & {
  __onekeyNativeBackgroundThreadReadyState?: INativeBackgroundThreadReadyState;
};

function getState(): INativeBackgroundThreadReadyState {
  const runtimeGlobal = globalThis as INativeBackgroundThreadReadyGlobal;
  if (!runtimeGlobal.__onekeyNativeBackgroundThreadReadyState) {
    runtimeGlobal.__onekeyNativeBackgroundThreadReadyState = {
      listeners: new Set(),
    };
  }
  return runtimeGlobal.__onekeyNativeBackgroundThreadReadyState;
}

function notifyListener(
  listener: INativeBackgroundThreadReadyListener,
  signal: INativeBackgroundThreadReadySignal,
) {
  try {
    listener(signal);
  } catch {
    // A faulty consumer must not block readiness delivery to other owners.
  }
}

export function publishNativeBackgroundThreadReady({
  bootId,
  reason,
}: {
  bootId: string;
  reason: INativeBackgroundThreadReadyReason;
}): INativeBackgroundThreadReadySignal {
  const state = getState();
  const signal: INativeBackgroundThreadReadySignal = {
    bootId,
    reason,
    sequence: (state.signal?.sequence ?? 0) + 1,
  };
  state.signal = signal;
  state.listeners.forEach((listener) => notifyListener(listener, signal));
  return signal;
}

export function onNativeBackgroundThreadReady(
  listener: INativeBackgroundThreadReadyListener,
): () => void {
  const state = getState();
  state.listeners.add(listener);
  if (state.signal) {
    notifyListener(listener, state.signal);
  }
  return () => {
    state.listeners.delete(listener);
  };
}
