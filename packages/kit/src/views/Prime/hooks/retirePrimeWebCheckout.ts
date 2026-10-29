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
// Removing the record, rather than resuming that checkout, keeps the click a
// new payment (see startPrimeHostedCardCheckout). It must not stay either:
// hosted success is matched by entitlement (Web Billing store, sandbox mode,
// purchase time), so recovery would settle the embedded purchase as the old
// hosted checkout and report the success a second time. If the user pays the
// old page instead, RevenueCat still activates Prime and the next user info
// refresh shows it, only without the hosted success toast and event.
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
