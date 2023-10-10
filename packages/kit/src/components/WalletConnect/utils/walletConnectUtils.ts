import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getChainFromAccount,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getChainsFromNamespace,
  isValidChainId,
  parseChainId,
  parseUri,
} from '@walletconnect-v2/utils';
import { uniq } from 'lodash';
import { Linking, Platform } from 'react-native';

import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import { ONEKEY_APP_DEEP_LINK } from '@onekeyhq/shared/src/consts/urlProtocolConsts';
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

import type { WalletService } from '../types';
import type { ISessionStatusPro } from '../WalletConnectClientForDapp';
import type {
  EngineTypes,
  ProposalTypes,
  SessionTypes,
} from '@walletconnect-v2/types';
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

  const parsed: EngineTypes.UriParameters = parseUri(uri);

  const { searchParams } = uriInfo;
  let v1:
    | { bridge: string; key: string; parsed: EngineTypes.UriParameters }
    | undefined;
  if (uri.includes('@1') || parsed.version === 1) {
    const bridge = searchParams.get('bridge') || '';
    const key = searchParams.get('key') || '';
    v1 = {
      bridge,
      key,
      parsed,
    };
  }

  let v2:
    | {
        relayProtocol: string;
        symKey: string;
        parsed: EngineTypes.UriParameters;
      }
    | undefined;
  if (uri.includes('@2') || parsed.version === 2) {
    const relayProtocol = searchParams.get('relay-protocol') || '';
    const symKey = searchParams.get('symKey') || '';
    v2 = {
      relayProtocol,
      symKey,
      parsed,
    };
  }

  return {
    v1,
    v2,
    uriInfo,
  };
}

function isWalletConnectV2({ uri }: { uri: string }): boolean {
  const info = getWalletConnectUriInfo({ uri });
  return Boolean(info && info.v2 && info.v2?.parsed?.version === 2);
}

function buildOneKeyWalletConnectDeepLinkUrl({ uri }: { uri: string }) {
  return `${ONEKEY_APP_DEEP_LINK}/wc?uri=${encodeURIComponent(uri || '')}`;
}

function isEvmNamespaceV2(namespace?: string) {
  return namespace === 'eip155';
}

function getChainIdFromNamespaceChainV2({ chain }: { chain: string }): {
  namespace?: string;
  chainId?: string;
} {
  if (isValidChainId(chain)) {
    const { namespace, reference } = parseChainId(chain);
    return { namespace, chainId: reference };
  }
  return { namespace: undefined, chainId: undefined };
}

function mergeSessionNamespace({
  ns1,
  ns2,
}: {
  ns1: SessionTypes.Namespace;
  ns2: SessionTypes.Namespace;
}): SessionTypes.Namespace {
  if (!ns2) {
    return ns1;
  }
  if (!ns1) {
    return ns2;
  }
  const mergeArrayItems = (a?: any[], b?: any[]): any[] =>
    uniq([...(a || []), ...(b || [])]).filter(Boolean);
  return {
    chains: mergeArrayItems(ns1.chains, ns2.chains),
    accounts: mergeArrayItems(ns1.accounts, ns2.accounts),
    methods: mergeArrayItems(ns1.methods, ns2.methods),
    events: mergeArrayItems(ns1.events, ns2.events),
  };
}

function convertToSessionNamespacesV2({
  sessionStatus,
  requiredNamespaces,
  optionalNamespaces,
  onError,
}: {
  sessionStatus: ISessionStatusPro;
  requiredNamespaces: ProposalTypes.RequiredNamespaces;
  optionalNamespaces: ProposalTypes.OptionalNamespaces | undefined;
  onError?: (e: Error) => void;
}) {
  /* https://docs.walletconnect.com/2.0/specs/clients/sign/namespaces#proposal-namespace
    requiredNamespaces: {
      eip155: {
        chains: ['eip155:1'],
        events: ['chainChanged', 'accountsChanged'],
        methods: ["eth_sendTransaction", "eth_signTransaction"]
      },
      "eip155:10": {
        "events": ["accountsChanged", "chainChanged"]
        "methods": ["get_balance"],
      },
      "cosmos": {
          ...
      }
    }
   */
  // TODO EVM only
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { chainId, accounts, networkImpl } = sessionStatus;
  if (!networkImpl) {
    throw new Error('convertToSessionNamespacesV2 ERROR: networkImpl is empty');
  }
  const namespaces: SessionTypes.Namespaces = {};
  let hasNonEvmChain = false;
  let hasEvmChain = false;
  const processDappRequestNamespaces = (
    dappNamespaces: ProposalTypes.RequiredNamespaces,
    isRequired = true,
  ) => {
    Object.keys(dappNamespaces).forEach((key) => {
      if (key !== 'eip155' && !key.startsWith('eip155:')) {
        hasNonEvmChain = true;
        if (isRequired) {
          namespaces[key] = {
            accounts: [], // TODO empty accounts is NOT allowed
            chains: key.includes(':') ? [key] : dappNamespaces[key].chains,
            methods: dappNamespaces[key].methods,
            events: dappNamespaces[key].events,
          };
          const error = new Error(
            'OneKey WalletConnect ERROR: EVM chain supported only',
          );
          onError?.(error);
          throw error;
        }
      } else {
        const accountsInNs: string[] = [];
        dappNamespaces[key].chains?.forEach((chain) => {
          // TODO check chainId and accounts matched
          // TODO check chain supports?
          accounts.forEach((acc) => accountsInNs.push(`${chain}:${acc}`));
        });
        const namespaceItem: SessionTypes.Namespace = {
          // TODO add sessionStatus.chainId to accounts and chains
          accounts: accountsInNs,
          chains: key.includes(':') ? [key] : dappNamespaces[key].chains,
          methods: dappNamespaces[key].methods,
          events: dappNamespaces[key].events,
        };
        namespaces[key] = mergeSessionNamespace({
          ns1: namespaces[key],
          ns2: namespaceItem,
        });
        hasEvmChain = true;
      }
    });
  };

  if (requiredNamespaces) {
    processDappRequestNamespaces(requiredNamespaces, true);
  }
  if (optionalNamespaces) {
    processDappRequestNamespaces(optionalNamespaces, false);
  }

  if (hasNonEvmChain && !hasEvmChain) {
    // throw new Error(
    //   'OneKey WalletConnectV2 Non-EVM chain not supported yet.',
    // );
  }

  /*
     {
       "sessionNamespaces": {
         "eip155:1": {...}
         "eip155": {
           "accounts": [
             "eip155:1:0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb",
             "eip155:1:0x25caCa7f7Bf3A77b1738A8c98A666dd9e4C69A0C",
             "eip155:1:0x2Fe1cC9b1DCe6E8e16C48bc6A7ABbAB3d10DA954",
             "eip155:1:0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8",
             "eip155:1:0xEB2F31B0224222D774541BfF89A221e7eb15a17E"
           ],
           "methods": ["eth_sign"],
           "events": ["accountsChanged"]
         }
       }
     }
     */
  return { namespaces };
}

export default {
  getWalletConnectUriInfo,
  buildConnectWalletAppUrl,
  buildOpenWalletAppUrl,
  dappOpenWalletApp,
  openConnectToDappModal,
  buildOneKeyWalletConnectDeepLinkUrl,
  isWalletConnectV2,
  convertToSessionNamespacesV2,
  getChainIdFromNamespaceChainV2,
  isEvmNamespaceV2,
};
