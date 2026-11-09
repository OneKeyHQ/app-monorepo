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
  getGuestWebContents?: (
    webContentsId: number,
  ) =>
    | Pick<WebContents, 'id' | 'isDestroyed' | 'executeJavaScript'>
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
      if (!isStripeFormResource(details.url)) {
        return;
      }
      const main = getMainWebContents();
      if (main && !main.isDestroyed() && details.webContentsId === main.id) {
        requests.set(details.id, {
          webContentsId: main.id,
          requestStartedAt: Date.now(),
        });
        return;
      }
      const guest =
        typeof details.webContentsId === 'number'
          ? getGuestWebContents?.(details.webContentsId)
          : undefined;
      if (guest && !guest.isDestroyed() && details.webContentsId === guest.id) {
        requests.set(details.id, {
          webContentsId: guest.id,
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
      if (
        !request ||
        details.statusCode !== 403 ||
        details.webContentsId !== request.webContentsId ||
        !isStripeFormResource(details.url)
      ) {
        return;
      }
      const main = getMainWebContents();
      if (main && !main.isDestroyed() && request.webContentsId === main.id) {
        // No URLs, headers, billing identifiers, or response bodies cross IPC.
        main.send(EDesktopIpcChannel.PRIME_STRIPE_RESOURCE_FORBIDDEN, {
          requestStartedAt: request.requestStartedAt,
          statusCode: 403,
        });
        return;
      }
      const guest = getGuestWebContents?.(request.webContentsId);
      if (guest && !guest.isDestroyed() && request.webContentsId === guest.id) {
        const eventName = JSON.stringify(
          EDesktopIpcChannel.PRIME_STRIPE_RESOURCE_FORBIDDEN,
        );
        const startedAt = Number(request.requestStartedAt);
        void Promise.resolve(
          guest.executeJavaScript(
            `window.dispatchEvent(new CustomEvent(${eventName}, { detail: { requestStartedAt: ${startedAt}, statusCode: 403 } }))`,
          ),
        ).catch(() => undefined);
      }
    },
    forgetRequest: (requestId: number) => {
      requests.delete(requestId);
    },
  };
}
