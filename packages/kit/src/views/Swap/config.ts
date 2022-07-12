export const swftcCustomerSupportUrl =
  'https://www.bangwo8.com/osp2016/im/pc/index.php?vendorID=782460&uid=&customSource=onekey';

export enum Chains {
  MAINNET = '1',
  ROPSTEN = '3',
  OPTIMISM = '10',
  KOVAN = '42',
  BSC = '56',
  POLYGON = '137',
  FANTOM = '250',
  AVALANCHE = '43114',
  CELO = '42220',
  HECO = '128',
}

export const enabledChainIds: string[] = [
  Chains.MAINNET,
  Chains.BSC,
  Chains.OPTIMISM,
  Chains.KOVAN,
  Chains.ROPSTEN,
  Chains.POLYGON,
  Chains.FANTOM,
  Chains.AVALANCHE,
  Chains.CELO,
  Chains.HECO,
];

export const networkRecords: Record<string, string> = {
  [Chains.MAINNET]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ethereum',
  [Chains.ROPSTEN]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ropsten',
  [Chains.KOVAN]: 'https://kovan.api.0x.org/swap/v1/quote',
  [Chains.BSC]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=bsc',

  [Chains.POLYGON]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=polygon',
  [Chains.FANTOM]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=fantom',
  [Chains.AVALANCHE]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=avalanche',
  [Chains.CELO]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=celo',
  [Chains.OPTIMISM]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=optimism',
  [Chains.HECO]: 'https://0x.onekey.so/swap/v1/quote',
};
