import { EDesktopIpcChannel } from '@onekeyhq/shared/src/consts/desktopIpcChannels';

import type {
  OnBeforeRequestListenerDetails,
  OnHeadersReceivedListenerDetails,
  WebContents,
} from 'electron';

function isStripeFormResource(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'js.stripe.com' &&
      /^\/v3\/(?:fingerprinted\/(?:js|css)\/)?(?:elements-inner-(?:payment|loader-ui|accessory-(?:target|render))|controller(?:-with-preconnect)?)(?:-[\da-z]+)+\.(?:html|js|css)$/.test(
        parsed.pathname,
      )
    );
  } catch {
    return false;
  }
}

export function createPrimeStripeRequestMonitor(
  getMainWebContents: () =>
    | Pick<WebContents, 'id' | 'isDestroyed' | 'send'>
    | undefined,
) {
  const requests = new Map<
    number,
    { webContentsId: number; requestStartedAt: number }
  >();
  return {
    recordRequest: (
      details: Pick<
        OnBeforeRequestListenerDetails,
        'id' | 'url' | 'webContentsId'
      >,
    ) => {
      const main = getMainWebContents();
      if (
        main &&
        !main.isDestroyed() &&
        details.webContentsId === main.id &&
        isStripeFormResource(details.url)
      ) {
        requests.set(details.id, {
          webContentsId: main.id,
          requestStartedAt: Date.now(),
        });
      }
    },
    receiveResponse: (
      details: Pick<
        OnHeadersReceivedListenerDetails,
        'id' | 'url' | 'statusCode' | 'webContentsId'
      >,
    ) => {
      const request = requests.get(details.id);
      requests.delete(details.id);
      const main = getMainWebContents();
      if (
        request &&
        main &&
        !main.isDestroyed() &&
        details.statusCode === 403 &&
        details.webContentsId === main.id &&
        request.webContentsId === main.id &&
        isStripeFormResource(details.url)
      ) {
        // No URLs, headers, billing identifiers, or response bodies cross IPC.
        main.send(EDesktopIpcChannel.PRIME_STRIPE_RESOURCE_FORBIDDEN, {
          requestStartedAt: request.requestStartedAt,
          statusCode: 403,
        });
      }
    },
    forgetRequest: (requestId: number) => {
      requests.delete(requestId);
    },
  };
}
