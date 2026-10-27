import * as Linking from 'expo-linking';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IRegisterHandler } from './handler.type';

export const registerHandler: IRegisterHandler = (
  handleDeepLinkUrl: (e: IDesktopOpenUrlEventData) => void,
) => {
  const nativeLinkingHandler = ({ url }: { url: string }) => {
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
      nativeLinkingHandler({ url });
    }
  })();

  Linking.addEventListener('url', nativeLinkingHandler);
};
