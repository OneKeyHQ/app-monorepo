export type IPrimeEmbeddedCheckoutCancellation =
  | 'hostedCheckout'
  | 'loadFailure';

export function createPrimeEmbeddedCheckoutSession(root: HTMLElement) {
  let submitted = false;
  let finished = false;
  let cancellation: IPrimeEmbeddedCheckoutCancellation | undefined;
  let canSwitch = false;
  const listeners = new Set<() => void>();
  const getCloseButton = () =>
    root.querySelector<HTMLButtonElement>('button.close-button');
  const update = () => {
    const close = getCloseButton();
    const next = Boolean(
      root.isConnected &&
      close &&
      !close.disabled &&
      !submitted &&
      !finished &&
      !cancellation,
    );
    if (canSwitch !== next) {
      canSwitch = next;
      listeners.forEach((listener) => listener());
    }
  };
  // Capture before the SDK's submit handler can start Stripe confirmation.
  // Keep this sticky even after an error: the payment outcome may be unknown.
  const onSubmit = () => {
    submitted = true;
    update();
  };
  root.addEventListener('submit', onSubmit, true);
  const observer = new MutationObserver(update);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['disabled'],
  });
  update();

  return {
    root,
    canSwitchToHosted: () => canSwitch,
    hasSubmitted: () => submitted,
    getCancellation: () => cancellation,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    cancel: (reason: IPrimeEmbeddedCheckoutCancellation) => {
      update();
      const close = getCloseButton();
      if (!canSwitch || !close) return false;
      cancellation = reason;
      update();
      close.click();
      // The supported SDK clears its target synchronously before rejecting.
      // An ignored close must leave the current checkout retryable.
      if (root.childNodes.length > 0) {
        cancellation = undefined;
        update();
        return false;
      }
      return true;
    },
    finish: () => {
      finished = true;
      update();
      observer.disconnect();
      root.removeEventListener('submit', onSubmit, true);
      listeners.clear();
    },
  };
}

export type IPrimeEmbeddedCheckoutSession = ReturnType<
  typeof createPrimeEmbeddedCheckoutSession
>;
