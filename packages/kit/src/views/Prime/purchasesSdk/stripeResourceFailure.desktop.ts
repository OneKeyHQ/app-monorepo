import { EDesktopIpcChannel } from '@onekeyhq/shared/src/consts/desktopIpcChannels';

function handleForbiddenPayload(
  details: unknown,
  onForbidden: (requestStartedAt: number) => void,
) {
  if (
    details &&
    typeof details === 'object' &&
    'statusCode' in details &&
    details.statusCode === 403 &&
    'requestStartedAt' in details &&
    typeof details.requestStartedAt === 'number' &&
    Number.isFinite(details.requestStartedAt)
  ) {
    onForbidden(details.requestStartedAt);
  }
}

export function subscribeToStripeResourceForbidden(
  onForbidden: (requestStartedAt: number) => void,
): () => void {
  const unsubscribeIpc = globalThis.desktopApi?.on(
    EDesktopIpcChannel.PRIME_STRIPE_RESOURCE_FORBIDDEN,
    (details: unknown) => {
      handleForbiddenPayload(details, onForbidden);
    },
  );

  // In the isolated Prime checkout <webview>, desktopApi is absent; the main
  // process dispatches a CustomEvent on the guest window instead.
  const handleWindowEvent = (event: Event) => {
    handleForbiddenPayload((event as CustomEvent).detail, onForbidden);
  };
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener(
      EDesktopIpcChannel.PRIME_STRIPE_RESOURCE_FORBIDDEN,
      handleWindowEvent,
    );
  }

  return () => {
    unsubscribeIpc?.();
    if (typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener(
        EDesktopIpcChannel.PRIME_STRIPE_RESOURCE_FORBIDDEN,
        handleWindowEvent,
      );
    }
  };
}
