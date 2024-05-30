import * as Linking from 'expo-linking';
import { isString } from 'lodash';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/src-electron/app';
import type { IEOneKeyDeepLinkParams } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  EOneKeyDeepLinkPath,
  ONEKEY_APP_DEEP_LINK,
  ONEKEY_APP_DEEP_LINK_NAME,
  ONEKEY_UNIVERSAL_LINK_HOST,
  WALLET_CONNECT_DEEP_LINK,
  WALLET_CONNECT_DEEP_LINK_NAME,
  WalletConnectUniversalLinkPath,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { urlAccountNavigation } from '../../../views/Home/pages/urlAccount/urlAccountUtils';
import { marketNavigation } from '../../../views/Market/marketUtils';

import { registerHandler } from './handler';

type IDeepLinkUrlParsedResult = {
  type: 'walletConnect';
  url: string;
  urlExtracted: string;
};
type IProcessDeepLinkParams = {
  url: string;
  parsedUrl: Linking.ParsedURL;
};

async function processDeepLinkUrlAccount({
  parsedUrl,
}: IProcessDeepLinkParams) {
  try {
    const { hostname, queryParams, scheme } = parsedUrl;
    if (
      scheme === ONEKEY_APP_DEEP_LINK ||
      scheme === ONEKEY_APP_DEEP_LINK_NAME
    ) {
      console.log('processDeepLinkUrlAccount: >>>>> ', parsedUrl);
      const navigation = global.$rootAppNavigation;
      switch (hostname) {
        case EOneKeyDeepLinkPath.url_account: {
          const query =
            queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.url_account];
          if (navigation) {
            await urlAccountNavigation.pushUrlAccountPageFromDeeplink(
              navigation,
              {
                networkId: query.networkCode,
                address: query.address,
              },
            );
          }
          break;
        }
        case EOneKeyDeepLinkPath.market_detail:
          {
            const { coinGeckoId } =
              queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.market_detail];
            if (navigation) {
              await marketNavigation.pushDetailPageFromDeeplink(navigation, {
                coinGeckoId,
              });
            }
          }
          break;
        default:
          break;
      }
    }
  } catch (error) {
    //
  }
}

async function processDeepLinkWalletConnect({
  url,
  parsedUrl,
}: IProcessDeepLinkParams) {
  try {
    const { hostname, path, queryParams, scheme } = parsedUrl;
    let wcUri = '';
    // define deeplink schema at
    //  - packages/web/validation/deeplink.ios.json
    //  - packages/app/app.json

    // ** ios UniversalLink
    //        https://app.onekey.so/wc/connect/wc?uri=wc%3Aeb16df1f-1d3b-4018-9d18-28ef610cc1a4%401%3Fbridge%3Dhttps%253A%252F%252Fj.bridge.walletconnect.org%26key%3D0037246aefb211f98a8386d4bf7fd2a5344960bf98cb39c57fb312a098f2eb77
    // check UniversalLink allowed path here:
    //    https://app.onekey.so/.well-known/apple-app-site-association
    if (
      hostname === ONEKEY_UNIVERSAL_LINK_HOST &&
      path === WalletConnectUniversalLinkPath
    ) {
      if (queryParams?.uri) {
        wcUri = `${queryParams.uri as string}${
          queryParams?.symKey ? `&symKey=${queryParams?.symKey as string}` : ''
        }`;
      }
    }

    // ** ios/android/desktop DeepLink
    //        onekey-wallet://wc
    // eslint-disable-next-line spellcheck/spell-checker
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
          wcUri = `${queryParams.uri as string}${
            queryParams?.symKey
              ? `&symKey=${queryParams?.symKey as string}`
              : ''
          }`;
        }
      }
    }

    // ** WalletConnect uri DeepLink
    //        wc:
    // eslint-disable-next-line spellcheck/spell-checker
    // wc:c157eb01-8262-40e4-963e-7ebee47d0eac@1?bridge=https%3A%2F%2F7.bridge.walletconnect.org&key=881d859aa3ae028e284dd03e3be1d09c486329a400509a39c85246813808956b
    if (
      scheme === WALLET_CONNECT_DEEP_LINK ||
      scheme === WALLET_CONNECT_DEEP_LINK_NAME
    ) {
      // V1
      if (queryParams?.bridge && queryParams?.key) {
        // wcUri = url;
        throw new Error('WalletConnect V1 is not supported');
      }
      // V2
      // eslint-disable-next-line spellcheck/spell-checker
      if (queryParams?.['relay-protocol'] && queryParams?.symKey) {
        wcUri = url;
      }
    }

    if (wcUri) {
      console.log('Create walletConnect connection by DeepLink: ', wcUri);

      await backgroundApiProxy.walletConnect.connectToDapp(wcUri);
      return {
        type: 'walletConnect',
        url,
        urlExtracted: wcUri,
      };
    }
  } catch (error) {
    console.error('connectToWalletConnectByDeepLink ERROR: ', error);
  }
}

const processDeepLinkUrl = memoizee(
  // parameter should be flatten, as memoizee primitive=true
  async (
    url: string | undefined,
  ): Promise<IDeepLinkUrlParsedResult | undefined> => {
    // handle deepLink URL
    if (!url) return;

    try {
      console.log('processDeepLinkUrl: >>>>> ', url);
      const parsedUrl = Linking.parse(url);
      const { hostname, path, queryParams, scheme } = parsedUrl;
      if (process.env.NODE_ENV !== 'production') {
        console.log('processDeepLinkUrl details >>>> ', {
          url,
          hostname,
          path,
          queryParams,
          scheme,
        });
      }
      await processDeepLinkUrlAccount({ url, parsedUrl });
      await processDeepLinkWalletConnect({ url, parsedUrl });
    } catch (e) {
      console.error('processDeepLinkUrl ERROR: ', e);
    }
  },
  {
    primitive: true,
    max: 20,
    maxAge: 600,
  },
);

export const handleDeepLinkUrl = (data: IDesktopOpenUrlEventData) => {
  const urls = [data.url, ...(data.argv ?? [])].filter(
    (item) => !!item && isString(item),
  );
  urls.forEach((url) => {
    console.log('processDeepLinkUrl >>>>>> ', url);
    void processDeepLinkUrl(url);
  });
};

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$handleDeepLinkUrl = handleDeepLinkUrl;
}

export const registerDeepLinking = () => registerHandler(handleDeepLinkUrl);
