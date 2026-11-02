import * as Linking from 'expo-linking';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { isBinanceConnectDeepLink } from './binanceConnectDeepLink';

import type { IRegisterHandler } from './handler.type';

// Loaded on demand to stay off the startup graph. A cold start can request
// the bundle segment before the runtime is able to load it, so the import is
// tried once more after a short wait. Nothing caught here is inspected: it
// may quote the URL.
async function consumeBinanceDepositReturn(url: string, isLaunchUrl: boolean) {
  for (const delayMs of [0, 600]) {
    try {
      if (delayMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      const { handleBinanceDepositReturn } =
        await import('./binanceDepositReturn');
      await handleBinanceDepositReturn(url, isLaunchUrl);
      return;
    } catch {
      // Retried once.
    }
  }
}

export const registerHandler: IRegisterHandler = (
  handleDeepLinkUrl: (e: IDesktopOpenUrlEventData) => void,
) => {
  const nativeLinkingHandler = (
    { url }: { url: string },
    isLaunchUrl = false,
  ) => {
    // The Binance deposit return carries a one-time nonce. It is consumed
    // here and never enters the generic pipeline, which logs the URL.
    if (isBinanceConnectDeepLink(url)) {
      void consumeBinanceDepositReturn(url, isLaunchUrl);
      return url;
    }
    // TODO: maybe need to edit WalletConnect landing page
    handleDeepLinkUrl({ url });
    if (platformEnv.isNativeIOS && Linking.getLinkingURL() === url) {
      Linking.clearInitialURL();
    }
    return url;
  };

  void (async () => {
    const initialUrl = await Linking.getInitialURL();
    // An iOS host started in the background keeps its original launch options.
    const url =
      initialUrl ?? (platformEnv.isNativeIOS ? Linking.getLinkingURL() : null);
    if (url) {
      nativeLinkingHandler({ url }, true);
    }
  })();

  Linking.addEventListener('url', nativeLinkingHandler);
};
