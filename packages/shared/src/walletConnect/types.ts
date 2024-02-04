export type INamespaceUnion = 'eip155';
export interface IChainInfo {
  chainId: string;
  namespace: INamespaceUnion;
  name: string;
}
