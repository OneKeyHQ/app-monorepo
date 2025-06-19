/* eslint-disable no-restricted-syntax */
import platformEnvLite from '@onekeyhq/shared/src/platformEnvLite';

import { RemoteApiProxyBase } from '../../apis/RemoteApiProxyBase';
import { DESKTOP_API_MESSAGE_TYPE } from '../base/consts';
import { JsBridgeDesktopApiOfRender } from '../base/JsBridgeDesktopApiOfRender';

import type {
  IDesktopApi,
  IDesktopApiKeys,
  IDesktopApiMessagePayload,
} from '../base/types';
import type DesktopApiInAppPurchase from '../DesktopApiInAppPurchase';
import type DesktopApiSystem from '../DesktopApiSystem';

export class DesktopApiProxy extends RemoteApiProxyBase implements IDesktopApi {
  bridge = new JsBridgeDesktopApiOfRender();

  override checkEnvAvailable(): void {
    if (!platformEnvLite.isDesktop) {
      throw new Error('DesktopApiProxy should only be used in Desktop env.');
    }
  }

  override async waitRemoteApiReady(): Promise<void> {
    return Promise.resolve();
  }

  protected override async callRemoteApi(options: {
    module: IDesktopApiKeys;
    method: string;
    params: any[];
  }): Promise<any> {
    const { module, method, params } = options;
    const message: IDesktopApiMessagePayload = {
      type: DESKTOP_API_MESSAGE_TYPE,
      module: module as any,
      method,
      params,
    };

    return this.bridge.request({
      data: message,
      // scope,
      // remoteId,
    });
  }

  system: DesktopApiSystem = this._createProxyModule<IDesktopApiKeys>('system');

  inAppPurchase: DesktopApiInAppPurchase =
    this._createProxyModule<IDesktopApiKeys>('inAppPurchase');
}

const desktopApiProxy = new DesktopApiProxy();
export default desktopApiProxy;
// appGlobals.$desktopApiProxy = desktopApiProxy;
