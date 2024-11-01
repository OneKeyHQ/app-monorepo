interface IChainListExplorer {
  name: string;
  url: string;
  standard: string;
  icon?: string;
}

interface IChainListNativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface IChainListItem {
  name: string;
  chainId: number;
  shortName: string;
  chain: string;
  networkId: number;
  nativeCurrency: IChainListNativeCurrency;
  rpc: string[];
  faucets: string[];
  explorers: IChainListExplorer[];
  infoURL: string;
}
