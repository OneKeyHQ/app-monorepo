export type INamespaceUnion =
  | 'eip155'
  | 'cosmos'
  | 'solana'
  | 'polkadot'
  | 'tron';
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
