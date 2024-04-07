/* eslint-disable new-cap */
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { buildCallRemoteApiMethod } from '../../apis/RemoteApiProxyBase';

import type { IOffscreenApi } from './IOffscreenApi';
import type {
  IBackgroundApiInternalCallMessage,
  IOffscreenApiMessagePayload,
} from '../../apis/IBackgroundApi';
import type { LowLevelCoreApi } from '@onekeyfe/hd-core';

let HardwareLowLevelSDK: LowLevelCoreApi;

const createOffscreenApiModule = memoizee(
  async (name: keyof IOffscreenApi) => {
    switch (name) {
      case 'hardwareSDKLowLevel':
        if (!HardwareLowLevelSDK) {
          HardwareLowLevelSDK = await (
            await import('@onekeyhq/shared/src/hardware/sdk-loader')
          ).importHardwareSDKLowLevel();
          HardwareLowLevelSDK.addHardwareGlobalEventListener((eventParams) => {
            const backgroundServiceName = 'serviceHardware';
            const backgroundMethodName = `${INTERNAL_METHOD_PREFIX}passHardwareEventsFromOffscreenToBackground`;
            const message: IBackgroundApiInternalCallMessage = {
              service: backgroundServiceName,
              method: backgroundMethodName,
              params: [eventParams],
            };
            // chrome.runtime.sendMessage(message);
            // TODO backgroundApiProxyInOffscreen
            void window.extJsBridgeOffscreenToBg.request({ data: message });
          });
        }
        return HardwareLowLevelSDK;
      case 'adaSdk':
        return new (await import('../OffscreenApiAdaSdk')).default();
      case 'xmrSdk':
        return new (await import('../OffscreenApiXmrSdk')).default();
      default:
        throw new Error(`Unknown offscreen API module: ${name as string}`);
    }
  },
  {
    promise: true,
  },
);

const callOffscreenApiMethod =
  buildCallRemoteApiMethod<IOffscreenApiMessagePayload>(
    createOffscreenApiModule,
  );

export default {
  callOffscreenApiMethod,
};
