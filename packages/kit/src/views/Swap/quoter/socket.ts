import axios, { Axios } from 'axios';
import BigNumber from 'bignumber.js';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  QuoteData,
  Quoter,
  QuoterType,
  TransactionData,
  TransactionDetails,
  TransactionProgress,
  TransactionStatus,
} from '../typings';
import {
  getChainIdFromNetwork,
  getChainIdFromNetworkId,
  getEvmTokenAddress,
  getTokenAmountString,
} from '../utils';

interface SocketAsset {
  address: string;
  chainId: number;
  decimals: number;
  icon: string;
  logoURI: string;
  name: string;
  symbol: string;
}
export interface SocketRoute {
  routeId: string;
  sender: string;
  serviceTime: number;
  fromAmount: string;
  toAmount: string;
  recipient: string;
  usedBridgeNames: string[];
}
export interface SocketQuoteResponse {
  fromChainId: number;
  toChainId: number;
  fromAsset: SocketAsset;
  toAsset: SocketAsset;
  routes: SocketRoute[];
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

const baseURL = 'https://api.socket.tech/v2';
const API_KEY = '055646f8-d9f6-41b6-9bae-8633e690f1e6';

function calculateRate(
  inDecimals: number,
  outDecimals: number,
  inNum: number | string,
  outNum: number | string,
): string {
  const result = new BigNumber(10 ** inDecimals)
    .multipliedBy(outNum)
    .div(10 ** outDecimals)
    .div(inNum);
  return result.toFixed();
}

interface SupportedChain {
  name: string;
  chainId: number;
  sendingEnabled: boolean;
  receivingEnabled: boolean;
}

interface SupportedBridge {
  bridgeName: string;
  icon: string;
  serviceTime: number;
  displayName: string;
}

export class SocketQuoter implements Quoter {
  type: QuoterType = QuoterType.socket;

  private client: Axios;

  private supportedSendingChainIds?: string[];

  private supportedReceivingChainIds?: string[];

  private supportedBridges?: SupportedBridge[];

  constructor() {
    this.client = axios.create({
      timeout: 30 * 1000,
      headers: {
        'API-KEY': API_KEY,
      },
    });
  }

  prepare() {
    this.refreshSupportedChains();
  }

  async refreshSupportedChains() {
    const chains = await this.fetchSupportedChains();
    const supportedSendingChainIds = chains
      .filter((i) => i.sendingEnabled)
      .map((i) => String(i.chainId));
    const supportedReceivingChainIds = chains
      .filter((i) => i.receivingEnabled)
      .map((i) => String(i.chainId));
    if (supportedSendingChainIds.length > 0) {
      this.supportedSendingChainIds = supportedSendingChainIds;
    }
    if (supportedReceivingChainIds.length > 0) {
      this.supportedReceivingChainIds = supportedReceivingChainIds;
    }
  }

  async fetchSupportedChains(): Promise<SupportedChain[]> {
    const res = await this.client.get(`${baseURL}/supported/chains`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return res?.data?.result as SupportedChain[];
  }

  async getBridgeIconUrl(bridgeName: string) {
    if (!this.supportedBridges) {
      this.supportedBridges = await this.fetchSupportedBridges();
    }
    const bridge = this.supportedBridges.filter(
      (i) => i.bridgeName === bridgeName,
    )[0];
    return bridge.icon;
  }

  async fetchSupportedBridges(): Promise<SupportedBridge[]> {
    const res = await this.client.get(`${baseURL}/supported/bridges`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return res?.data?.result as SupportedBridge[];
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    const precondition =
      networkA.impl === 'evm' &&
      networkB.impl === 'evm' &&
      networkA.id !== networkB.id;

    if (!precondition) {
      return false;
    }
    if (!this.supportedReceivingChainIds || !this.supportedSendingChainIds) {
      return precondition;
    }
    const chainIdA = getChainIdFromNetwork(networkA);
    const chainIdB = getChainIdFromNetwork(networkB);
    return (
      precondition &&
      this.supportedSendingChainIds.includes(chainIdA) &&
      this.supportedReceivingChainIds.includes(chainIdB)
    );
  }

  async fetchTransactionData(route: SocketRoute) {
    const res = await this.client.post(`${baseURL}/build-tx`, { route });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const data = res.data.result as SocketBuildTransactionResponse | undefined;
    return data;
  }

  async fetchQuote(params: FetchQuoteParams): Promise<QuoteData | undefined> {
    const url = `${baseURL}/quote`;
    if (params.independentField === 'OUTPUT') {
      return undefined;
    }

    let res: any;
    try {
      res = await this.client.get(url, {
        params: {
          fromChainId: getChainIdFromNetworkId(params.networkIn.id),
          fromTokenAddress: getEvmTokenAddress(params.tokenIn),
          toChainId: getChainIdFromNetworkId(params.networkOut.id),
          toTokenAddress: getEvmTokenAddress(params.tokenOut),
          fromAmount: getTokenAmountString(params.tokenIn, params.typedValue),
          userAddress: params.activeAccount.address,
          recipient: params.receivingAddress,
          sort: 'output',
          singleTxOnly: true,
        },
      });
    } catch {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const data = res?.data?.result as SocketQuoteResponse | undefined;
    if (data && data.routes.length > 0) {
      const route = data.routes[0];
      const sellAmount = route.fromAmount;
      const sellTokenAddress = getEvmTokenAddress(params.tokenIn);
      const buyAmount = route.toAmount;
      const buyTokenAddress = getEvmTokenAddress(params.tokenOut);
      const instantRate = calculateRate(
        params.tokenIn.decimals,
        params.tokenOut.decimals,
        sellAmount,
        buyAmount,
      );
      let allowanceTarget: string | undefined;
      const transactionData = await this.fetchTransactionData(route);
      if (
        transactionData &&
        transactionData.approvalData &&
        transactionData.approvalData.allowanceTarget
      ) {
        allowanceTarget = transactionData.approvalData.allowanceTarget;
      }
      let txData: TransactionData | undefined;
      if (transactionData) {
        txData = {
          from: params.activeAccount.address,
          value: transactionData.value,
          to: transactionData.txTarget,
          data: transactionData.txData,
        };
      }

      const bridgeIcons = await Promise.all(
        route.usedBridgeNames.map((name) => this.getBridgeIconUrl(name)),
      );
      const providers = route.usedBridgeNames.map((name, index) => ({
        name,
        logoUrl: bridgeIcons[index],
      }));
      return {
        type: this.type,
        sellAmount,
        sellTokenAddress,
        buyAmount,
        buyTokenAddress,
        instantRate,
        allowanceTarget,
        txData,
        arrivalTime: route.serviceTime,
        providers,
        txAttachment: { socketUsedBridgeNames: route.usedBridgeNames },
      };
    }
    return undefined;
  }

  async buildTransaction(
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    const { txData, txAttachment } = params;
    if (txData) {
      return { data: txData, attachment: txAttachment };
    }
    const data = await this.fetchQuote(params);
    if (data?.txData) {
      return { data: data.txData, attachment: data.txAttachment };
    }
    return undefined;
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

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const { nonce, networkId, accountId, tokens, attachment } = tx;
    if (nonce && tokens) {
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
    if (Date.now() - tx.addedTime > 60 * 60 * 1000) {
      return { status: 'failed' };
    }
    return undefined;
  }
}
