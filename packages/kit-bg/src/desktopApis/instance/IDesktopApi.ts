import type DesktopApiBluetooth from '../DesktopApiBluetooth';
import type DesktopApiDev from '../DesktopApiDev';
import type DesktopApiInAppPurchase from '../DesktopApiInAppPurchase';
import type DesktopApiNotification from '../DesktopApiNotification';
import type DesktopApiSecurity from '../DesktopApiSecurity';
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
}
