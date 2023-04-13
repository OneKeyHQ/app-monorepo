import axios from 'axios';
import BigNumber from 'bignumber.js';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';
import {
  calculateRange,
  calculateRate,
  div,
  getChainIdFromNetwork,
  getChainIdFromNetworkId,
  getEvmTokenAddress,
  getTokenAmountString,
} from '../utils';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  FetchQuoteResponse,
  Provider,
  Quoter,
  SerializableTransactionReceipt,
  TransactionData,
  TransactionDetails,
  TransactionProgress,
  TransactionStatus,
} from '../typings';
import type { Axios } from 'axios';

interface SocketAsset {
  address: string;
  chainId: number;
  decimals: number;
  icon: string;
  logoURI: string;
  name: string;
  symbol: string;
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

interface SocketTokenPrice {
  chainId: number;
  tokenAddress: string;
  tokenPrice: number;
  decimals: number;
  currency: string;
}

interface SupportedChain {
  name: string;
  chainId: number;
  sendingEnabled: boolean;
  receivingEnabled: boolean;
}

interface SupportedBridge {
  bridgeName: string;
  name: string;
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
    });
  }

  prepare() {
    this.refreshSupportedChains();
  }

  async getBaseURL(): Promise<string> {
    const baseURL = await backgroundApiProxy.serviceSwap.getServerEndPoint();
    return `${baseURL}/socketBridge`;
  }

  async fetchTokenPrice(token: Token): Promise<SocketTokenPrice | undefined> {
    const baseURL = await this.getBaseURL();
    const url = `${baseURL}/token-price`;
    const data = await this.client.get(url, {
      params: {
        tokenAddress: getEvmTokenAddress(token),
        chainId: getChainIdFromNetworkId(token.networkId),
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return data?.data?.result as SocketTokenPrice | undefined;
  }

  async fetchInstantTokenRate(
    tokenIn: Token,
    tokenOut: Token,
  ): Promise<number | undefined> {
    const tokenInPrice = await this.fetchTokenPrice(tokenIn);
    const tokenOutPrice = await this.fetchTokenPrice(tokenOut);
    if (tokenInPrice && tokenOutPrice) {
      return new BigNumber(tokenOutPrice.tokenPrice)
        .div(tokenInPrice.tokenPrice)
        .toNumber();
    }
    return undefined;
  }

  async fetchInstantTokenRateFromChain(
    tokenIn: Token,
    tokenOut: Token,
    userAddress: string,
  ): Promise<number | undefined> {
    const baseURL = await this.getBaseURL();
    const url = `${baseURL}/quote`;
    const params = {
      fromChainId: getChainIdFromNetworkId(tokenIn.networkId),
      fromTokenAddress: getEvmTokenAddress(tokenIn),
      toChainId: getChainIdFromNetworkId(tokenOut.networkId),
      toTokenAddress: getEvmTokenAddress(tokenOut),
      fromAmount: getTokenAmountString(tokenIn, '1'),
      userAddress,
      sort: 'output',
      singleTxOnly: true,
    };
    let res = await this.client.get(url, { params });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    let data = res?.data?.result as SocketQuoteResponse | undefined;
    if (!data) {
      return;
    }
    if (data.routes.length > 0) {
      const route = data.routes[0];
      const instantRate = calculateRate(
        tokenIn.decimals,
        tokenOut.decimals,
        route.fromAmount,
        route.toAmount,
      );
      return Number(instantRate);
    }
    if (!data.bridgeRouteErrors) {
      return;
    }
    const bridgeRouteError = Object.values(data.bridgeRouteErrors).find(
      (item) => item.maxAmount || item.minAmount,
    );
    if (!bridgeRouteError) {
      return;
    }
    const fromAmount =
      bridgeRouteError?.maxAmount || bridgeRouteError?.minAmount;
    if (!fromAmount) {
      return;
    }
    params.fromAmount = fromAmount;

    res = await this.client.get(url, { params });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    data = res?.data?.result as SocketQuoteResponse | undefined;
    if (!data) {
      return;
    }
    if (data.routes.length > 0) {
      const route = data.routes[0];
      const instantRate = calculateRate(
        tokenIn.decimals,
        tokenOut.decimals,
        route.fromAmount,
        route.toAmount,
      );
      return Number(instantRate);
    }
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
    const baseURL = await this.getBaseURL();
    const res = await this.client.get(`${baseURL}/supported/chains`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return res?.data?.result as SupportedChain[];
  }

  async getBridgeInfo(bridgeName: string) {
    if (!this.supportedBridges) {
      this.supportedBridges = await this.fetchSupportedBridges();
    }

    const bridge = this.supportedBridges.filter(
      (i) => i.name === bridgeName || i.bridgeName === bridgeName,
    )[0];

    return { icon: bridge?.icon, displayName: bridge?.displayName };
  }

  async fetchSupportedBridges(): Promise<SupportedBridge[]> {
    const baseURL = await this.getBaseURL();
    const res = await this.client.get(`${baseURL}/supported/bridges`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return res?.data?.result as SupportedBridge[];
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    const precondition = networkA.impl === 'evm' && networkB.impl === 'evm';

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
    const baseURL = await this.getBaseURL();
    const res = await this.client.post(`${baseURL}/build-tx`, { route });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const data = res.data.result as SocketBuildTransactionResponse | undefined;
    return data;
  }

  async fetchSimpleQuoteFromInput(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    const baseURL = await this.getBaseURL();
    const url = `${baseURL}/quote`;
    if (
      params.networkIn.id !== params.networkOut.id ||
      params.independentField === 'OUTPUT'
    ) {
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
      const route = data.routes.find((item) => !!item.isOnlySwapRoute);
      if (route) {
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
        let providers: Provider[] = [];

        if (route.userTxs) {
          const protocols = route.userTxs
            .filter((tx) => tx.protocol)
            .map((tx) => tx.protocol);
          providers = protocols.map((p) => ({
            name: p.displayName,
            logoUrl: p.icon,
          }));
        }

        const result = {
          type: this.type,
          sellAmount,
          sellTokenAddress,
          buyAmount,
          buyTokenAddress,
          instantRate,
          allowanceTarget,
          txData,
          arrivalTime: 30,
          providers,
        };

        return { data: result };
      }
    }
  }

  async fetchSimpleQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    const { independentField } = params;
    if (independentField === 'INPUT') {
      return this.fetchSimpleQuoteFromInput(params);
    }
    const { tokenIn, tokenOut, typedValue } = params;
    const instantRate = await this.fetchInstantTokenRateFromChain(
      tokenIn,
      tokenOut,
      params.activeAccount.address,
    );
    if (!instantRate) {
      return;
    }

    const newTypedValue = div(typedValue, instantRate);
    const newParams = { ...params };
    newParams.independentField = 'INPUT';
    newParams.typedValue = newTypedValue;

    const result = await this.fetchSimpleQuoteFromInput(newParams);
    if (!result?.data) {
      return result;
    }

    const buyAmountBN = new BigNumber(result.data.buyAmount);
    const expectedbuyAmount = new BigNumber(
      getTokenAmountString(tokenOut, typedValue),
    );
    const isExpected = buyAmountBN.isGreaterThan(
      expectedbuyAmount.multipliedBy(0.95),
    );
    if (isExpected) {
      const { data } = result;
      data.buyAmount = getTokenAmountString(tokenOut, typedValue);
      return { data };
    }
  }

  async fetchMultichainQuoteFromInput(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    const baseURL = await this.getBaseURL();
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
        route.usedBridgeNames.map((name) => this.getBridgeInfo(name)),
      );

      const providers = route.usedBridgeNames.map((name, index) => ({
        name: bridgeIcons[index]?.displayName,
        logoUrl: bridgeIcons[index]?.icon,
      }));
      const result = {
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
        additionalParams: { socketUsedBridgeNames: route.usedBridgeNames },
      };
      return { data: result };
    }
    const bridgeRouteErrors = data?.bridgeRouteErrors;
    if (bridgeRouteErrors) {
      const errors = Object.values(bridgeRouteErrors);
      const items = errors
        .filter((e) => e.maxAmount || e.minAmount)
        .map((err) => ({ max: err.maxAmount, min: err.minAmount }));
      if (items.length > 0) {
        return { limited: calculateRange(items) };
      }
    }
  }

  async fetchMultichainQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    if (params.independentField === 'INPUT') {
      return this.fetchMultichainQuoteFromInput(params);
    }
    const { tokenIn, tokenOut, typedValue } = params;
    const instantRate = await this.fetchInstantTokenRateFromChain(
      tokenIn,
      tokenOut,
      params.activeAccount.address,
    );
    if (!instantRate) {
      return;
    }

    const newTypedValue = div(typedValue, instantRate);
    const newParams = { ...params };
    newParams.independentField = 'INPUT';
    newParams.typedValue = newTypedValue;

    const result = await this.fetchMultichainQuoteFromInput(newParams);
    if (!result?.data) {
      return result;
    }
    const buyAmountBN = new BigNumber(result.data.buyAmount);
    const expectedbuyAmount = new BigNumber(
      getTokenAmountString(tokenOut, typedValue),
    );
    const isExpected = buyAmountBN.isGreaterThan(
      expectedbuyAmount.multipliedBy(0.95),
    );
    if (isExpected) {
      const { data } = result;
      data.buyAmount = getTokenAmountString(tokenOut, typedValue);
      return { data };
    }
  }

  async fetchQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    if (!this.isSupported(params.networkIn, params.networkOut)) {
      return undefined;
    }
    if (params.networkIn.id === params.networkOut.id) {
      return this.fetchSimpleQuote(params);
    }
    return this.fetchMultichainQuote(params);
  }

  async buildTransaction(
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    const { txData, additionalParams } = params;
    if (txData) {
      return {
        data: txData,
        attachment: {
          socketUsedBridgeNames: additionalParams?.socketUsedBridgeNames,
        },
      };
    }
    const data = await this.fetchQuote(params);
    if (data?.data) {
      if (data?.data?.txData) {
        return {
          data: data?.data.txData,
          attachment: {
            socketUsedBridgeNames:
              data.data.additionalParams?.socketUsedBridgeNames,
          },
        };
      }
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
      const { from, to } = tokens;
      if (from.networkId === to.networkId) {
        return this.querySimpleTransactionProgress(tx);
      }
      return this.queryCrosschainTransactionProgress(tx);
    }
    return undefined;
  }
}
