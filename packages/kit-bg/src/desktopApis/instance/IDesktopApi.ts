import type DesktopApiInAppPurchase from '../DesktopApiInAppPurchase';
import type DesktopApiSystem from '../DesktopApiSystem';

export interface IDesktopApi {
  system: DesktopApiSystem;
  inAppPurchase: DesktopApiInAppPurchase;
}
