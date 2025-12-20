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

export interface IDesktopApi {
  system: DesktopApiSystem;
  security: DesktopApiSecurity;
  storage: DesktopApiStorage;
  webview: DesktopApiWebview;
  notification: DesktopApiNotification;
  dev: DesktopApiDev;
  inAppPurchase: DesktopApiInAppPurchase;
  bluetooth: DesktopApiBluetooth;
  appUpdate: DesktopApiAppUpdate;
  bundleUpdate: DesktopApiBundleUpdate;
  cloudKit: DesktopApiCloudKit;
  keychain: DesktopApiKeychain;
  sniRequest: DesktopApiSniRequest;
  oauthLocalServer: DesktopApiOAuthLocalServer;
}
