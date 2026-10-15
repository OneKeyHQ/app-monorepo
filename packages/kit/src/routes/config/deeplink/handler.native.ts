import * as Linking from 'expo-linking';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';

import { isBinanceConnectDeepLink } from './binanceConnectDeepLink';

import type { IRegisterHandler } from './handler.type';

// Loaded on demand to stay off the startup graph. A cold start can request
// the bundle segment before the runtime is able to load it, so the import is
// tried once more after a short wait. Nothing caught here is inspected: it
// may quote the URL.
async function consumeBinanceDepositReturn(url: string) {
  for (const delayMs of [0, 600]) {
    try {
      if (delayMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      const { handleBinanceDepositReturn } =
        await import('./binanceDepositReturn');
      await handleBinanceDepositReturn(url);
      return;
    } catch {
      // Retried once.
    }
  }
}

export const registerHandler: IRegisterHandler = (
  handleDeepLinkUrl: (e: IDesktopOpenUrlEventData) => void,
) => {
  const nativeLinkingHandler = ({ url }: { url: string }) => {
    // The Binance deposit return carries a one-time nonce. It is consumed
    // here and never enters the generic pipeline, which logs the URL.
    if (isBinanceConnectDeepLink(url)) {
      void consumeBinanceDepositReturn(url);
      return url;
    }
    // TODO: maybe need to edit WalletConnect landing page
    handleDeepLinkUrl({ url });
    return url;
  };

  void (async () => {
    const url = await Linking.getInitialURL();
    if (url) {
      nativeLinkingHandler({ url });
    }
  })();

  Linking.addEventListener('url', nativeLinkingHandler);
};
