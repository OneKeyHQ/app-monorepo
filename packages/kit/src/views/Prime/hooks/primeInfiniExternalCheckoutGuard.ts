/* cspell:ignore Infini */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export async function getPrimeInfiniExternalCheckoutGuard() {
  const userInfo = await backgroundApiProxy.servicePrime.getLocalUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.onekeyUserId) {
    return {
      isLoggedIn: false,
      hasPendingPayment: false,
      onekeyUserId: undefined,
    };
  }
  const pendingPaymentSession =
    await backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession({
      onekeyUserId: userInfo.onekeyUserId,
    });
  return {
    isLoggedIn: true,
    hasPendingPayment: Boolean(pendingPaymentSession),
    onekeyUserId: userInfo.onekeyUserId,
  };
}
