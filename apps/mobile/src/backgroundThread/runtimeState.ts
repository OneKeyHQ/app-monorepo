import {
  type INativeBackgroundThreadReadyReason,
  publishNativeBackgroundThreadReady,
} from '@onekeyhq/shared/src/background/nativeBackgroundThreadReady';

import type { IBackgroundThreadTransportState } from './rpcProtocol';
import type { IBackgroundThreadReadyPayload } from './runtimeReady';

type IBackgroundThreadReadyListener = (
  payload: IBackgroundThreadReadyPayload,
) => void;

export type IBackgroundThreadReadyReason = INativeBackgroundThreadReadyReason;

type IBackgroundThreadStateGlobal = typeof globalThis & {
  __onekeyBackgroundThreadReadyPayload?: IBackgroundThreadReadyPayload;
};

const listeners = new Set<IBackgroundThreadReadyListener>();
let currentPayload: IBackgroundThreadReadyPayload | undefined;

function getBackgroundThreadStateGlobal() {
  return globalThis as IBackgroundThreadStateGlobal;
}

function saveBackgroundThreadReadyPayload(
  payload: IBackgroundThreadReadyPayload,
  reason: IBackgroundThreadReadyReason,
) {
  currentPayload = payload;
  getBackgroundThreadStateGlobal().__onekeyBackgroundThreadReadyPayload =
    payload;
  publishNativeBackgroundThreadReady({
    bootId: payload.bootId,
    reason,
  });
}

function notifyListener(
  listener: IBackgroundThreadReadyListener,
  payload: IBackgroundThreadReadyPayload,
) {
  try {
    listener(payload);
  } catch {
    // Ready publication and queued-call flushing must survive listener errors.
  }
}

export function classifyBackgroundThreadReadyReason({
  nextBootId,
  previousBootId,
  transportState,
}: {
  nextBootId: string;
  previousBootId: string | undefined;
  transportState: IBackgroundThreadTransportState;
}): IBackgroundThreadReadyReason {
  if (previousBootId && previousBootId !== nextBootId) {
    return 'restarted';
  }
  if (transportState === 'remote-broken') {
    return 'recovered';
  }
  return 'initial';
}

export function setBackgroundThreadReadyPayload(
  payload: IBackgroundThreadReadyPayload,
  reason: IBackgroundThreadReadyReason = 'initial',
) {
  saveBackgroundThreadReadyPayload(payload, reason);

  listeners.forEach((listener) => notifyListener(listener, payload));
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
    notifyListener(listener, payload);
  }

  return () => {
    listeners.delete(listener);
  };
}
