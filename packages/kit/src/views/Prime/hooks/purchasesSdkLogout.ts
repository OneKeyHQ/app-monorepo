import { Purchases } from '@revenuecat/purchases-js';

export async function logoutPurchasesSdk() {
  try {
    if (!Purchases.isConfigured()) {
      return;
    }
    await Purchases.getSharedInstance().changeUser(
      Purchases.generateRevenueCatAnonymousAppUserId(),
    );
  } catch (e) {
    console.error('[Prime] Purchases.changeUser anonymous error:', e);
  }
}
