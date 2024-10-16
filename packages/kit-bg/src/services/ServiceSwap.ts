import axios from 'axios';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { has } from 'lodash';

import {
  getBtcForkNetwork,
  validateBtcAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import EventSource from '@onekeyhq/shared/src/eventSource';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  maxRecentTokenPairs,
  swapHistoryStateFetchInterval,
  swapHistoryStateFetchRiceIntervalCount,
  swapQuoteEventTimeout,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchBuildTxParams,
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchResponse,
  IFetchSwapTxHistoryStatusResponse,
  IFetchTokenDetailParams,
  IFetchTokenListParams,
  IFetchTokensParams,
  ISwapApproveTransaction,
  ISwapNetwork,
  ISwapNetworkBase,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  ESwapFetchCancelCause,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { inAppNotificationAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

import type { IAllNetworkAccountInfo } from './ServiceAllNetwork/ServiceAllNetwork';

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  private _quoteAbortController?: AbortController;

  private _tokenListAbortController?: AbortController;

  private _quoteEventSource?: EventSource;

  private _quoteEventSourcePolyfill?: EventSourcePolyfill;

  private _tokenDetailAbortControllerMap: Record<
    ESwapDirectionType,
    AbortController | undefined
  > = { from: undefined, to: undefined };

  private historyStateIntervals: Record<string, ReturnType<typeof setTimeout>> =
    {};

  private historyStateIntervalCountMap: Record<string, number> = {};

  private _crossChainReceiveTxBlockNotificationMap: Record<string, boolean> =
    {};

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // --------------------- fetch
  @backgroundMethod()
  async cancelFetchQuotes() {
    if (this._quoteAbortController) {
      this._quoteAbortController.abort();
      this._quoteAbortController = undefined;
    }
  }

  @backgroundMethod()
  async cancelFetchTokenList() {
    if (this._tokenListAbortController) {
      this._tokenListAbortController.abort();
      this._tokenListAbortController = undefined;
    }
  }

  async removeQuoteEventSourceListeners() {
    if (this._quoteEventSource) {
      this._quoteEventSource.removeAllEventListeners();
    }
  }

  @backgroundMethod()
  async cancelFetchQuoteEvents() {
    if (this._quoteEventSource) {
      this._quoteEventSource.close();
      this._quoteEventSource = undefined;
    }
    if (this._quoteEventSourcePolyfill) {
      this._quoteEventSourcePolyfill.close();
      this._quoteEventSourcePolyfill = undefined;
    }
  }

  @backgroundMethod()
  async cancelFetchTokenDetail(direction?: ESwapDirectionType) {
    if (direction && this._tokenDetailAbortControllerMap) {
      if (has(this._tokenDetailAbortControllerMap, direction)) {
        this._tokenDetailAbortControllerMap[direction]?.abort();
        delete this._tokenDetailAbortControllerMap[direction];
      }
    }
  }

  @backgroundMethod()
  @toastIfError()
  async fetchSwapNetworks(): Promise<ISwapNetwork[]> {
    const protocol = EProtocolOfExchange.SWAP;
    const params = {
      protocol,
    };
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const { data } = await client.get<IFetchResponse<ISwapNetworkBase[]>>(
      '/swap/v1/networks',
      { params },
    );
    const allClientSupportNetworks =
      await this.backgroundApi.serviceNetwork.getAllNetworks();
    const swapNetworks = data?.data
      ?.map((network) => {
        const clientNetwork = allClientSupportNetworks.networks.find(
          (n) => n.id === network.networkId,
        );
        if (clientNetwork) {
          return {
            name: clientNetwork.name,
            symbol: clientNetwork.symbol,
            shortcode: clientNetwork.shortcode,
            logoURI: clientNetwork.logoURI,
            networkId: network.networkId,
            defaultSelectToken: network.defaultSelectToken,
            supportCrossChainSwap: network.supportCrossChainSwap,
            supportSingleSwap: network.supportSingleSwap,
          };
        }
        return null;
      })
      .filter(Boolean);
    return swapNetworks ?? [];
  }

  @backgroundMethod()
  async fetchSwapTokens({
    networkId,
    keywords,
    limit = 50,
    accountAddress,
    accountNetworkId,
    accountId,
    onlyAccountTokens,
    isAllNetworkFetchAccountTokens,
  }: IFetchTokensParams): Promise<ISwapToken[]> {
    if (!isAllNetworkFetchAccountTokens) {
      await this.cancelFetchTokenList();
    }
    const params: IFetchTokenListParams = {
      protocol: EProtocolOfExchange.SWAP,
      networkId: networkId ?? getNetworkIdsMap().onekeyall,
      keywords,
      limit,
      accountAddress: !networkUtils.isAllNetwork({
        networkId: networkId ?? getNetworkIdsMap().onekeyall,
      })
        ? accountAddress
        : undefined,
      accountNetworkId,
      skipReservationValue: true,
      onlyAccountTokens,
    };
    if (!isAllNetworkFetchAccountTokens) {
      this._tokenListAbortController = new AbortController();
    }
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    if (accountId && accountAddress && networkId) {
      const accountAddressForAccountId =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      if (accountAddressForAccountId === accountAddress) {
        params.accountXpub =
          await this.backgroundApi.serviceAccount.getAccountXpub({
            accountId,
            networkId,
          });
      }
      const inscriptionProtection =
        await this.backgroundApi.serviceSetting.getInscriptionProtection();
      const checkInscriptionProtectionEnabled =
        await this.backgroundApi.serviceSetting.checkInscriptionProtectionEnabled(
          {
            networkId,
            accountId,
          },
        );
      const withCheckInscription =
        checkInscriptionProtectionEnabled && inscriptionProtection;
      params.withCheckInscription = withCheckInscription;
    }
    try {
      const { data } = await client.get<IFetchResponse<ISwapToken[]>>(
        '/swap/v1/tokens',
        {
          params,
          signal: !isAllNetworkFetchAccountTokens
            ? this._tokenListAbortController?.signal
            : undefined,
          headers:
            await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              {
                accountId,
              },
            ),
        },
      );
      return data?.data ?? [];
    } catch (e) {
      if (axios.isCancel(e)) {
        throw new Error('swap fetch token cancel', {
          cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
        });
      } else {
        const error = e as { code: number; message: string; requestId: string };
        void this.backgroundApi.serviceApp.showToast({
          method: 'error',
          title: error?.message,
          message: error?.requestId,
        });
        return [];
      }
    }
  }

  @backgroundMethod()
  async getSupportSwapAllAccounts({
    indexedAccountId,
    otherWalletTypeAccountId,
    swapSupportNetworks,
  }: {
    indexedAccountId?: string;
    otherWalletTypeAccountId?: string;
    swapSupportNetworks: ISwapNetwork[];
  }) {
    const accountIdKey =
      indexedAccountId ?? otherWalletTypeAccountId ?? 'noAccountId';
    let swapSupportAccounts: IAllNetworkAccountInfo[] = [];
    if (indexedAccountId || otherWalletTypeAccountId) {
      try {
        const allNetAccountId = indexedAccountId
          ? (
              await this.backgroundApi.serviceAccount.getMockedAllNetworkAccount(
                {
                  indexedAccountId,
                },
              )
            ).id
          : otherWalletTypeAccountId ?? '';
        const { accountsInfo } =
          await this.backgroundApi.serviceAllNetwork.getAllNetworkAccounts({
            accountId: allNetAccountId,
            networkId: getNetworkIdsMap().onekeyall,
          });
        const noBtcAccounts = accountsInfo.filter(
          (networkDataString) =>
            !networkUtils.isBTCNetwork(networkDataString.networkId),
        );
        const btcAccounts = accountsInfo.filter((networkDataString) =>
          networkUtils.isBTCNetwork(networkDataString.networkId),
        );
        const btcAccountsWithMatchDeriveType = await Promise.all(
          btcAccounts.map(async (networkData) => {
            const globalDeriveType =
              await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: networkData.networkId,
                },
              );
            const btcNet = getBtcForkNetwork(
              networkUtils.getNetworkImpl({
                networkId: networkData.networkId,
              }),
            );
            const addressValidate = validateBtcAddress({
              network: btcNet,
              address: networkData.apiAddress,
            });
            if (addressValidate.isValid && addressValidate.encoding) {
              const deriveTypeRes =
                await this.backgroundApi.serviceNetwork.getDeriveTypeByAddressEncoding(
                  {
                    networkId: networkData.networkId,
                    encoding: addressValidate.encoding,
                  },
                );
              if (deriveTypeRes === globalDeriveType) {
                return networkData;
              }
            }
            return null;
          }),
        );
        const filteredAccounts = [
          ...noBtcAccounts,
          ...btcAccountsWithMatchDeriveType.filter(Boolean),
        ];
        swapSupportAccounts = filteredAccounts.filter((networkDataString) => {
          const { networkId: accountNetworkId } = networkDataString;
          return swapSupportNetworks.find(
            (network) => network.networkId === accountNetworkId,
          );
        });
      } catch (e) {
        console.error(e);
      }
    }
    return { accountIdKey, swapSupportAccounts };
  }

  @backgroundMethod()
  async fetchSwapTokenDetails({
    networkId,
    accountAddress,
    accountId,
    contractAddress,
    direction,
  }: {
    networkId: string;
    accountAddress?: string;
    accountId?: string;
    contractAddress: string;
    direction?: ESwapDirectionType;
  }): Promise<ISwapToken[] | undefined> {
    await this.cancelFetchTokenDetail(direction);
    const params: IFetchTokenDetailParams = {
      protocol: EProtocolOfExchange.SWAP,
      networkId,
      accountAddress,
      contractAddress,
    };
    if (direction) {
      if (direction === ESwapDirectionType.FROM) {
        this._tokenDetailAbortControllerMap.from = new AbortController();
      } else if (direction === ESwapDirectionType.TO) {
        this._tokenDetailAbortControllerMap.to = new AbortController();
      }
    }
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    if (accountId && accountAddress && networkId) {
      const accountAddressForAccountId =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      if (accountAddressForAccountId === accountAddress) {
        params.xpub = await this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        });
      }
      const inscriptionProtection =
        await this.backgroundApi.serviceSetting.getInscriptionProtection();
      const checkInscriptionProtectionEnabled =
        await this.backgroundApi.serviceSetting.checkInscriptionProtectionEnabled(
          {
            networkId,
            accountId,
          },
        );
      const withCheckInscription =
        checkInscriptionProtectionEnabled && inscriptionProtection;
      params.withCheckInscription = withCheckInscription;
    }
    const { data } = await client.get<IFetchResponse<ISwapToken[]>>(
      '/swap/v1/token/detail',
      {
        params,
        signal:
          direction === ESwapDirectionType.FROM
            ? this._tokenDetailAbortControllerMap.from?.signal
            : this._tokenDetailAbortControllerMap.to?.signal,
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    return data?.data;
  }

  @backgroundMethod()
  async fetchQuotes({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    slippagePercentage,
    autoSlippage,
    blockNumber,
    accountId,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
    userAddress?: string;
    slippagePercentage: number;
    autoSlippage?: boolean;
    blockNumber?: number;
    accountId?: string;
  }): Promise<IFetchQuoteResult[]> {
    await this.cancelFetchQuotes();
    const params: IFetchQuotesParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      protocol: EProtocolOfExchange.SWAP,
      userAddress,
      slippagePercentage,
      autoSlippage,
      blockNumber,
    };
    this._quoteAbortController = new AbortController();
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const fetchUrl = '/swap/v1/quote';
    try {
      const { data } = await client.get<IFetchResponse<IFetchQuoteResult[]>>(
        fetchUrl,
        {
          params,
          signal: this._quoteAbortController.signal,
          headers:
            await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              {
                accountId,
              },
            ),
        },
      );
      this._quoteAbortController = undefined;

      if (data?.code === 0 && data?.data?.length) {
        return data?.data;
      }
    } catch (e) {
      if (axios.isCancel(e)) {
        throw new Error('swap fetch quote cancel', {
          cause: ESwapFetchCancelCause.SWAP_QUOTE_CANCEL,
        });
      }
    }
    return [
      {
        info: { provider: '', providerName: '' },
        fromTokenInfo: fromToken,
        toTokenInfo: toToken,
      },
    ]; //  no support providers
  }

  @backgroundMethod()
  @toastIfError()
  async fetchQuotesEvents({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    slippagePercentage,
    autoSlippage,
    blockNumber,
    accountId,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
    userAddress?: string;
    slippagePercentage: number;
    autoSlippage?: boolean;
    blockNumber?: number;
    accountId?: string;
  }) {
    await this.removeQuoteEventSourceListeners();
    const params: IFetchQuotesParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      protocol: EProtocolOfExchange.SWAP,
      userAddress,
      slippagePercentage,
      autoSlippage,
      blockNumber,
    };
    const swapEventUrl = (
      await this.getClient(EServiceEndpointEnum.Swap)
    ).getUri({
      url: '/swap/v1/quote/events',
      params,
    });
    let headers = await getRequestHeaders();
    headers = {
      ...headers,
      ...(accountId
        ? await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          })
        : {}),
    };
    if (platformEnv.isExtension) {
      this._quoteEventSourcePolyfill = new EventSourcePolyfill(swapEventUrl, {
        headers: headers as Record<string, string>,
      });
      this._quoteEventSourcePolyfill.onmessage = (event) => {
        appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
          type: 'message',
          event: {
            type: 'message',
            data: event.data,
            lastEventId: null,
            url: swapEventUrl,
          },
          params,
          tokenPairs: { fromToken, toToken },
          accountId,
        });
      };
      this._quoteEventSourcePolyfill.onerror = async (event) => {
        const errorEvent = event as {
          error?: string;
          type: string;
          target: any;
        };
        if (!errorEvent?.error) {
          appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
            type: 'done',
            event: { type: 'done' },
            params,
            accountId,
            tokenPairs: { fromToken, toToken },
          });
        } else {
          appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
            type: 'error',
            event: {
              type: 'error',
              message: errorEvent.error,
              xhrState: this._quoteEventSourcePolyfill?.readyState ?? 0,
              xhrStatus: this._quoteEventSourcePolyfill?.readyState ?? 0,
            },
            params,
            accountId,
            tokenPairs: { fromToken, toToken },
          });
        }
        await this.cancelFetchQuoteEvents();
      };
      this._quoteEventSourcePolyfill.onopen = () => {
        appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
          type: 'open',
          event: { type: 'open' },
          params,
          accountId,
          tokenPairs: { fromToken, toToken },
        });
      };
    } else {
      this._quoteEventSource = new EventSource(swapEventUrl, {
        headers,
        pollingInterval: 0,
        timeoutBeforeConnection: 0,
        timeout: swapQuoteEventTimeout,
      });
      this._quoteEventSource.addEventListener('open', (event) => {
        appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
          type: 'open',
          event,
          params,
          accountId,
          tokenPairs: { fromToken, toToken },
        });
      });
      this._quoteEventSource.addEventListener('message', (event) => {
        appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
          type: 'message',
          event,
          params,
          accountId,
          tokenPairs: { fromToken, toToken },
        });
      });
      this._quoteEventSource.addEventListener('done', (event) => {
        appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
          type: 'done',
          event,
          params,
          accountId,
          tokenPairs: { fromToken, toToken },
        });
      });
      this._quoteEventSource.addEventListener('close', (event) => {
        appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
          type: 'close',
          event,
          params,
          accountId,
          tokenPairs: { fromToken, toToken },
        });
      });
      this._quoteEventSource.addEventListener('error', (event) => {
        appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
          type: 'error',
          event,
          params,
          accountId,
          tokenPairs: { fromToken, toToken },
        });
      });
    }
  }

  @backgroundMethod()
  @toastIfError()
  async fetchBuildTx({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    toTokenAmount,
    provider,
    receivingAddress,
    slippagePercentage,
    quoteResultCtx,
    accountId,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    toTokenAmount: string;
    fromTokenAmount: string;
    provider: string;
    userAddress: string;
    receivingAddress: string;
    slippagePercentage: number;
    accountId?: string;
    quoteResultCtx?: any;
  }): Promise<IFetchBuildTxResponse | undefined> {
    const params: IFetchBuildTxParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      toTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      protocol: EProtocolOfExchange.SWAP,
      provider,
      userAddress,
      receivingAddress,
      slippagePercentage,
      quoteResultCtx,
    };
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const { data } = await client.post<IFetchResponse<IFetchBuildTxResponse>>(
        '/swap/v1/build-tx',
        params,
        {
          headers:
            await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              {
                accountId,
              },
            ),
        },
      );
      return data?.data;
    } catch (e) {
      const error = e as { code: number; message: string; requestId: string };
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: error?.message,
        message: error?.requestId,
      });
    }
  }

  @backgroundMethod()
  // @toastIfError()
  async fetchTxState({
    txId,
    provider,
    networkId,
    protocol,
    toTokenAddress,
    receivedAddress,
    orderId,
    ctx,
  }: {
    txId: string;
    toTokenAddress?: string;
    receivedAddress?: string;
    networkId: string;
    protocol?: EProtocolOfExchange;
    provider?: string;
    orderId?: string;
    ctx?: any;
  }): Promise<IFetchSwapTxHistoryStatusResponse> {
    const params = {
      txId,
      protocol,
      provider,
      ctx,
      networkId,
      toTokenAddress,
      receivedAddress,
      orderId,
    };
    const client = await this.getClient(EServiceEndpointEnum.Swap);

    const { data } = await client.post<
      IFetchResponse<IFetchSwapTxHistoryStatusResponse>
    >('/swap/v1/state-tx', params);
    return data?.data ?? { state: ESwapTxHistoryStatus.PENDING };
  }

  @backgroundMethod()
  async fetchApproveAllowance({
    networkId,
    tokenAddress,
    spenderAddress,
    walletAddress,
    accountId,
  }: {
    networkId: string;
    tokenAddress: string;
    spenderAddress: string;
    walletAddress: string;
    accountId?: string;
  }) {
    const params = {
      networkId,
      tokenAddress,
      spenderAddress,
      walletAddress,
    };
    const client = await this.getClient(EServiceEndpointEnum.Swap);

    const { data } = await client.get<IFetchResponse<string>>(
      '/swap/v1/allowance',
      {
        params,
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    return data?.data;
  }

  // swap approving transaction
  @backgroundMethod()
  async getApprovingTransaction() {
    const { swapApprovingTransaction } = await inAppNotificationAtom.get();
    return swapApprovingTransaction;
  }

  @backgroundMethod()
  async setApprovingTransaction(item?: ISwapApproveTransaction) {
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapApprovingTransaction: item,
    }));
  }

  // --- swap history
  @backgroundMethod()
  async fetchSwapHistoryListFromSimple() {
    const histories =
      await this.backgroundApi.simpleDb.swapHistory.getSwapHistoryList();
    return histories.sort((a, b) => b.date.created - a.date.created);
  }

  @backgroundMethod()
  async syncSwapHistoryPendingList() {
    const histories = await this.fetchSwapHistoryListFromSimple();
    const pendingHistories = histories.filter(
      (history) =>
        history.status === ESwapTxHistoryStatus.PENDING ||
        history.status === ESwapTxHistoryStatus.CANCELING,
    );
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [...pendingHistories],
    }));
  }

  @backgroundMethod()
  async addSwapHistoryItem(item: ISwapTxHistory) {
    await this.backgroundApi.simpleDb.swapHistory.addSwapHistoryItem(item);
    await inAppNotificationAtom.set((pre) => {
      if (
        !pre.swapHistoryPendingList.find(
          (i) => i.txInfo.txId === item.txInfo.txId,
        )
      ) {
        return {
          ...pre,
          swapHistoryPendingList: [...pre.swapHistoryPendingList, item],
        };
      }
      return pre;
    });
  }

  @backgroundMethod()
  async updateSwapHistoryTx({
    oldTxId,
    newTxId,
    status,
  }: {
    oldTxId: string;
    newTxId: string;
    status: ESwapTxHistoryStatus;
  }) {
    const { swapHistoryPendingList } = await inAppNotificationAtom.get();
    const oldHistoryItemIndex = swapHistoryPendingList.findIndex(
      (item) => item.txInfo.txId === oldTxId,
    );
    if (oldHistoryItemIndex !== -1) {
      const newHistoryItem = swapHistoryPendingList[oldHistoryItemIndex];
      const updated = Date.now();
      newHistoryItem.date = { ...newHistoryItem.date, updated };
      newHistoryItem.txInfo.txId = newTxId;
      newHistoryItem.status = status;
      await this.backgroundApi.simpleDb.swapHistory.updateSwapHistoryItem(
        newHistoryItem,
        oldTxId,
      );
      await inAppNotificationAtom.set((pre) => {
        const newPendingList = [...pre.swapHistoryPendingList];
        newPendingList[oldHistoryItemIndex] = newHistoryItem;
        return {
          ...pre,
          swapHistoryPendingList: [...newPendingList],
        };
      });
      return;
    }
    const approvingTransaction = await this.getApprovingTransaction();
    if (
      approvingTransaction &&
      approvingTransaction.status === ESwapApproveTransactionStatus.PENDING &&
      approvingTransaction.txId === oldTxId
    ) {
      approvingTransaction.txId = newTxId;
      await this.setApprovingTransaction(approvingTransaction);
    }
  }

  @backgroundMethod()
  async updateSwapHistoryItem(item: ISwapTxHistory) {
    const { swapHistoryPendingList } = await inAppNotificationAtom.get();
    const index = swapHistoryPendingList.findIndex(
      (i) => i.txInfo.txId === item.txInfo.txId,
    );
    if (index !== -1) {
      const updated = Date.now();
      item.date = { ...item.date, updated };
      const oldItem = swapHistoryPendingList[index];
      if (
        oldItem.status === ESwapTxHistoryStatus.CANCELING &&
        item.status === ESwapTxHistoryStatus.SUCCESS
      ) {
        item.status = ESwapTxHistoryStatus.CANCELED;
      }
      if (
        item.txInfo.receiverTransactionId &&
        !this._crossChainReceiveTxBlockNotificationMap[
          item.txInfo.receiverTransactionId
        ]
      ) {
        void this.backgroundApi.serviceNotification.blockNotificationForTxId({
          networkId: item.baseInfo.toToken.networkId,
          tx: item.txInfo.receiverTransactionId,
        });
        this._crossChainReceiveTxBlockNotificationMap[
          item.txInfo.receiverTransactionId
        ] = true;
      }
      await this.backgroundApi.simpleDb.swapHistory.updateSwapHistoryItem(item);
      await inAppNotificationAtom.set((pre) => {
        const newPendingList = [...pre.swapHistoryPendingList];
        newPendingList[index] = item;
        return {
          ...pre,
          swapHistoryPendingList: [...newPendingList],
        };
      });
      if (item.status !== ESwapTxHistoryStatus.PENDING) {
        void this.backgroundApi.serviceApp.showToast({
          method:
            item.status === ESwapTxHistoryStatus.SUCCESS ? 'success' : 'error',
          title: appLocale.intl.formatMessage({
            id:
              item.status === ESwapTxHistoryStatus.SUCCESS
                ? ETranslations.swap_page_toast_swap_successful
                : ETranslations.swap_page_toast_swap_failed,
          }),
          message: `${
            numberFormat(item.baseInfo.fromAmount, {
              formatter: 'balance',
            }) as string
          } ${item.baseInfo.fromToken.symbol} → ${
            numberFormat(item.baseInfo.toAmount, {
              formatter: 'balance',
            }) as string
          } ${item.baseInfo.toToken.symbol}`,
        });
      }
    }
  }

  @backgroundMethod()
  async cleanSwapHistoryItems(statuses?: ESwapTxHistoryStatus[]) {
    await this.backgroundApi.simpleDb.swapHistory.deleteSwapHistoryItem(
      statuses,
    );
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: statuses
        ? pre.swapHistoryPendingList.filter(
            (item) => !statuses?.includes(item.status),
          )
        : [],
    }));
    void this.backgroundApi.serviceApp.showToast({
      method: 'success',
      title: appLocale.intl.formatMessage({
        id: ETranslations.settings_clear_successful,
      }),
    });
  }

  @backgroundMethod()
  async cleanOneSwapHistory(txId: string) {
    await this.backgroundApi.simpleDb.swapHistory.deleteOneSwapHistory(txId);
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: pre.swapHistoryPendingList.filter(
        (item) => item.txInfo.txId !== txId,
      ),
    }));
    void this.backgroundApi.serviceApp.showToast({
      method: 'success',
      title: appLocale.intl.formatMessage({
        id: ETranslations.settings_clear_successful,
      }),
    });
  }

  @backgroundMethod()
  async cleanHistoryStateIntervals(historyId?: string) {
    if (!historyId) {
      Object.values(this.historyStateIntervals).forEach((interval) => {
        clearInterval(interval);
      });
      this.historyStateIntervals = {};
      this.historyStateIntervalCountMap = {};
    } else if (this.historyStateIntervals[historyId]) {
      clearInterval(this.historyStateIntervals[historyId]);
      delete this.historyStateIntervals[historyId];
      delete this.historyStateIntervalCountMap[historyId];
    }
  }

  async swapHistoryStatusRunFetch(swapTxHistory: ISwapTxHistory) {
    let enableInterval = true;
    try {
      const txStatusRes = await this.fetchTxState({
        txId: swapTxHistory.txInfo.txId,
        provider: swapTxHistory.swapInfo.provider.provider,
        protocol: EProtocolOfExchange.SWAP,
        networkId: swapTxHistory.baseInfo.fromToken.networkId,
        ctx: swapTxHistory.ctx,
        toTokenAddress: swapTxHistory.baseInfo.toToken.contractAddress,
        receivedAddress: swapTxHistory.txInfo.receiver,
        orderId: swapTxHistory.swapInfo.orderId,
      });
      if (txStatusRes?.state !== ESwapTxHistoryStatus.PENDING) {
        enableInterval = false;
        await this.updateSwapHistoryItem({
          ...swapTxHistory,
          status: txStatusRes.state,
          txInfo: {
            ...swapTxHistory.txInfo,
            receiverTransactionId: txStatusRes.crossChainReceiveTxHash || '',
            gasFeeInNative: txStatusRes.gasFee
              ? txStatusRes.gasFee
              : swapTxHistory.txInfo.gasFeeInNative,
            gasFeeFiatValue: txStatusRes.gasFeeFiatValue
              ? txStatusRes.gasFeeFiatValue
              : swapTxHistory.txInfo.gasFeeFiatValue,
          },
          baseInfo: {
            ...swapTxHistory.baseInfo,
            toAmount: txStatusRes.dealReceiveAmount
              ? txStatusRes.dealReceiveAmount
              : swapTxHistory.baseInfo.toAmount,
          },
        });
        await this.cleanHistoryStateIntervals(swapTxHistory.txInfo.txId);
      }
    } catch (e) {
      const error = e as { message?: string };
      console.error('Swap History Status Fetch Error', error?.message);
    } finally {
      if (enableInterval) {
        this.historyStateIntervalCountMap[swapTxHistory.txInfo.txId] =
          (this.historyStateIntervalCountMap[swapTxHistory.txInfo.txId] ?? 0) +
          1;
        this.historyStateIntervals[swapTxHistory.txInfo.txId] = setTimeout(
          () => {
            void this.swapHistoryStatusRunFetch(swapTxHistory);
          },
          swapHistoryStateFetchInterval *
            (Math.floor(
              (this.historyStateIntervalCountMap[swapTxHistory.txInfo.txId] ??
                0) / swapHistoryStateFetchRiceIntervalCount,
            ) +
              1),
        );
      }
    }
  }

  @backgroundMethod()
  async swapHistoryStatusFetchLoop() {
    const { swapHistoryPendingList } = await inAppNotificationAtom.get();
    const statusPendingList = swapHistoryPendingList.filter(
      (item) =>
        item.status === ESwapTxHistoryStatus.PENDING ||
        item.status === ESwapTxHistoryStatus.CANCELING,
    );
    await this.cleanHistoryStateIntervals();
    if (!statusPendingList.length) return;
    await Promise.all(
      statusPendingList.map(async (swapTxHistory) => {
        await this.swapHistoryStatusRunFetch(swapTxHistory);
      }),
    );
  }

  @backgroundMethod()
  async swapRecentTokenSync() {
    const recentTokenPairs =
      await this.backgroundApi.simpleDb.swapConfigs.getRecentTokenPairs();

    // To avoid getting the token balance information of the last transaction, we need to get the token base information again
    const recentTokenPairsBase = recentTokenPairs.map((tokenPairs) => {
      const { fromToken, toToken } = tokenPairs;
      return {
        fromToken: {
          networkId: fromToken.networkId,
          contractAddress: fromToken.contractAddress,
          symbol: fromToken.symbol,
          decimals: fromToken.decimals,
          name: fromToken.name,
          logoURI: fromToken.logoURI,
          networkLogoURI: fromToken.networkLogoURI,
          isNative: fromToken.isNative,
        },
        toToken: {
          networkId: toToken.networkId,
          contractAddress: toToken.contractAddress,
          symbol: toToken.symbol,
          decimals: toToken.decimals,
          name: toToken.name,
          logoURI: toToken.logoURI,
          networkLogoURI: toToken.networkLogoURI,
          isNative: toToken.isNative,
        },
      };
    });
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapRecentTokenPairs: recentTokenPairsBase,
    }));
  }

  @backgroundMethod()
  async swapRecentTokenPairsUpdate({
    fromToken,
    toToken,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
  }) {
    let { swapRecentTokenPairs: recentTokenPairs } =
      await inAppNotificationAtom.get();
    const isExit = recentTokenPairs.some(
      (pair) =>
        (equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: pair.fromToken,
        }) &&
          equalTokenNoCaseSensitive({
            token1: toToken,
            token2: pair.toToken,
          })) ||
        (equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: pair.toToken,
        }) &&
          equalTokenNoCaseSensitive({
            token1: toToken,
            token2: pair.fromToken,
          })),
    );
    if (isExit) {
      recentTokenPairs = recentTokenPairs.filter(
        (pair) =>
          !(
            (equalTokenNoCaseSensitive({
              token1: fromToken,
              token2: pair.fromToken,
            }) &&
              equalTokenNoCaseSensitive({
                token1: toToken,
                token2: pair.toToken,
              })) ||
            (equalTokenNoCaseSensitive({
              token1: fromToken,
              token2: pair.toToken,
            }) &&
              equalTokenNoCaseSensitive({
                token1: toToken,
                token2: pair.fromToken,
              }))
          ),
      );
    }
    const fromTokenBaseInfo: ISwapToken = {
      networkId: fromToken.networkId,
      contractAddress: fromToken.contractAddress,
      symbol: fromToken.symbol,
      decimals: fromToken.decimals,
      name: fromToken.name,
      logoURI: fromToken.logoURI,
      networkLogoURI: fromToken.networkLogoURI,
      isNative: fromToken.isNative,
    };
    const toTokenBaseInfo: ISwapToken = {
      networkId: toToken.networkId,
      contractAddress: toToken.contractAddress,
      symbol: toToken.symbol,
      decimals: toToken.decimals,
      name: toToken.name,
      logoURI: toToken.logoURI,
      networkLogoURI: toToken.networkLogoURI,
      isNative: toToken.isNative,
    };
    let newRecentTokenPairs = [
      {
        fromToken: fromTokenBaseInfo,
        toToken: toTokenBaseInfo,
      },
      ...recentTokenPairs,
    ];

    let singleChainTokenPairs = newRecentTokenPairs.filter(
      (t) => t.fromToken.networkId === t.toToken.networkId,
    );
    let crossChainTokenPairs = newRecentTokenPairs.filter(
      (t) => t.fromToken.networkId !== t.toToken.networkId,
    );

    if (singleChainTokenPairs.length > maxRecentTokenPairs) {
      singleChainTokenPairs = singleChainTokenPairs.slice(
        0,
        maxRecentTokenPairs,
      );
    }
    if (crossChainTokenPairs.length > maxRecentTokenPairs) {
      crossChainTokenPairs = crossChainTokenPairs.slice(0, maxRecentTokenPairs);
    }
    newRecentTokenPairs = [...singleChainTokenPairs, ...crossChainTokenPairs];
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapRecentTokenPairs: newRecentTokenPairs,
    }));
    await this.backgroundApi.simpleDb.swapConfigs.addRecentTokenPair(
      fromTokenBaseInfo,
      toTokenBaseInfo,
      isExit,
    );
  }
}
