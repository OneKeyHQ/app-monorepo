export type IExplorerUrlType =
  | 'address'
  | 'transaction'
  | 'block'
  | 'name'
  | 'token';

export type IBuildExplorerUrlParams = {
  networkId: string;
  param: string;
  type: IExplorerUrlType;
};
