import type { IBackgroundThreadReadyPayload } from './runtimeReady';

type IBackgroundThreadReadyListener = (
  payload: IBackgroundThreadReadyPayload,
) => void;

type IBackgroundThreadStateGlobal = typeof globalThis & {
  __onekeyBackgroundThreadReadyPayload?: IBackgroundThreadReadyPayload;
};

const listeners = new Set<IBackgroundThreadReadyListener>();
let currentPayload: IBackgroundThreadReadyPayload | undefined;

function getBackgroundThreadStateGlobal() {
  return globalThis as IBackgroundThreadStateGlobal;
}

export function setBackgroundThreadReadyPayload(
  payload: IBackgroundThreadReadyPayload,
) {
  currentPayload = payload;
  getBackgroundThreadStateGlobal().__onekeyBackgroundThreadReadyPayload =
    payload;

  listeners.forEach((listener) => {
    listener(payload);
  });
}

export function getBackgroundThreadReadyPayload() {
  return (
    currentPayload ??
    getBackgroundThreadStateGlobal().__onekeyBackgroundThreadReadyPayload
  );
}

export function isBackgroundThreadReady() {
  return Boolean(getBackgroundThreadReadyPayload());
}

export function onBackgroundThreadReady(
  listener: IBackgroundThreadReadyListener,
) {
  listeners.add(listener);

  const payload = getBackgroundThreadReadyPayload();
  if (payload) {
    listener(payload);
  }

  return () => {
    listeners.delete(listener);
  };
}
