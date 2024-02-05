import axios from 'axios';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';
import { getChainIdFromNetworkId } from '../utils';

import type {
  Quoter,
  SerializableTransactionReceipt,
  TransactionDetails,
  TransactionProgress,
  TransactionStatus,
} from '../typings';
import type { Axios } from 'axios';

export interface SocketAsset {
  address: string;
  chainId: number;
  decimals: number;
  icon: string;
  logoURI: string;
  name: string;
  symbol: string;
}

export interface ISocketReward {
  amount: string;
  amountInUsd: number;
  asset: SocketAsset;
  chainId: number;
}

interface ISocketExtraData {
  rewards: ISocketReward[];
}

export interface IQouterExtraData {
  socketBridgeExtraData?: ISocketExtraData;
}

interface SocketUserTxs {
  chainId: number;
  txType: string;
  userTxType: string;
  fromAsset: SocketAsset;
  toAsset: SocketAsset;
  fromAmount: string;
  toAmount: string;
  protocol: {
    displayName: string;
    icon: string;
    name: string;
  };
}
export interface SocketRoute {
  routeId: string;
  sender: string;
  serviceTime: number;
  fromAmount: string;
  toAmount: string;
  recipient: string;
  usedBridgeNames: string[];
  usedDexName?: string;
  isOnlySwapRoute?: boolean;
  userTxs?: SocketUserTxs[];
  extraData?: ISocketExtraData;
}

export type SocketRouteStatus =
  | 'INSUFFICIENT_LIQUIDITY'
  | 'BRIDGE_QUOTE_TIMEOUT'
  | 'MIN_AMOUNT_NOT_MET'
  | 'MAX_AMOUNT_EXCEEDED';

export interface SocketRouteError {
  status: SocketRouteStatus;
  minAmount?: string;
  maxAmount?: string;
}
export interface SocketQuoteResponse {
  fromChainId: number;
  toChainId: number;
  fromAsset: SocketAsset;
  toAsset: SocketAsset;
  routes: SocketRoute[];
  bridgeRouteErrors?: Record<string, SocketRouteError>;
}

export interface SocketBuildTransactionResponse {
  chainId: number;
  txData: string;
  txTarget: string;
  txType: string;
  userTxIndex: number;
  userTxType: string;
  value: string;
  approvalData?: {
    allowanceTarget: string;
  };
}

type BridgeTxStatus = 'READY' | 'PENDING' | 'COMPLETED' | 'FAILED';
export interface SocketBridgeStatusParams {
  transactionHash: string;
  fromChainId: string;
  toChainId: string;
  bridgeName?: string;
}

export interface SocketBridgeStatusResponse {
  sourceTransactionHash: string;
  sourceTxStatus: BridgeTxStatus;
  destinationTransactionHash?: string;
  destinationTxStatus: BridgeTxStatus;
  fromChainId: string;
  toChainId: string;
  refuel?: {
    destinationTransactionHash?: string;
    status?: BridgeTxStatus;
  };
}

export class SocketQuoter implements Quoter {
  type: QuoterType = QuoterType.socket;

  private client: Axios;

  constructor() {
    this.client = axios.create({
      timeout: 30 * 1000,
    });
  }

  async getBaseURL(): Promise<string> {
    const baseURL = await backgroundApiProxy.serviceSwap.getServerEndPoint();
    return `${baseURL}/socketBridge`;
  }

  private async querySocketBridgeStatus(
    params: SocketBridgeStatusParams,
  ): Promise<
    | {
        status: TransactionStatus | undefined;
        destinationTransactionHash?: string | undefined;
      }
    | undefined
  > {
    let res: any;
    try {
      const baseURL = await this.getBaseURL();
      res = await this.client.get(`${baseURL}/bridge-status`, { params });
    } catch (e) {
      console.log(e);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const data = res.data.result as SocketBridgeStatusResponse;
    if (
      (data.sourceTxStatus === 'COMPLETED' &&
        data.destinationTxStatus === 'COMPLETED') ||
      data.refuel?.status === 'COMPLETED'
    ) {
      return {
        status: 'sucesss',
        destinationTransactionHash:
          data.destinationTransactionHash ||
          data.refuel?.destinationTransactionHash,
      };
    }
    if (
      data.destinationTxStatus === 'FAILED' ||
      data.sourceTxStatus === 'FAILED'
    ) {
      return { status: 'failed' };
    }
    return undefined;
  }

  async queryCrosschainTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const { nonce, networkId, accountId, tokens, attachment } = tx;
    if (nonce !== undefined && tokens) {
      const { from, to } = tokens;
      const fromChainId = getChainIdFromNetworkId(from.networkId);
      const toChainId = getChainIdFromNetworkId(to.networkId);
      const txs =
        await backgroundApiProxy.serviceHistory.getTransactionsWithNonce({
          nonce,
          networkId,
          accountId,
        });
      for (let i = 0; i < txs.length; i += 1) {
        const { txid } = txs[i].decodedTx;
        const statusRes = await this.querySocketBridgeStatus({
          fromChainId,
          toChainId,
          transactionHash: txid,
          bridgeName: attachment?.socketUsedBridgeNames?.[0],
        });
        if (statusRes?.status === 'sucesss') {
          return {
            status: statusRes.status,
            destinationTransactionHash: statusRes.destinationTransactionHash,
          };
        }
        if (statusRes?.status === 'failed') {
          return {
            status: statusRes.status,
          };
        }
        if (statusRes?.destinationTransactionHash) {
          return {
            destinationTransactionHash: statusRes.destinationTransactionHash,
          };
        }
      }
    }
    if (Date.now() - tx.addedTime > 60 * 60 * 1000 * 24) {
      return { status: 'failed' };
    }
    return undefined;
  }

  async querySimpleTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const { networkId, accountId, nonce } = tx;
    if (nonce !== undefined) {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
          networkId,
          accountId,
          nonce,
        });
      return { status };
    }
    const result = (await backgroundApiProxy.serviceNetwork.rpcCall(networkId, {
      method: 'eth_getTransactionReceipt',
      params: [tx.hash],
    })) as SerializableTransactionReceipt | undefined;
    if (result) {
      return { status: Number(result.status) === 1 ? 'sucesss' : 'failed' };
    }

    if (Date.now() - tx.addedTime > 60 * 60 * 1000 * 24) {
      return { status: 'failed' };
    }
    return undefined;
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const { tokens } = tx;
    if (tokens) {
      const simpleResult = await this.querySimpleTransactionProgress(tx);
      if (
        simpleResult?.status === 'failed' ||
        simpleResult?.status === 'canceled'
      ) {
        return simpleResult;
      }
      return this.queryCrosschainTransactionProgress(tx);
    }
    return undefined;
  }
}
