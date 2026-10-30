import { PRIME_CHECKOUT_CANCEL_MESSAGE } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import type { IPrimeEmbeddedCheckoutState } from '@onekeyhq/shared/src/consts/webEmbedConsts';

// Native-side lifetime and replay protection for one embedded checkout only.
export function createPrimeCheckoutHandoff(
  checkoutId: string,
  onChange: () => void,
) {
  let active = true;
  let state: IPrimeEmbeddedCheckoutState | undefined;
  let confirmation: string | undefined;
  let pending: string | undefined;
  const canSwitch = () =>
    Boolean(active && state?.canSwitch && !confirmation && !pending);
  return {
    canSwitch,
    hasAttempt: () => Boolean(state),
    receiveState: (params: unknown) => {
      const next = params as IPrimeEmbeddedCheckoutState | undefined;
      if (
        !active ||
        !next ||
        next.checkoutId !== checkoutId ||
        typeof next.attemptId !== 'string' ||
        !next.attemptId ||
        !Number.isSafeInteger(next.revision) ||
        next.revision < 1 ||
        typeof next.canSwitch !== 'boolean' ||
        (state &&
          (next.attemptId !== state.attemptId ||
            next.revision <= state.revision))
      )
        return;
      state = next;
      if (!next.canSwitch) confirmation = undefined;
      if (next.requestId === pending && next.cancelled === false)
        pending = undefined;
      onChange();
    },
    beginConfirmation: (requestId: string) => {
      if (!canSwitch()) return false;
      confirmation = requestId;
      onChange();
      return true;
    },
    dismissConfirmation: (requestId: string) => {
      if (confirmation !== requestId) return;
      confirmation = undefined;
      onChange();
    },
    confirm: (requestId: string) => {
      if (!active || !state?.canSwitch || confirmation !== requestId || pending)
        return undefined;
      confirmation = undefined;
      pending = requestId;
      onChange();
      return {
        type: PRIME_CHECKOUT_CANCEL_MESSAGE,
        checkoutId,
        attemptId: state.attemptId,
        requestId,
      };
    },
    acceptFallback: (params: unknown) => {
      const data = params as Record<string, unknown> | undefined;
      if (
        !active ||
        !state ||
        !data ||
        data.checkoutId !== checkoutId ||
        data.attemptId !== state.attemptId ||
        (data.trigger === 'userRequestedHostedCheckout' &&
          (!pending || data.requestId !== pending))
      )
        return false;
      active = false;
      onChange();
      return true;
    },
    invalidate: () => {
      active = false;
      confirmation = undefined;
      pending = undefined;
      onChange();
    },
  };
}
