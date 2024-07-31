import type { IServerNetwork } from '.';

export interface IDBCustomRpc {
  rpc: string;
  networkId: string;
  enabled: boolean;
  updatedAt?: number;
}

export interface IMeasureRpcStatusParams {
  rpcUrl: string;
}

export interface IMeasureRpcStatusResult {
  bestBlockNumber: number;
  responseTime: number;
}

export interface ICustomRpcItem extends IDBCustomRpc {
  network: IServerNetwork;
}

export interface IEvmClientInfo {
  bestBlockNumber: number;
  isReady: boolean;
}
