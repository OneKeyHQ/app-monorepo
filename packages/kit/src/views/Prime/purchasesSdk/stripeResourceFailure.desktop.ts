import { EDesktopIpcChannel } from '@onekeyhq/shared/src/consts/desktopIpcChannels';

export function subscribeToStripeResourceForbidden(
  onForbidden: (requestStartedAt: number) => void,
): () => void {
  return (
    globalThis.desktopApi?.on(
      EDesktopIpcChannel.PRIME_STRIPE_RESOURCE_FORBIDDEN,
      (details: unknown) => {
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
      },
    ) ?? (() => {})
  );
}
