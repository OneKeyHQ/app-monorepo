import { Linking, Platform } from 'react-native';

import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getAppNavigation } from '../../../hooks/useAppNavigation';
import {
  DappConnectionModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { EXT_HTML_FILES } from '../../../utils/extUtils.getHtml';
import { getTimeDurationMs } from '../../../utils/helper';
import unlockUtils from '../../AppLock/unlockUtils';
import { ONEKEY_APP_DEEP_LINK } from '../walletConnectConsts';

import type { WalletService } from '../types';
import type { IClientMeta } from '@walletconnect/types';

let connectionRedirectUrl = '';
if (platformEnv.isNative || platformEnv.isDesktop) {
  connectionRedirectUrl = ONEKEY_APP_DEEP_LINK;
} else if (platformEnv.isExtension) {
  connectionRedirectUrl = chrome.runtime.getURL(EXT_HTML_FILES.uiExpandTab);
} else {
  connectionRedirectUrl =
    typeof window === 'undefined' ? '' : window.location.origin;
}

// some needs url fixing cases:
/*
native: "bitkeep://",
native: "kleverwallet:",
native: "tpoutside:",
native: "bitcoincom://"
native: "wallet3:"

universal: "https://link.bitkeep.asia/fbEG/7dn25f7b"
universal: "https://safematrix.io/"
universal: "https://klever.page.link"

tpoutside://wc?uri=wc%3A993e77e0-2fe5-
bitcoincom:///wc?uri=wc%3A993e77e0-2
wallet3://wc?uri=wc%3A993e77e0-2fe5-41c4-8e

https://link.bitkeep.asia/fbEG/7dn25f7b/wc?uri=wc%3A993e77e0-2
https://safematrix.io//wc?uri=wc%3A993e77e0-2fe5-41c4-8
 */

function formatDeeplinkUrl({ prefix, url }: { prefix: string; url: string }) {
  /*
  bitcoincom://
  /wc?uri=wc%3A993e77e0-2

  bitcoincom:///wc?uri=wc%3A993e77e0-2
   */
  if (prefix.endsWith('://')) {
    return `${prefix}${url}`;
  }

  /*
  tpoutside:
  /wc?uri=wc%3A993e77e0-2

  tpoutside://wc?uri=wc%3A993e77e0-2
   */
  const prefix0 = prefix.replace(/:$/, '');
  const url0 = url.replace(/^\/+/, '');
  return `${prefix0}://${url0}`;
}

function formatWalletServiceUrl({
  walletService,
  url,
}: {
  walletService: WalletService;
  url: string;
}) {
  const { mobile } = walletService;
  const { universal: universalLink, native: deepLink } = mobile;
  if (platformEnv.isNativeAndroid) {
    return formatDeeplinkUrl({
      prefix: deepLink,
      url,
    });
  }
  /*
  https://safematrix.io/
  /wc?uri=wc%3A993e77e0-2fe5-41c4-8

  https://safematrix.io//wc?uri=wc%3A993e77e0-2fe5-41c4-8
   */
  if (universalLink) {
    return `${universalLink}${url}`;
  }
  return formatDeeplinkUrl({
    prefix: deepLink,
    url,
  });
}

function buildRedirectUrl() {
  const maybeRedirectUrl = connectionRedirectUrl
    ? `redirectUrl=${encodeURIComponent(connectionRedirectUrl)}`
    : '';
  return maybeRedirectUrl;
}

function buildConnectWalletAppUrl({
  uri,
  walletService,
}: {
  uri: string;
  walletService: WalletService;
}) {
  const maybeRedirectUrl = buildRedirectUrl();
  const connectionUrl = formatWalletServiceUrl({
    walletService,
    url: `/wc?uri=${encodeURIComponent(uri)}&${maybeRedirectUrl}`,
  });
  // https://rnbwapp.com/wc?uri=wc:&redirectUrl=yourappscheme://
  return connectionUrl;
}

function buildOpenWalletAppUrl({
  walletService,
}: {
  walletService: WalletService;
}) {
  const maybeRedirectUrl = buildRedirectUrl();
  return formatWalletServiceUrl({
    walletService,
    url: `/wc?${maybeRedirectUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function dappOpenWalletAppForAndroidLegacy({
  peerMeta,
  walletServices,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  walletService,
}: {
  peerMeta: IClientMeta;
  walletServices: WalletService[];
  walletService: WalletService;
}) {
  if (!!peerMeta && typeof peerMeta === 'object') {
    const [maybeShortName] = `${peerMeta.name || ''}`
      .toLowerCase()
      .split(/\s+/);
    if (typeof maybeShortName === 'string' && !!maybeShortName.length) {
      const [...maybeMatchingServices] = (walletServices || []).filter(
        ({ metadata: { shortName } }) =>
          `${shortName}`.toLowerCase() === maybeShortName,
      );
      if (maybeMatchingServices.length === 1) {
        const [detectedWalletService] = maybeMatchingServices;
        const url = buildOpenWalletAppUrl({
          walletService: detectedWalletService,
        });
        if (await Linking.canOpenURL(url)) {
          return Linking.openURL(url);
        }
      }
    }
  }
  Linking.openURL('wc:');
}

// node_modules/@walletconnect/react-native-dapp/dist/providers/WalletConnectProvider.js
//    nextConnector.on(ConnectorEvents.CALL_REQUEST_SENT, async (error)
async function dappOpenWalletApp({
  walletService,
}: {
  walletService: WalletService;
}) {
  // TODO desktop deeplink open?
  // web dapp do not need to open wallet app
  if (Platform.OS === 'web') {
    return;
  }
  // android dapp check legacy
  if (platformEnv.isNativeAndroid) {
    // return dappOpenWalletAppForAndroidLegacy({
    //   peerMeta,
    //   walletServices,
    //   walletService,
    // });
  }

  // ios/android dapp
  if (!walletService) {
    throw new Error('Cached WalletService not found.');
  }
  const url = buildOpenWalletAppUrl({ walletService });
  if (await Linking.canOpenURL(url)) {
    return Linking.openURL(url);
  }
  if (platformEnv.isNativeAndroid) {
    debugLogger.walletConnect.info(
      'android open url failed, fallback to wc: >>>>> ',
      { url },
    );
    if (await Linking.canOpenURL('wc:')) {
      return Linking.openURL('wc:');
    }
  }
}

async function openConnectToDappModal({
  uri,
  isDeepLink,
}: {
  uri: string;
  isDeepLink?: boolean;
}) {
  await waitForDataLoaded({
    data: () => getAppNavigation(),
    logName: 'openConnectToDappModal wait navigation ready',
    timeout: getTimeDurationMs({ minute: 1 }),
  });
  const navigation = getAppNavigation();
  if (!navigation) {
    return;
  }
  const showWalletConnectConnectionModal = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.DappConnectionModal,
      params: {
        screen: DappConnectionModalRoutes.ConnectionModal,
        params: {
          walletConnectUri: uri,
          isDeepLink,
          refreshKey: Date.now(),
        },
      },
    });
  };

  if (platformEnv.isExtension) {
    showWalletConnectConnectionModal();
  } else {
    unlockUtils.runAfterUnlock(() => {
      showWalletConnectConnectionModal();
    });
  }
}

// V2:
//  wc:6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe@2?relay-protocol=irn&symKey=99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355
// V1:
//  wc:7a2eabf0-a5ab-4df5-805c-1bf50da956c7@1?bridge=https%3A%2F%2Fx.bridge.walletconnect.org&key=a1bc7b3461fc0c017288c06bbfddd4d00fa187409821b3f909f2125b33277e0d
function getWalletConnectUriInfo({ uri }: { uri: string }) {
  let uriInfo;
  try {
    uriInfo = new URL(uri);
  } catch (e) {
    return null;
  }

  const { searchParams } = uriInfo;
  let v1: { bridge: string; key: string } | undefined;
  if (uri.includes('@1')) {
    const bridge = searchParams.get('bridge') || '';
    const key = searchParams.get('key') || '';
    v1 = {
      bridge,
      key,
    };
  }

  let v2:
    | {
        relayProtocol: string;
        symKey: string;
      }
    | undefined;
  if (uri.includes('@2')) {
    const relayProtocol = searchParams.get('relay-protocol') || '';
    const symKey = searchParams.get('symKey') || '';
    v2 = {
      relayProtocol,
      symKey,
    };
  }

  return {
    v1,
    v2,
    uriInfo,
  };
}

function buildOneKeyWalletConnectDeepLinkUrl({ uri }: { uri: string }) {
  return `${ONEKEY_APP_DEEP_LINK}/wc?uri=${encodeURIComponent(uri || '')}`;
}

export default {
  getWalletConnectUriInfo,
  buildConnectWalletAppUrl,
  buildOpenWalletAppUrl,
  dappOpenWalletApp,
  openConnectToDappModal,
  buildOneKeyWalletConnectDeepLinkUrl,
};
