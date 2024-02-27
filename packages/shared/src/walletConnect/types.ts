export type INamespaceUnion =
  | 'eip155'
  | 'cosmos'
  | 'solana'
  | 'polkadot'
  | 'tron';

export type INetworkImplNamespaceMapping = {
  evm: 'eip155';
  sol: 'solana';
  cosmos: 'cosmos';
  dot: 'polkadot';
  tron: 'tron';
};

export type INamespaceNetworkImplMapping = {
  eip155: 'evm';
  solana: 'sol';
  cosmos: 'cosmos';
  polkadot: 'dot';
  tron: 'tron';
};

export interface IChainInfo {
  chainId: string;
  networkId: string;
  namespace: INamespaceUnion;
  name: string;
}

export interface ICaipsInfo {
  caipsChainId: string;
  networkId: string;
  impl: string;
  namespace: INamespaceUnion;
}
