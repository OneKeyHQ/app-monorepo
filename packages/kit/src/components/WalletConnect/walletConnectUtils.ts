import { IClientMeta } from '@walletconnect/types';
import { Linking, Platform } from 'react-native';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { waitForDataLoaded } from '../../background/utils';
import { getAppNavigation } from '../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { getTimeDurationMs } from '../../utils/helper';
import { DappConnectionModalRoutes } from '../../views/DappModals/types';

import { WalletService } from './types';
import { ONEKEY_APP_DEEP_LINK } from './walletConnectConsts';

import type { WalletConnectClientForDapp } from './WalletConnectClientForDapp';

const connectionRedirectUrl =
  platformEnv.isNative || platformEnv.isDesktop
    ? ONEKEY_APP_DEEP_LINK
    : window.location.origin;

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

async function terminateWcConnection({
  client,
  walletUrl,
}: {
  client?: WalletConnectClientForDapp;
  walletUrl?: string;
}) {
  try {
    client?.offAllEvents();
    await simpleDb.walletConnect.removeWalletSession(walletUrl);
    if (client?.connector?.peerId) {
      client?.connector?.killSession();
    }
    client?.disconnect(); // seems not working
  } catch (error) {
    debugLogger.common.error('terminateWcConnection ERROR: ', error);
  }
}

async function openConnectToDappModal({ uri }: { uri: string }) {
  await waitForDataLoaded({
    data: () => getAppNavigation(),
    logName: 'openConnectToDappModal wait navigation ready',
    timeout: getTimeDurationMs({ minute: 1 }),
  });
  const navigation = getAppNavigation();
  if (!navigation) {
    return;
  }
  navigation.navigate(RootRoutes.Modal, {
    screen: ModalRoutes.DappConnectionModal,
    params: {
      screen: DappConnectionModalRoutes.ConnectionModal,
      params: {
        walletConnectUri: uri,
      },
    },
  });
}

export default {
  buildConnectWalletAppUrl,
  buildOpenWalletAppUrl,
  dappOpenWalletApp,
  terminateWcConnection,
  openConnectToDappModal,
};
