import type DesktopApiDev from '../DesktopApiDev';
import type DesktopApiInAppPurchase from '../DesktopApiInAppPurchase';
import type DesktopApiNetwork from '../DesktopApiNetwork';
import type DesktopApiNotification from '../DesktopApiNotification';
import type DesktopApiSecurity from '../DesktopApiSecurity';
import type DesktopApiStorage from '../DesktopApiStorage';
import type DesktopApiSystem from '../DesktopApiSystem';
import type DesktopApiUpdater from '../DesktopApiUpdater';

export interface IDesktopApi {
  system: DesktopApiSystem;
  security: DesktopApiSecurity;
  storage: DesktopApiStorage;
  updater: DesktopApiUpdater;
  network: DesktopApiNetwork;
  notification: DesktopApiNotification;
  dev: DesktopApiDev;
  inAppPurchase: DesktopApiInAppPurchase;
}
