/* eslint-disable new-cap */
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { buildCallRemoteApiMethod } from '../../apis/RemoteApiProxyBase';

import type { IOffscreenApi } from './IOffscreenApi';
import type {
  IBackgroundApiInternalCallMessage,
  IOffscreenApiMessagePayload,
} from '../../apis/IBackgroundApi';
import type { CoreMessage, LowLevelCoreApi } from '@onekeyfe/hd-core';

let HardwareLowLevelSDK: LowLevelCoreApi;

const forwardHardwareEventToBackground = (eventParams: CoreMessage) => {
  const backgroundServiceName = 'serviceHardware';
  const backgroundMethodName = `${INTERNAL_METHOD_PREFIX}passHardwareEventsFromOffscreenToBackground`;
  const message: IBackgroundApiInternalCallMessage = {
    service: backgroundServiceName,
    method: backgroundMethodName,
    params: [eventParams],
  };
  // chrome.runtime.sendMessage(message);
  // TODO backgroundApiProxyInOffscreen
  const bridge = appGlobals.extJsBridgeOffscreenToBg;
  if (!bridge) {
    console.error('[hardwareSDKLowLevel] background bridge is unavailable');
    return;
  }
  void Promise.resolve(bridge.request({ data: message })).catch(
    (error: unknown) => {
      console.error(
        '[hardwareSDKLowLevel] failed to forward event to background',
        error,
      );
    },
  );
};

const registerHardwareGlobalEventListener = () => {
  HardwareLowLevelSDK.addHardwareGlobalEventListener(
    forwardHardwareEventToBackground,
  );
};

const createOffscreenApiModule = memoizee(
  async (name: keyof IOffscreenApi) => {
    switch (name) {
      case 'hardwareSDKLowLevel':
        if (!HardwareLowLevelSDK) {
          HardwareLowLevelSDK = await (
            await import('@onekeyhq/shared/src/hardware/sdk-loader')
          ).importHardwareSDKLowLevel();
          registerHardwareGlobalEventListener();
        }
        return HardwareLowLevelSDK;
      case 'adaSdk':
        return new (await import('../OffscreenApiAdaSdk')).default();
      case 'kaspaSdk':
        return new (await import('../OffscreenApiKaspaSdk')).default();
      case 'thirdPartyHardware':
        return new (
          await import('../OffscreenApiThirdPartyHardware')
        ).default();
      default:
        throw new OneKeyLocalError(
          `Unknown offscreen API module: ${name as string}`,
        );
    }
  },
  {
    promise: true,
  },
);

const callOffscreenApiMethodBase =
  buildCallRemoteApiMethod<IOffscreenApiMessagePayload>(
    createOffscreenApiModule,
    'offscreenApi',
  );

const callOffscreenApiMethod = async (message: IOffscreenApiMessagePayload) => {
  const result: unknown = await callOffscreenApiMethodBase(message);
  const didClearAllHardwareListeners =
    message.module === 'hardwareSDKLowLevel' &&
    (message.method === 'dispose' ||
      (message.method === 'removeAllListeners' &&
        message.params?.[0] === undefined));
  if (didClearAllHardwareListeners) {
    registerHardwareGlobalEventListener();
  }
  return result;
};

export default {
  callOffscreenApiMethod,
};
