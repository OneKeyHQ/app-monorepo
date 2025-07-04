/* eslint-disable new-cap */
import { buildCallRemoteApiMethod } from '@onekeyhq/kit-bg/src/apis/RemoteApiProxyBase';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { DESKTOP_API_MESSAGE_TYPE } from '../base/consts';
import { JsBridgeDesktopApiOfMain } from '../base/JsBridgeDesktopApiOfMain';

import type { IDesktopApiKeys, IDesktopApiMessagePayload } from '../base/types';

const createDesktopApiModule = memoizee(
  async (name: IDesktopApiKeys) => {
    if (name === 'system') {
      return new (await import('../DesktopApiSystem')).default();
    }
    if (name === 'security') {
      return new (await import('../DesktopApiSecurity')).default();
    }
    if (name === 'storage') {
      return new (await import('../DesktopApiStorage')).default();
    }
    if (name === 'updater') {
      return new (await import('../DesktopApiUpdater')).default();
    }
    if (name === 'network') {
      return new (await import('../DesktopApiNetwork')).default();
    }
    if (name === 'notification') {
      return new (await import('../DesktopApiNotification')).default();
    }
    if (name === 'dev') {
      return new (await import('../DesktopApiDev')).default();
    }
    if (name === 'inAppPurchase') {
      return new (await import('../DesktopApiInAppPurchase')).default();
    }
    throw new OneKeyLocalError(`Unknown Desktop API module: ${name as string}`);
  },
  {
    promise: true,
  },
);

const callDesktopApiMethod =
  buildCallRemoteApiMethod<IDesktopApiMessagePayload>(
    createDesktopApiModule,
    'desktopApi',
  );

function desktopApiSetup() {
  const bridge = new JsBridgeDesktopApiOfMain({
    receiveHandler: async (payload) => {
      const msg = payload.data as IDesktopApiMessagePayload | undefined;
      if (msg && msg.type === DESKTOP_API_MESSAGE_TYPE) {
        const result = await callDesktopApiMethod(msg);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      }
    },
  });
  return bridge;
}

export default { callDesktopApiMethod, desktopApiSetup };
