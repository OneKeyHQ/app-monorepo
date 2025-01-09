import * as Linking from 'expo-linking';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/src-electron/app';

import type { IRegisterHandler } from './handler.type';

export const registerHandler: IRegisterHandler = (
  handleDeepLinkUrl: (e: IDesktopOpenUrlEventData) => void,
) => {
  const nativeLinkingHandler = ({ url }: { url: string }) => {
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
