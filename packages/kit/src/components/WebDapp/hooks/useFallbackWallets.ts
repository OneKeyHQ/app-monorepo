import { useMemo } from 'react';

import { WALLET_STORE_URLS } from '@onekeyhq/shared/src/consts/walletConsts';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';

interface IFallbackWalletMeta {
  key: string;
  detectKeywords: string[];
  storeUrl: string;
  logo: any;
  name: string;
  networkType: string;
}

function useFallbackWallets(): IFallbackWalletMeta[] {
  return useMemo(() => {
    const phantomWalletInfo = externalWalletLogoUtils.getLogoInfo('phantom');
    const coinbaseWalletInfo = externalWalletLogoUtils.getLogoInfo('coinbase');
    const okxWalletInfo = externalWalletLogoUtils.getLogoInfo('okx');

    const fallbackWallets: IFallbackWalletMeta[] = [
      {
        key: 'phantom',
        detectKeywords: ['phantom'],
        storeUrl: WALLET_STORE_URLS.phantom,
        logo: phantomWalletInfo.logo,
        name: phantomWalletInfo.name,
        networkType: 'EVM',
      },
      {
        key: 'coinbase',
        detectKeywords: ['coinbase'],
        storeUrl: WALLET_STORE_URLS.coinbase,
        logo: coinbaseWalletInfo.logo,
        name: coinbaseWalletInfo.name,
        networkType: 'EVM',
      },
      {
        key: 'okx',
        detectKeywords: ['okx'],
        storeUrl: WALLET_STORE_URLS.okx,
        logo: okxWalletInfo.logo,
        name: okxWalletInfo.name,
        networkType: 'EVM',
      },
    ];

    return fallbackWallets;
  }, []);
}

export { useFallbackWallets };
