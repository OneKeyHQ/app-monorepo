import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import type { Provider } from './typings';

export const swftcCustomerSupportUrl =
  'https://www.bangwo8.com/osp2016/im/pc/index.php?vendorID=782460&uid=&customSource=onekey';

export const zeroXenabledNetworkIds: string[] = [
  OnekeyNetwork.eth,
  OnekeyNetwork.bsc,
  OnekeyNetwork.polygon,
  OnekeyNetwork.fantom,
  OnekeyNetwork.avalanche,
  OnekeyNetwork.celo,
  OnekeyNetwork.optimism,
  OnekeyNetwork.arbitrum,
];

const serverURL = 'https://0x.onekey.so';
export const quoterServerEndpoints: Record<string, string> = {
  [OnekeyNetwork.heco]: `${serverURL}/swap/v1/quote`,
  [OnekeyNetwork.goerli]: 'https://goerli.api.0x.org/swap/v1/quote',
};

export const estimatedTime: Record<string, number> = {
  [OnekeyNetwork.eth]: 60,
  [OnekeyNetwork.bsc]: 30,
  [OnekeyNetwork.polygon]: 30,
  [OnekeyNetwork.fantom]: 30,
  [OnekeyNetwork.avalanche]: 30,
  [OnekeyNetwork.celo]: 60,
  [OnekeyNetwork.optimism]: 60,
  [OnekeyNetwork.heco]: 15,
  [OnekeyNetwork.okt]: 15,
};

export const networkProviderInfos: Record<string, Provider[]> = {
  [OnekeyNetwork.okt]: [
    {
      name: 'CherrySwap',
      logoUrl: 'https://common.onekey-asset.com/logo/CherrySwap.png',
    },
  ],
  [OnekeyNetwork.heco]: [
    {
      name: 'MDex',
      logoUrl: 'https://common.onekey-asset.com/logo/MdexSwap.png',
    },
  ],
  [OnekeyNetwork.xdai]: [
    {
      name: 'HoneySwap',
      logoUrl: 'https://common.onekey-asset.com/logo/HoneySwap.png',
    },
  ],
};

export const tokenReservedValues: Record<string, number> = {
  [OnekeyNetwork.eth]: 0.01,
  [OnekeyNetwork.bsc]: 0.01,
  [OnekeyNetwork.polygon]: 0.03,
  [OnekeyNetwork.btc]: 0.001,
  [OnekeyNetwork.optimism]: 0.0001,
  [OnekeyNetwork.xrp]: 11,
  [OnekeyNetwork.trx]: 5,
};
