export interface IDBCustomRpc {
  rpc: string;
  networkId: string;
  updatedAt?: number;
}

export interface IMeasureRpcStatusParams {
  rpcUrl: string;
}

export interface IMeasureRpcStatusResult {
  bestBlockNumber: number;
  responseTime: number;
}
