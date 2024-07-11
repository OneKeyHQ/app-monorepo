import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  swapHistoryStateFetchInterval,
  swapHistoryStateFetchRiceIntervalCount,
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
  ESwapFetchCancelCause,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { inAppNotificationAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  private _quoteAbortController?: AbortController;

  private _tokenListAbortController?: AbortController;

  private historyStateIntervals: Record<string, ReturnType<typeof setTimeout>> =
    {};

  private historyStateIntervalCountMap: Record<string, number> = {};

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
            explorers: clientNetwork.explorers,
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
  }: IFetchTokensParams): Promise<ISwapToken[]> {
    await this.cancelFetchTokenList();
    const params: IFetchTokenListParams = {
      protocol: EProtocolOfExchange.SWAP,
      networkId,
      keywords,
      limit,
      accountAddress,
      accountNetworkId,
    };
    this._tokenListAbortController = new AbortController();
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
          signal: this._tokenListAbortController.signal,
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
  async fetchSwapTokenDetails({
    networkId,
    accountAddress,
    accountId,
    contractAddress,
  }: {
    networkId: string;
    accountAddress?: string;
    accountId?: string;
    contractAddress: string;
  }): Promise<ISwapToken[] | undefined> {
    const params: IFetchTokenDetailParams = {
      protocol: EProtocolOfExchange.SWAP,
      networkId,
      accountAddress,
      contractAddress,
    };
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
    ctx,
  }: {
    txId: string;
    toTokenAddress?: string;
    receivedAddress?: string;
    networkId: string;
    protocol?: EProtocolOfExchange;
    provider?: string;
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
}
