import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

async function assertPurchaseUserCurrent(onekeyUserId: string) {
  const user = await backgroundApiProxy.servicePrime.getLocalUserInfo();
  if (!user.isLoggedIn || user.onekeyUserId !== onekeyUserId) {
    throw new OneKeyLocalError('Prime purchase user changed');
  }
}

// Retires local hosted result ownership before an embedded purchase can
// activate the same entitlement. This does not cancel the external checkout.
export async function retirePrimeWebCheckout(onekeyUserId: string | undefined) {
  if (!onekeyUserId) {
    throw new OneKeyLocalError('User not logged in');
  }
  const session =
    await backgroundApiProxy.simpleDb.prime.getWebCheckoutPendingSession({
      onekeyUserId,
    });
  await assertPurchaseUserCurrent(onekeyUserId);
  if (!session) {
    return;
  }
  const cleared =
    await backgroundApiProxy.simpleDb.prime.clearWebCheckoutPendingSession({
      onekeyUserId,
      expectedCheckoutId: session.checkoutId,
    });
  if (!cleared) {
    throw new OneKeyLocalError('Prime web checkout session changed');
  }
  await assertPurchaseUserCurrent(onekeyUserId);
}
