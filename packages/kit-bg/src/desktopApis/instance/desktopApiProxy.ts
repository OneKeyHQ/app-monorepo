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
import type DesktopApiAppUpdate from '../DesktopApiAppUpdate';
import type DesktopApiBluetooth from '../DesktopApiBluetooth';
import type DesktopApiBundleUpdate from '../DesktopApiBundleUpdate';
import type DesktopApiCloudKit from '../DesktopApiCloudKit';
import type DesktopApiDev from '../DesktopApiDev';
import type DesktopApiInAppPurchase from '../DesktopApiInAppPurchase';
import type DesktopApiKeychain from '../DesktopApiKeychain';
import type DesktopApiNotification from '../DesktopApiNotification';
import type DesktopApiOAuthLocalServer from '../DesktopApiOAuthLocalServer';
import type DesktopApiSecurity from '../DesktopApiSecurity';
import type DesktopApiSniRequest from '../DesktopApiSniRequest';
import type DesktopApiStorage from '../DesktopApiStorage';
import type DesktopApiSystem from '../DesktopApiSystem';
import type DesktopApiWebview from '../DesktopApiWebview';

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

  security: DesktopApiSecurity =
    this._createProxyModule<IDesktopApiKeys>('security');

  storage: DesktopApiStorage =
    this._createProxyModule<IDesktopApiKeys>('storage');

  webview: DesktopApiWebview =
    this._createProxyModule<IDesktopApiKeys>('webview');

  notification: DesktopApiNotification =
    this._createProxyModule<IDesktopApiKeys>('notification');

  dev: DesktopApiDev = this._createProxyModule<IDesktopApiKeys>('dev');

  inAppPurchase: DesktopApiInAppPurchase =
    this._createProxyModule<IDesktopApiKeys>('inAppPurchase');

  bluetooth: DesktopApiBluetooth =
    this._createProxyModule<IDesktopApiKeys>('bluetooth');

  appUpdate: DesktopApiAppUpdate =
    this._createProxyModule<IDesktopApiKeys>('appUpdate');

  bundleUpdate: DesktopApiBundleUpdate =
    this._createProxyModule<IDesktopApiKeys>('bundleUpdate');

  cloudKit: DesktopApiCloudKit =
    this._createProxyModule<IDesktopApiKeys>('cloudKit');

  keychain: DesktopApiKeychain =
    this._createProxyModule<IDesktopApiKeys>('keychain');

  sniRequest: DesktopApiSniRequest =
    this._createProxyModule<IDesktopApiKeys>('sniRequest');

  oauthLocalServer: DesktopApiOAuthLocalServer =
    this._createProxyModule<IDesktopApiKeys>('oauthLocalServer');
}

const desktopApiProxy = new DesktopApiProxy();
export default desktopApiProxy;
// appGlobals.$desktopApiProxy = desktopApiProxy;
