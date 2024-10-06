import type { IServerNetwork } from '.';

export interface IDBCustomRpc {
  rpc: string;
  networkId: string;
  enabled: boolean;
  updatedAt?: number;
  isCustomNetwork?: boolean;
}

export interface IMeasureRpcStatusParams {
  rpcUrl: string;
  validateChainId?: boolean;
}

export interface IMeasureRpcStatusResult {
  chainId?: number;
  bestBlockNumber: number;
  responseTime: number;
}

export interface ICustomRpcItem extends IDBCustomRpc {
  network: IServerNetwork;
}

export interface IRpcClientInfo {
  bestBlockNumber: number;
  isReady: boolean;
  coin?: string; // For blockbook
}
