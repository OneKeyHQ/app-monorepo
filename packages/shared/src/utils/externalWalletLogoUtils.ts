import { cloneDeep } from 'lodash';

import type { IWalletConnectPeerMeta } from '../walletConnect/types';

type IExternalWalletLogoKeys =
  | 'injected'
  | 'metamask'
  | 'trustwallet'
  | 'rainbow'
  | 'imtoken'
  | 'okx'
  | 'tokenpocket'
  | 'zerion'
  | 'walletconnect'
  | 'fireblocks'
  | 'amber'
  | 'cobowallet'
  | 'jadewallet';

type IExternalWalletLogoInfo = {
  name: string;
  logo: string;
};
const map: Record<IExternalWalletLogoKeys, IExternalWalletLogoInfo> = {
  'injected': {
    name: 'Injected',
    // TODO EVM general injected wallet icon
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_injected.png'),
  },
  // https://explorer-api.walletconnect.com/v3/all?projectId=2f05ae7f1116030fde2d36508f472bfb&entries=40&page=1&search=metamask
  'metamask': {
    name: 'MetaMask',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_metamask.png'),
  },
  'trustwallet': {
    name: 'Trust Wallet',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_trustwallet.png'),
  },
  'rainbow': {
    name: 'Rainbow',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_rainbow.png'),
  },
  'imtoken': {
    name: 'imToken',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_imtoken.png'),
  },
  // https://explorer-api.walletconnect.com/v3/all?projectId=2f05ae7f1116030fde2d36508f472bfb&entries=40&page=1&search=okx
  'okx': {
    name: 'OKX Wallet',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_okx.png'),
  },
  'tokenpocket': {
    name: 'TokenPocket',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_tokenpocket.png'),
  },
  'zerion': {
    name: 'Zerion',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_zerion.png'),
  },
  'walletconnect': {
    name: 'Walletconnect',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_walletconnect.png'),
  },
  'fireblocks': {
    name: 'Fireblocks',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_fireblocks.png'),
  },
  'amber': {
    name: 'Amber',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_amber.png'),
  },
  'cobowallet': {
    name: 'Cobo Wallet',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_cobo_wallet.png'),
  },
  'jadewallet': {
    name: 'Jade Wallet',
    logo: require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_jade.png'),
  },
};

function getLogoInfo(key: IExternalWalletLogoKeys): IExternalWalletLogoInfo {
  return cloneDeep(map[key]);
}

function getLogoInfoFromWalletConnect({
  peerMeta,
}: {
  peerMeta: IWalletConnectPeerMeta;
}): IExternalWalletLogoInfo {
  const { url, name, icons, redirect } = peerMeta;
  let logo: string | undefined = icons?.[0];
  if (!logo) {
    if (
      url?.startsWith('https://metamask.io') ||
      redirect?.native?.startsWith('metamask://') ||
      redirect?.universal?.startsWith('https://metamask.app.link')
    ) {
      const info = getLogoInfo('metamask');
      return {
        ...info,
        name: name || info.name,
      };
    }
  }
  if (!logo) {
    logo = getLogoInfo('walletconnect')?.logo;
  }
  return {
    logo,
    name,
  };
}

export default {
  getLogoInfoFromWalletConnect,
  getLogoInfo,
};
