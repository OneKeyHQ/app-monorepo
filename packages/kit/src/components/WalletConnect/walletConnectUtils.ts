import {
  QrcodeModal,
  WalletConnectContext,
  WalletService,
  formatWalletServiceUrl,
  useMobileRegistry,
} from '@walletconnect/react-native-dapp';
import { IClientMeta } from '@walletconnect/types';
import { Linking, Platform } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ONEKEY_UNIVERSAL_LINK } from './walletConnectConsts';

const connectionRedirectUrl =
  platformEnv.isNative || platformEnv.isDesktop
    ? ONEKEY_UNIVERSAL_LINK
    : window.location.origin;

function buildRedirectUrl() {
  const maybeRedirectUrl = connectionRedirectUrl
    ? `redirectUrl=${encodeURIComponent(connectionRedirectUrl)}`
    : '';
  return maybeRedirectUrl;
}

function buildConnectionUrl({
  uri,
  walletService,
}: {
  uri: string;
  walletService: WalletService;
}) {
  const maybeRedirectUrl = buildRedirectUrl();
  const connectionUrl = `${formatWalletServiceUrl(
    walletService,
  )}/wc?uri=${encodeURIComponent(uri)}&${maybeRedirectUrl}`;
  // https://rnbwapp.com/wc?uri=wc:&redirectUrl=yourappscheme://
  return connectionUrl;
}

function buildOpenAppUrl({ walletService }: { walletService: WalletService }) {
  const maybeRedirectUrl = buildRedirectUrl();
  return `${formatWalletServiceUrl(walletService)}/wc?${maybeRedirectUrl}`;
}

async function dappOpenWalletApp({
  peerMeta,
  walletServices,
  walletService,
}: {
  peerMeta: IClientMeta;
  walletServices: WalletService[];
  walletService: WalletService;
}) {
  // web dapp do not need to open wallet app
  if (Platform.OS === 'web') {
    return;
  }
  // android dapp
  if (Platform.OS === 'android') {
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
          const url = buildOpenAppUrl({ walletService: detectedWalletService });
          if (await Linking.canOpenURL(url)) {
            return Linking.openURL(url);
          }
        }
      }
    }
    Linking.openURL('wc:');
  } else {
    // ios dapp
    if (!walletService) {
      throw new Error('Cached WalletService not found.');
    }
    const url = buildOpenAppUrl({ walletService });
    return (await Linking.canOpenURL(url)) && Linking.openURL(url);
  }
}

export default {
  buildConnectionUrl,
  buildOpenAppUrl,
  dappOpenWalletApp,
};
