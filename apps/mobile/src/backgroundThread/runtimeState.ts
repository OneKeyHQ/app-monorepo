import {
  type INativeBackgroundThreadReadyReason,
  publishNativeBackgroundThreadReady,
} from '@onekeyhq/shared/src/background/nativeBackgroundThreadReady';

import type { IBackgroundThreadTransportState } from './rpcProtocol';
import type { IBackgroundThreadReadyPayload } from './runtimeReady';

export type IBackgroundThreadReadyReason = INativeBackgroundThreadReadyReason;

type IBackgroundThreadStateGlobal = typeof globalThis & {
  __onekeyBackgroundThreadReadyPayload?: IBackgroundThreadReadyPayload;
};

function getBackgroundThreadStateGlobal() {
  return globalThis as IBackgroundThreadStateGlobal;
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
  getBackgroundThreadStateGlobal().__onekeyBackgroundThreadReadyPayload =
    payload;
  publishNativeBackgroundThreadReady({
    bootId: payload.bootId,
    reason,
  });
}
