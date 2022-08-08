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

const baseURL = 'https://fiat.onekeycn.com/0x/quote';

export const networkRecords: Record<string, string> = {
  [Chains.MAINNET]: `${baseURL}?chainID=ethereum`,
  [Chains.ROPSTEN]: `${baseURL}?chainID=ropsten`,
  [Chains.BSC]: `${baseURL}?chainID=bsc`,
  [Chains.POLYGON]: `${baseURL}?chainID=polygon`,
  [Chains.FANTOM]: `${baseURL}?chainID=fantom`,
  [Chains.AVALANCHE]: `${baseURL}?chainID=avalanche`,
  [Chains.CELO]: `${baseURL}?chainID=celo`,
  [Chains.OPTIMISM]: `${baseURL}?chainID=optimism`,
  [Chains.KOVAN]: 'https://kovan.api.0x.org/swap/v1/quote',
  [Chains.HECO]: 'https://0x.onekey.so/swap/v1/quote',
};
