import {
  EWebEmbedPrivateRequestMethod,
  PRIME_CHECKOUT_CANCEL_MESSAGE,
} from '@onekeyhq/shared/src/consts/webEmbedConsts';

import type { IPrimeEmbeddedCheckoutSession } from './primeEmbeddedCheckoutSession';

// This bridge belongs to one page and one SDK purchase, never the singleton.
export function createPrimeWebEmbedCheckoutBridge({
  session,
  checkoutId,
  attemptId,
}: {
  session: IPrimeEmbeddedCheckoutSession;
  checkoutId: string;
  attemptId: string;
}) {
  let active = true;
  let currentAttempt = true;
  let revision = 0;
  let hostedRequestId: string | undefined;
  const publish = (requestId?: string, cancelled?: boolean) => {
    if (!active || !checkoutId) return;
    revision += 1;
    void globalThis.$onekey.$private
      .request({
        method: EWebEmbedPrivateRequestMethod.primeEmbeddedCheckoutState,
        params: {
          checkoutId,
          attemptId,
          revision,
          canSwitch: session.canSwitchToHosted(),
          requestId,
          cancelled,
        },
      })
      .catch(() => undefined);
  };
  const onMessage = (event: MessageEvent<unknown>) => {
    if (!active || event.source !== globalThis.window || hostedRequestId)
      return;
    const data = event.data as Record<string, unknown> | null;
    if (
      !data ||
      data.type !== PRIME_CHECKOUT_CANCEL_MESSAGE ||
      data.checkoutId !== checkoutId ||
      data.attemptId !== attemptId ||
      typeof data.requestId !== 'string' ||
      !data.requestId
    )
      return;
    // Recheck synchronously in the form's runtime after native confirmation.
    // A cleared target alone is insufficient: the purchase guard must also
    // observe the SDK's normal USER_CANCELLED rejection before handoff.
    if (session.cancel('hostedCheckout')) hostedRequestId = data.requestId;
    publish(data.requestId, Boolean(hostedRequestId));
  };
  const unsubscribe = session.subscribe(() => publish());
  globalThis.addEventListener('message', onMessage);
  publish();
  const dispose = () => {
    if (!active) return;
    session.finish();
    active = false;
    unsubscribe();
    globalThis.removeEventListener('message', onMessage);
  };
  return {
    isActive: () => active,
    isCurrentAttempt: () => currentAttempt,
    getHostedRequestId: () => hostedRequestId,
    dispose,
    invalidate: () => {
      currentAttempt = false;
      dispose();
    },
  };
}
