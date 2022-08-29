import * as Linking from 'expo-linking';
import { debounce } from 'lodash';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import {
  ONEKEY_APP_DEEP_LINK,
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK,
  WALLET_CONNECT_DEEP_LINK_NAME,
} from '../components/WalletConnect/walletConnectConsts';

function connectToWalletConnectByDeepLink({ url }: { url: string | null }) {
  try {
    if (!url) {
      return;
    }
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

    // wc:c157eb01-8262-40e4-963e-7ebee47d0eac@1?bridge=https%3A%2F%2F7.bridge.walletconnect.org&key=881d859aa3ae028e284dd03e3be1d09c486329a400509a39c85246813808956b
    if (
      scheme === WALLET_CONNECT_DEEP_LINK ||
      scheme === WALLET_CONNECT_DEEP_LINK_NAME
    ) {
      if (queryParams?.bridge && queryParams?.key) {
        wcUri = url;
      }
    }

    if (wcUri) {
      debugLogger.walletConnect.info(
        'Create walletConnect connection by DeepLink: ',
        wcUri.slice(0, 50),
      );
      backgroundApiProxy.walletConnect.connect({
        uri: wcUri,
      });
    }
  } catch (error) {
    debugLogger.walletConnect.error(
      'connectToWalletConnectByDeepLink ERROR: ',
      error,
    );
  }
}

const connectToWalletConnectByDeepLinkDebounce = debounce(
  connectToWalletConnectByDeepLink,
  500,
  {
    leading: false,
    trailing: true,
  },
);

(async () => {
  const url = await Linking.getInitialURL();
  connectToWalletConnectByDeepLinkDebounce({ url });
})();

Linking.addEventListener('url', ({ url }) => {
  connectToWalletConnectByDeepLinkDebounce({ url });
});
