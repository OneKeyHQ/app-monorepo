/* eslint-disable new-cap */
import { buildCallRemoteApiMethod } from '@onekeyhq/kit-bg/src/apis/RemoteApiProxyBase';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { DESKTOP_API_MESSAGE_TYPE } from '../base/consts';
import { JsBridgeDesktopApiOfMain } from '../base/JsBridgeDesktopApiOfMain';
import DesktopApiBluetooth from '../DesktopApiBluetooth';
import DesktopApiDev from '../DesktopApiDev';
import DesktopApiInAppPurchase from '../DesktopApiInAppPurchase';
import DesktopApiNotification from '../DesktopApiNotification';
import DesktopApiSecurity from '../DesktopApiSecurity';
import DesktopApiStorage from '../DesktopApiStorage';
import DesktopApiSystem from '../DesktopApiSystem';
import DesktopApiWebview from '../DesktopApiWebview';

import type {
  IDesktopApi,
  IDesktopApiKeys,
  IDesktopApiMessagePayload,
} from '../base/types';

class DesktopApi implements IDesktopApi {
  inAppPurchase: DesktopApiInAppPurchase = new DesktopApiInAppPurchase({
    desktopApi: this,
  });

  system: DesktopApiSystem = new DesktopApiSystem({
    desktopApi: this,
  });

  security: DesktopApiSecurity = new DesktopApiSecurity({
    desktopApi: this,
  });

  storage: DesktopApiStorage = new DesktopApiStorage({
    desktopApi: this,
  });

  webview: DesktopApiWebview = new DesktopApiWebview({
    desktopApi: this,
  });

  notification: DesktopApiNotification = new DesktopApiNotification({
    desktopApi: this,
  });

  dev: DesktopApiDev = new DesktopApiDev({
    desktopApi: this,
  });

  bluetooth: DesktopApiBluetooth = new DesktopApiBluetooth({
    desktopApi: this,
  });
}

const desktopApi = new DesktopApi();

const createDesktopApiModule = memoizee(
  async (name: IDesktopApiKeys) => {
    return desktopApi[name];
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
