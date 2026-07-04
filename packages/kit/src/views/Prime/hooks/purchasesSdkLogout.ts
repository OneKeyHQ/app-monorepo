import { loadPurchasesSdkWeb } from '../purchasesSdk/purchasesSdkWebLoader';

export async function logoutPurchasesSdk() {
  try {
    const { Purchases } = await loadPurchasesSdkWeb();
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
