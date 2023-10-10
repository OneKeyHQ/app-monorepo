import * as Linking from 'expo-linking';
import { isString } from 'lodash';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/src-electron/app';
import type { DesktopAPI } from '@onekeyhq/desktop/src-electron/preload';
import {
  ONEKEY_APP_DEEP_LINK,
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from '@onekeyhq/shared/src/consts/urlProtocolConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import walletConnectUtils from '../components/WalletConnect/utils/walletConnectUtils';

type IDeepLinkUrlParsedResult = {
  type: 'walletConnect';
  url: string;
  urlExtracted: string;
};
export const WalletConnectUniversalLinkPath = 'wc/connect/wc';
export const WalletConnectUniversalLinkPathSchema = `/wc/connect/wc`; // do not add ? at the end (which meaning optional)
const processDeepLinkUrl = memoizee(
  // parameter should be flatten, as memoizee primitive=true
  (url: string | undefined): IDeepLinkUrlParsedResult | undefined => {
    try {
      if (!url) {
        return;
      }
      debugLogger.deepLink.info(
        'connectToWalletConnectByDeepLink: ',
        url.slice(0, 50),
      );
      const { hostname, path, queryParams, scheme } = Linking.parse(url);
      if (process.env.NODE_ENV !== 'production') {
        console.log('connectToWalletConnectByDeepLink >>>> ', {
          url,
          hostname,
          path,
          queryParams,
          scheme,
        });
      }
      let wcUri = '';

      // define deeplink schema at
      //  - packages/web/validation/deeplink.ios.json
      //  - packages/app/app.json

      // ** ios UniversalLink
      //        https://app.onekey.so/wc/connect/wc?uri=wc%3Aeb16df1f-1d3b-4018-9d18-28ef610cc1a4%401%3Fbridge%3Dhttps%253A%252F%252Fj.bridge.walletconnect.org%26key%3D0037246aefb211f98a8386d4bf7fd2a5344960bf98cb39c57fb312a098f2eb77
      if (
        hostname === 'app.onekey.so' &&
        path === WalletConnectUniversalLinkPath
      ) {
        if (queryParams?.uri) {
          wcUri = queryParams.uri as string;
        }
      }

      // ** ios/android/desktop DeepLink
      //        onekey-wallet://wc
      // onekey-wallet://wc?uri=wc%3Afa75a793-a3fb-48e4-8629-8f1f034ec6eb%401%3Fbridge%3Dhttps%253A%252F%252Fy.bridge.walletconnect.org%26key%3D9e97f71a32b4e629cb60106295dca54d733d124da480b4031d0d848b678fd610/
      if (
        scheme === ONEKEY_APP_DEEP_LINK ||
        scheme === ONEKEY_APP_DEEP_LINK_NAME
      ) {
        if (
          (path === WALLET_CONNECT_DEEP_LINK_NAME && !hostname) ||
          (hostname === WALLET_CONNECT_DEEP_LINK_NAME && !path)
        ) {
          if (queryParams?.uri) {
            wcUri = queryParams.uri as string;
          }
        }
      }

      // ** WalletConnect uri DeepLink
      //        wc:
      // wc:c157eb01-8262-40e4-963e-7ebee47d0eac@1?bridge=https%3A%2F%2F7.bridge.walletconnect.org&key=881d859aa3ae028e284dd03e3be1d09c486329a400509a39c85246813808956b
      if (
        scheme === WALLET_CONNECT_DEEP_LINK ||
        scheme === WALLET_CONNECT_DEEP_LINK_NAME
      ) {
        // V1
        if (queryParams?.bridge && queryParams?.key) {
          wcUri = url;
        }
        // V2
        if (queryParams?.['relay-protocol'] && queryParams?.symKey) {
          wcUri = url;
        }
      }

      if (wcUri) {
        debugLogger.deepLink.info(
          'Create walletConnect connection by DeepLink: ',
          wcUri.slice(0, 50),
        );
        walletConnectUtils.openConnectToDappModal({
          uri: wcUri,
          isDeepLink: true,
        });
        return {
          type: 'walletConnect',
          url,
          urlExtracted: wcUri,
        };
      }
    } catch (error) {
      debugLogger.deepLink.error(
        'connectToWalletConnectByDeepLink ERROR: ',
        error,
      );
    }
  },
  {
    // promise: true,
    primitive: true,
    max: 20,
    maxAge: 600,
  },
);

export const handleDeepLinkUrl = (data: IDesktopOpenUrlEventData) => {
  const urls = [data.url, ...(data.argv ?? [])].filter(
    (item) => !!item && isString(item),
  );
  urls.forEach((url) => processDeepLinkUrl(url));
};

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$handleDeepLinkUrl = handleDeepLinkUrl;
}

// electron desktop deeplink handler
if (platformEnv.isDesktop) {
  const desktopLinkingHandler = (
    event: Event,
    data: IDesktopOpenUrlEventData,
  ) => {
    if (process.env.NODE_ENV !== 'production') {
      debugLogger.deepLink.info('desktopApi event-open-url', data);
    }

    handleDeepLinkUrl(data);
  };
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  const desktopApi: DesktopAPI = global.desktopApi as DesktopAPI;
  try {
    desktopApi.removeIpcEventListener('event-open-url', desktopLinkingHandler);
  } catch {
    // noop
  }
  desktopApi.addIpcEventListener('event-open-url', desktopLinkingHandler);
  desktopApi.ready();
}

// android ios native deeplink handler
if (platformEnv.isNative) {
  const nativeLinkingHandler = ({ url }: { url: string }) => {
    handleDeepLinkUrl({ url });
  };

  (async () => {
    const url = await Linking.getInitialURL();
    if (url) {
      nativeLinkingHandler({ url });
    }
  })();

  try {
    // remove cause app error, and can't catch
    // Linking.removeEventListener('url', linkingHandler);
  } catch {
    // noop
  }
  Linking.addEventListener('url', nativeLinkingHandler);
}
