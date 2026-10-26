import { PRIME_PURCHASE_COMPLETE_PATH } from '../routes/tabHome';

import type { IPrimeWebCheckoutExtensionContext } from '../../types/prime/primeTypes';

export type IPrimeWebCheckoutReturnSender = {
  tabId?: number;
  frameId?: number;
  url?: string;
};

function isPurchaseCompleteUrl(url: string | undefined) {
  if (!url) {
    return false;
  }
  try {
    const { pathname } = new URL(url);
    return pathname.replace(/\/+$/u, '') === PRIME_PURCHASE_COMPLETE_PATH;
  } catch {
    return false;
  }
}

// The extension only treats a return as genuine when it comes from the top
// frame of the recorded checkout tab, on the return route, in the browser
// session that recorded the tab. Any other first-party tab must never close
// a checkout that is still in progress.
export function isPrimeWebCheckoutReturnFromCheckoutTab({
  extension,
  browserSessionId,
  sender,
}: {
  extension: IPrimeWebCheckoutExtensionContext | undefined;
  browserSessionId: string | undefined;
  sender: IPrimeWebCheckoutReturnSender | undefined;
}): boolean {
  return Boolean(
    extension &&
    browserSessionId &&
    extension.browserSessionId === browserSessionId &&
    extension.checkoutTabId !== undefined &&
    sender?.tabId === extension.checkoutTabId &&
    sender.frameId === 0 &&
    isPurchaseCompleteUrl(sender.url),
  );
}
