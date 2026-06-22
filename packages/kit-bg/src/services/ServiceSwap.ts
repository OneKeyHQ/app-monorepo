/* eslint-disable no-restricted-syntax */
// oxlint-disable preserve-caught-error
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { cloneDeep, has, isEqual } from 'lodash';

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
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import EventSource from '@onekeyhq/shared/src/eventSource';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { withCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatBalance,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  isPrivateSendSwapHistoryItem,
  isSamePrivateSendSwapHistoryItem,
  isSwapHistoryProtocolExcluded,
} from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import {
  getDenyBridgeProviderString,
  getDenySwapProviderString,
  hasUnifiedCrossChainSwapProviderManagers,
  mergeDenyProviderStrings,
} from '@onekeyhq/shared/src/utils/swapProviderManagerUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { shouldSendSwapLpTokenParam } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  USDC_TOKEN_INFO,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IMarketTokenDetailData } from '@onekeyhq/shared/types/marketV2';
import type { ESigningScheme } from '@onekeyhq/shared/types/message';
import type {
  ISwapProviderManager,
  ISwapServiceProvider,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  maxRecentTokenPairs,
  mevSwapNetworks,
  privateSendFallbackOrderIdPrefix,
  privateSendProvider,
  swapApprovingStateFetchInterval,
  swapDefaultSetTokens,
  swapHistoryStateFetchInterval,
  swapHistoryStateFetchRiceIntervalCount,
  swapQuoteEventTimeout,
  swapSpeedSwapApprovingStateFetchInterval,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ESwapExtraStatus,
  ESwapQuoteKind,
  IFetchBuildTxParams,
  IFetchBuildTxResponse,
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchResponse,
  IFetchSpeedCheckResult,
  IFetchSwapQuoteParams,
  IFetchSwapTxHistoryStatusResponse,
  IFetchTokenDetailParams,
  IFetchTokenListParams,
  IFetchTokensParams,
  IFetchUSMarketStatusResult,
  ILMTronObject,
  IOKXTransactionObject,
  IPerpDepositQuoteResponse,
  IPopularTrading,
  ISpeedSwapConfig,
  ISwapApproveAllowanceResponse,
  ISwapApproveTransaction,
  ISwapCheckSupportResponse,
  ISwapNativeTokenConfig,
  ISwapNetwork,
  ISwapNetworkBase,
  ISwapTips,
  ISwapToken,
  ISwapTokenBase,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  ESwapFetchCancelCause,
  ESwapLimitOrderStatus,
  ESwapLimitOrderUpdateInterval,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  filterSwapHistoryPendingList,
  inAppNotificationAtom,
  perpsDepositOrderAtom,
} from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';
import { buildSpeedSwapTxParams } from './utils/buildSpeedSwapTxParams';
import { getSwapHistoryStateTxIdParam } from './utils/swapHistoryStateUtils';
import {
  isSwapTxHistoryStatusTerminal,
  shouldEmitSwapHistoryBalanceUpdate,
  shouldUpdateSwapHistoryAfterTxState,
} from './utils/swapHistoryStatusUtils';

import type { IAllNetworkAccountInfo } from './ServiceAllNetwork/ServiceAllNetwork';

const formatter: INumberFormatProps = {
  formatter: 'balance',
};

type ICheckStableCoinsListParamsItem = {
  networkId: string;
  contractAddressList: string[];
};

type ICheckStableCoinsListResultItem = {
  contractAddress: string;
  isStableCoin: boolean;
};

type ICheckStableCoinsListItem = {
  networkId: string;
  results: ICheckStableCoinsListResultItem[];
};

type IPrivateSendOrderDetail = {
  protocol?: EProtocolOfExchange;
  kind?: ESwapQuoteKind;
  changellyOrder?: IFetchBuildTxResponse['changellyOrder'];
  rocketXOrderId?: string;
  providerInfo?: ISwapTxHistory['swapInfo']['provider'];
  fromAmount?: string;
  fromToken?: ISwapTokenBase;
  toToken?: ISwapTokenBase;
  toAmount?: string;
  receivingAddress?: string;
  percentageFee?: number;
  protocolFee?: number;
  instantRate?: string;
  state?: ESwapTxHistoryStatus | 'created';
  extraStatus?: ESwapExtraStatus;
  stateDetail?: string;
  txId?: string;
  swapOrderHash?: IFetchSwapTxHistoryStatusResponse['swapOrderHash'];
  orderId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type IPrivateSendStatusSource = 'stateTx' | 'orderDetail';

type IFetchSwapHistoryStatusResult = {
  orderDetail?: IPrivateSendOrderDetail;
  txStatusRes?: IFetchSwapTxHistoryStatusResponse;
  shouldPreserveExistingExtraStatus?: boolean;
};

function normalizePrivateSendOrderDetailState(
  state?: IPrivateSendOrderDetail['state'],
) {
  if (!state) {
    return undefined;
  }
  if (state === 'created') {
    return ESwapTxHistoryStatus.PENDING;
  }
  return Object.values(ESwapTxHistoryStatus).includes(state)
    ? state
    : undefined;
}

function getPrivateSendOrderDetailTime(value?: string) {
  if (!value) {
    return undefined;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function mergePrivateSendOrderDetailToken({
  currentToken,
  orderDetailToken,
}: {
  currentToken: ISwapToken;
  orderDetailToken?: ISwapTokenBase;
}): ISwapToken {
  if (!orderDetailToken) {
    return currentToken;
  }
  const isSameToken = equalTokenNoCaseSensitive({
    token1: currentToken,
    token2: orderDetailToken,
  });
  return {
    ...currentToken,
    ...orderDetailToken,
    price: isSameToken ? currentToken.price : undefined,
  };
}

function getPrivateSendOrderDetailTxState(
  orderDetail?: IPrivateSendOrderDetail | null,
): IFetchSwapTxHistoryStatusResponse | undefined {
  if (!orderDetail) {
    return undefined;
  }
  const state = normalizePrivateSendOrderDetailState(orderDetail.state);
  if (!state) {
    return undefined;
  }
  return {
    state,
    extraStatus: orderDetail.extraStatus,
    stateDetail: orderDetail.stateDetail,
    txId: orderDetail.txId,
    dealReceiveAmount: orderDetail.toAmount,
    swapOrderHash: orderDetail.swapOrderHash,
  };
}

function mergePrivateSendOrderDetailToSwapHistory({
  item,
  orderDetail,
}: {
  item: ISwapTxHistory;
  orderDetail: IPrivateSendOrderDetail;
}): ISwapTxHistory {
  const created = getPrivateSendOrderDetailTime(orderDetail.createdAt);
  const updated = getPrivateSendOrderDetailTime(orderDetail.updatedAt);
  const state = normalizePrivateSendOrderDetailState(orderDetail.state);
  return {
    ...item,
    protocol: orderDetail.protocol ?? item.protocol,
    status: state ?? item.status,
    extraStatus: orderDetail.extraStatus ?? item.extraStatus,
    stateDetail: orderDetail.stateDetail ?? item.stateDetail,
    swapOrderHash: orderDetail.swapOrderHash ?? item.swapOrderHash,
    baseInfo: {
      ...item.baseInfo,
      fromAmount: orderDetail.fromAmount ?? item.baseInfo.fromAmount,
      toAmount: orderDetail.toAmount ?? item.baseInfo.toAmount,
      fromToken: mergePrivateSendOrderDetailToken({
        currentToken: item.baseInfo.fromToken,
        orderDetailToken: orderDetail.fromToken,
      }),
      toToken: mergePrivateSendOrderDetailToken({
        currentToken: item.baseInfo.toToken,
        orderDetailToken: orderDetail.toToken,
      }),
    },
    txInfo: {
      ...item.txInfo,
      txId: orderDetail.txId ?? item.txInfo.txId,
      orderId: orderDetail.orderId ?? item.txInfo.orderId,
      useOrderId: item.txInfo.useOrderId,
      receiver: orderDetail.receivingAddress ?? item.txInfo.receiver,
    },
    swapInfo: {
      ...item.swapInfo,
      provider: orderDetail.providerInfo ?? item.swapInfo.provider,
      instantRate: orderDetail.instantRate ?? item.swapInfo.instantRate,
      oneKeyFee: orderDetail.percentageFee ?? item.swapInfo.oneKeyFee,
      protocolFee: orderDetail.protocolFee ?? item.swapInfo.protocolFee,
      orderId: orderDetail.orderId ?? item.swapInfo.orderId,
    },
    ctx: {
      ...(typeof item.ctx === 'object' && item.ctx !== null ? item.ctx : {}),
      ...(orderDetail.rocketXOrderId
        ? { rocketXOrderId: orderDetail.rocketXOrderId }
        : {}),
      ...(orderDetail.changellyOrder?.payinAddress
        ? { payinAddress: orderDetail.changellyOrder.payinAddress }
        : {}),
    },
    date: {
      created: created ?? item.date.created,
      updated: updated ?? item.date.updated,
    },
  };
}

function isPrivateSendProtocol(protocol?: string) {
  return (
    protocol === ESwapTabSwitchType.PRIVATE_SEND ||
    protocol === EProtocolOfExchange.PRIVATE_SEND
  );
}

function isStockProtocol(protocol?: string) {
  return (
    protocol === ESwapTabSwitchType.STOCK ||
    protocol === EProtocolOfExchange.STOCK
  );
}

function getProtocolOfExchangeFromSwapTab(
  protocol?: string,
): EProtocolOfExchange {
  if (
    protocol === ESwapTabSwitchType.LIMIT ||
    protocol === EProtocolOfExchange.LIMIT
  ) {
    return EProtocolOfExchange.LIMIT;
  }
  if (isPrivateSendProtocol(protocol)) {
    return EProtocolOfExchange.PRIVATE_SEND;
  }
  if (isStockProtocol(protocol)) {
    return EProtocolOfExchange.STOCK;
  }
  return EProtocolOfExchange.SWAP;
}

function getPrivateSendRocketXOrderIdFromCtx(ctx: unknown) {
  const rocketXOrderId = (ctx as { rocketXOrderId?: unknown } | undefined)
    ?.rocketXOrderId;
  return typeof rocketXOrderId === 'string' && rocketXOrderId
    ? rocketXOrderId
    : undefined;
}

function getPrivateSendPayinAddressFromCtx(ctx: unknown) {
  const payinAddress = (ctx as { payinAddress?: unknown } | undefined)
    ?.payinAddress;
  return typeof payinAddress === 'string' && payinAddress
    ? payinAddress
    : undefined;
}

function isPrivateSendFallbackOrderId(orderId?: string) {
  return orderId?.startsWith(privateSendFallbackOrderIdPrefix) ?? false;
}

function getSwapHistoryStateReceivedAddress({
  swapTxHistory,
  isPrivateSendHistory,
}: {
  swapTxHistory: ISwapTxHistory;
  isPrivateSendHistory: boolean;
}) {
  if (!isPrivateSendHistory) {
    return swapTxHistory.txInfo.receiver || undefined;
  }
  return (
    getPrivateSendPayinAddressFromCtx(swapTxHistory.ctx) ||
    swapTxHistory.txInfo.receiver ||
    undefined
  );
}

function getSwapHistoryStateOrderId({
  swapTxHistory,
  isPrivateSendHistory,
}: {
  swapTxHistory: ISwapTxHistory;
  isPrivateSendHistory: boolean;
}) {
  const orderId = isPrivateSendHistory
    ? (swapTxHistory.swapInfo.orderId ?? swapTxHistory.txInfo.orderId)
    : swapTxHistory.swapInfo.orderId;
  if (!isPrivateSendHistory) {
    return orderId;
  }
  const rocketXOrderId = getPrivateSendRocketXOrderIdFromCtx(swapTxHistory.ctx);
  return orderId &&
    orderId !== rocketXOrderId &&
    !isPrivateSendFallbackOrderId(orderId)
    ? orderId
    : undefined;
}

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  private _speedSwapQuoteAbortController?: AbortController;

  private _checkTokenApproveAllowanceAbortController?: AbortController;

  private _tokenListAbortController?: AbortController;

  private _perpDepositQuoteController?: AbortController;

  private _quoteEventSource?: EventSource;

  private _quoteEventSourcePolyfill?: EventSourcePolyfill;

  private _tokenDetailAbortControllerMap: Record<
    ESwapDirectionType,
    AbortController | undefined
  > = { from: undefined, to: undefined };

  private historyStateIntervals: Record<string, ReturnType<typeof setTimeout>> =
    {};

  private limitOrderStateInterval: ReturnType<typeof setTimeout> | null = null;

  private perpDepositOrderFetchLoopInterval: ReturnType<
    typeof setTimeout
  > | null = null;

  private perpDepositOrderFetchLoopIntervalTimeout = 1000;

  private historyCurrentStateIntervalIds: string[] = [];

  private historyStateIntervalCountMap: Record<string, number> = {};

  private _crossChainReceiveTxBlockNotificationMap: Record<string, boolean> =
    {};

  // cache for limit order
  private _swapSupportNetworks: ISwapNetwork[] = [];

  private swapSupportNetworksCacheTime = 0;

  private swapSupportNetworksTtl = 1000 * 60 * 120;

  private _limitOrderCurrentAccountId?: string;

  private approvingInterval: ReturnType<typeof setTimeout> | undefined;

  private approvingIntervalCount = 0;

  private speedSwapApprovingInterval: ReturnType<typeof setTimeout> | undefined;

  private speedSwapApprovingIntervalCount = 0;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // --------------------- fetch
  @backgroundMethod()
  async cancelCheckTokenApproveAllowance() {
    if (this._checkTokenApproveAllowanceAbortController) {
      this._checkTokenApproveAllowanceAbortController.abort();
      this._checkTokenApproveAllowanceAbortController = undefined;
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
  async cancelFetchPerpDepositQuote() {
    if (this._perpDepositQuoteController) {
      this._perpDepositQuoteController.abort();
      this._perpDepositQuoteController = undefined;
    }
  }

  @backgroundMethod()
  async cancelFetchSpeedSwapQuote() {
    if (this._speedSwapQuoteAbortController) {
      this._speedSwapQuoteAbortController.abort();
      this._speedSwapQuoteAbortController = undefined;
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
  async fetchSwapNetworks(options?: {
    refreshClientNetworks?: boolean;
  }): Promise<ISwapNetwork[]> {
    const protocol = EProtocolOfExchange.ALL;
    const requestParams = {
      protocol,
    };
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const { data } = await client.get<IFetchResponse<ISwapNetworkBase[]>>(
      '/swap/v1/networks',
      { params: requestParams },
    );
    const allClientSupportNetworks =
      await this.backgroundApi.serviceNetwork.getAllNetworks({
        clearCache: options?.refreshClientNetworks,
      });
    const deFiEnabledNetworksMapState =
      await this.backgroundApi.serviceDeFi.getDeFiEnabledNetworksMapState({
        syncIfEmpty: false,
      });
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
            backendIndex: clientNetwork.backendIndex ?? false,
            ...(deFiEnabledNetworksMapState.isReady
              ? {
                  isDeFiEnabled:
                    !!deFiEnabledNetworksMapState.enabledNetworksMap[
                      network.networkId
                    ],
                }
              : {}),
            networkId: network.networkId,
            defaultSelectToken: network.defaultSelectToken,
            supportCrossChainSwap: network.supportCrossChainSwap,
            supportSingleSwap: network.supportSingleSwap,
            supportLimit: network.supportLimit,
            supportPrivateSend: network.supportPrivateSend,
            supportStock: network.supportStock,
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
    protocol,
    lpToken,
  }: IFetchTokensParams): Promise<ISwapToken[]> {
    if (!isAllNetworkFetchAccountTokens) {
      await this.cancelFetchTokenList();
    }
    const targetNetworkId = networkId ?? getNetworkIdsMap().onekeyall;
    const requestProtocol = getProtocolOfExchangeFromSwapTab(protocol);
    const shouldFetchStaticStockTokens =
      requestProtocol === EProtocolOfExchange.STOCK;
    const params: IFetchTokenListParams = {
      protocol: requestProtocol,
      networkId: targetNetworkId,
      keywords,
      limit,
      accountAddress:
        !shouldFetchStaticStockTokens &&
        !networkUtils.isAllNetwork({
          networkId: targetNetworkId,
        })
          ? accountAddress
          : undefined,
      accountNetworkId: shouldFetchStaticStockTokens
        ? undefined
        : accountNetworkId,
      skipReservationValue: true,
      onlyAccountTokens: shouldFetchStaticStockTokens
        ? undefined
        : onlyAccountTokens,
      ...(shouldSendSwapLpTokenParam(lpToken) ? { lpToken } : {}),
    };
    if (!isAllNetworkFetchAccountTokens) {
      this._tokenListAbortController = new AbortController();
    }
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    if (
      !shouldFetchStaticStockTokens &&
      accountId &&
      accountAddress &&
      networkId
    ) {
      try {
        const accountAddressForAccountId =
          await this.backgroundApi.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          });
        if (equalsIgnoreCase(accountAddressForAccountId, accountAddress)) {
          params.accountXpub =
            await this.backgroundApi.serviceAccount.getAccountXpub({
              accountId,
              networkId,
            });
        } else {
          // Drop stale addresses during network-switch races. The token list
          // endpoint treats accountAddress as optional and should not receive
          // another network's address.
          params.accountAddress = undefined;
        }
      } catch (e) {
        console.error(e);
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
        // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error -- needs standard Error cause semantics
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
          : (otherWalletTypeAccountId ?? '');
        // const accountsInfo: IAllNetworkAccountInfo[] = [];
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
    currency,
    protocol = EProtocolOfExchange.SWAP,
  }: {
    networkId: string;
    accountAddress?: string;
    accountId?: string;
    contractAddress: string;
    direction?: ESwapDirectionType;
    currency?: string;
    protocol?: EProtocolOfExchange;
  }): Promise<ISwapToken[] | undefined> {
    try {
      await this.cancelFetchTokenDetail(direction);
      const params: IFetchTokenDetailParams = {
        protocol,
        networkId,
        accountAddress,
        contractAddress,
        currency,
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
        try {
          const accountAddressForAccountId =
            await this.backgroundApi.serviceAccount.getAccountAddressForApi({
              accountId,
              networkId,
            });
          if (accountAddressForAccountId === accountAddress) {
            params.xpub =
              await this.backgroundApi.serviceAccount.getAccountXpub({
                accountId,
                networkId,
              });
          }
        } catch (e) {
          console.error(e);
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
      let fetchSignal: AbortSignal | undefined;
      if (direction === ESwapDirectionType.FROM) {
        fetchSignal = this._tokenDetailAbortControllerMap.from?.signal;
      } else if (direction === ESwapDirectionType.TO) {
        fetchSignal = this._tokenDetailAbortControllerMap.to?.signal;
      }
      const { data } = await client.get<IFetchResponse<ISwapToken[]>>(
        '/swap/v1/token/detail',
        {
          params,
          signal: fetchSignal,
          headers: {
            ...(await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              {
                accountId,
              },
            )),
            ...(currency ? { 'x-onekey-request-currency': currency } : {}),
          },
        },
      );
      return data?.data;
    } catch (e) {
      console.error(e);
      return [];
    }
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
    protocol,
    expirationTime,
    receivingAddress,
    incognito,
    limitPartiallyFillable,
    kind,
    toTokenAmount,
    userMarketPriceRate,
  }: IFetchSwapQuoteParams) {
    await this.removeQuoteEventSourceListeners();
    const denyCrossChainProvider = await this.getDenyCrossChainProvider(
      fromToken.networkId,
      toToken.networkId,
    );
    const denySingleSwapProvider = await this.getDenySingleSwapProvider(
      fromToken.networkId,
      toToken.networkId,
    );
    const walletDevice =
      await this.backgroundApi.serviceAccount.getAccountDeviceSafe({
        accountId: accountId ?? '',
      });
    const params: IFetchQuotesParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      protocol: getProtocolOfExchangeFromSwapTab(protocol),
      userAddress,
      slippagePercentage,
      autoSlippage,
      blockNumber,
      expirationTime,
      receivingAddress,
      limitPartiallyFillable,
      kind,
      toTokenAmount,
      userMarketPriceRate,
      denyCrossChainProvider,
      denySingleSwapProvider,
      walletDeviceType: walletDevice?.deviceType,
      ...(incognito ? { incognito } : {}),
    };
    const swapEventUrl = (
      await this.getClient(EServiceEndpointEnum.Swap)
    ).getUri({
      url: '/swap/v1/quote/events',
      params,
    });
    let headers = await getRequestHeaders();
    const walletType =
      await this.backgroundApi.serviceAccountProfile._getRequestWalletType({
        accountId,
      });
    headers = {
      ...headers,
      ...(accountId
        ? {
            'X-OneKey-Wallet-Type': walletType,
          }
        : {}),
    };
    headers = await withCustomUAHeaders(
      swapEventUrl,
      headers as Record<string, string>,
    );
    if (platformEnv.isExtension) {
      if (this._quoteEventSourcePolyfill) {
        this._quoteEventSourcePolyfill.close();
        this._quoteEventSourcePolyfill = undefined;
      }
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
      if (this._quoteEventSource) {
        this._quoteEventSource.close();
        this._quoteEventSource = undefined;
      }
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

  async getDenyCrossChainProvider(fromNetworkId: string, toNetworkId: string) {
    if (fromNetworkId === toNetworkId) {
      return undefined;
    }
    const { swapProviderManager, bridgeProviderManager } =
      await inAppNotificationAtom.get();
    return mergeDenyProviderStrings(
      getDenySwapProviderString({
        providerManagers: swapProviderManager,
        fromNetworkId,
        toNetworkId,
      }),
      getDenyBridgeProviderString({
        providerManagers: bridgeProviderManager,
      }),
    );
  }

  async getDenySingleSwapProvider(fromNetworkId: string, toNetworkId: string) {
    if (fromNetworkId !== toNetworkId) {
      return undefined;
    }
    const { swapProviderManager } = await inAppNotificationAtom.get();
    return getDenySwapProviderString({
      providerManagers: swapProviderManager,
      fromNetworkId,
      toNetworkId,
    });
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
    protocol,
    kind,
    walletType,
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
    protocol: EProtocolOfExchange;
    kind: ESwapQuoteKind;
    walletType?: string;
  }): Promise<IFetchBuildTxResponse | undefined> {
    const params: IFetchBuildTxParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      toTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      protocol,
      provider,
      userAddress,
      receivingAddress,
      slippagePercentage,
      quoteResultCtx,
      kind,
      walletType,
    };
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const { data } = await client.post<IFetchResponse<IFetchBuildTxResponse>>(
      '/swap/v1/build-tx',
      params,
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    return data?.data;
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
    txId?: string;
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

  private async fetchSwapOrderDetail({
    txId,
  }: {
    txId?: string;
  }): Promise<IPrivateSendOrderDetail | undefined> {
    if (!txId) {
      return undefined;
    }
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const { data } = await client.get<
      IFetchResponse<IPrivateSendOrderDetail | null>
    >('/swap/v1/order-detail', {
      params: { txId },
    });
    return data?.data ?? undefined;
  }

  @backgroundMethod()
  async fetchSwapOrderDetailTxState({
    txId,
  }: {
    txId?: string;
  }): Promise<IFetchSwapTxHistoryStatusResponse | undefined> {
    const orderDetail = await this.fetchSwapOrderDetail({ txId });
    return getPrivateSendOrderDetailTxState(orderDetail);
  }

  @backgroundMethod()
  async fetchPrivateSendOrderDetailHistoryItem({
    item,
  }: {
    item: ISwapTxHistory;
  }): Promise<ISwapTxHistory> {
    if (!isPrivateSendSwapHistoryItem(item) || !item.txInfo.txId) {
      return item;
    }
    const orderDetail = await this.fetchSwapOrderDetail({
      txId: item.txInfo.txId,
    });
    if (!orderDetail) {
      return item;
    }
    return mergePrivateSendOrderDetailToSwapHistory({ item, orderDetail });
  }

  @backgroundMethod()
  async checkStableCoinsList({
    list,
  }: {
    list: ICheckStableCoinsListParamsItem[];
  }): Promise<ICheckStableCoinsListItem[]> {
    if (!list.length) {
      return [];
    }
    const client = await this.getRawDataClient(EServiceEndpointEnum.Swap);
    const response = await client.post<
      IFetchResponse<ICheckStableCoinsListItem[]>
    >('/swap/v1/check-stable-coins-list', list);
    return response.data?.data ?? [];
  }

  @backgroundMethod()
  async checkSupportSwap({ networkId }: { networkId: string }) {
    return this.checkSupportSwapMemo({ networkId });
  }

  checkSupportSwapMemo = memoizee(
    async ({ networkId }: { networkId: string }) => {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const resp = await client.get<{
        data: ISwapCheckSupportResponse[];
      }>(`/swap/v1/check-support`, {
        params: {
          networkId,
          protocol: EProtocolOfExchange.SWAP,
        },
      });
      return resp.data.data[0];
    },
    {
      max: 10,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
      promise: true,
      primitive: true,
    },
  );

  @backgroundMethod()
  async fetchApproveAllowanceForDisplay({
    networkId,
    tokenAddress,
    spenderAddress,
    walletAddress,
    accountId,
    amount,
  }: {
    networkId: string;
    tokenAddress: string;
    spenderAddress: string;
    walletAddress: string;
    accountId?: string;
    amount: string;
  }) {
    // Read-only allowance lookup for passive display surfaces. Skips the
    // shared abort controller so concurrent display queries (or the swap /
    // bulk-send authorization state machines) don't cancel each other.
    const params = {
      networkId,
      tokenAddress,
      spenderAddress,
      walletAddress,
      amount,
    };
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const { data } = await client.get<
      IFetchResponse<ISwapApproveAllowanceResponse>
    >('/swap/v1/allowance', {
      params,
      headers:
        await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
          accountId,
        }),
    });
    return data?.data;
  }

  @backgroundMethod()
  async fetchApproveAllowance({
    networkId,
    tokenAddress,
    spenderAddress,
    walletAddress,
    accountId,
    amount,
  }: {
    networkId: string;
    tokenAddress: string;
    spenderAddress: string;
    walletAddress: string;
    accountId?: string;
    amount: string;
  }) {
    await this.cancelCheckTokenApproveAllowance();
    const params = {
      networkId,
      tokenAddress,
      spenderAddress,
      walletAddress,
      amount,
    };
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    this._checkTokenApproveAllowanceAbortController = new AbortController();
    try {
      const { data } = await client.get<
        IFetchResponse<ISwapApproveAllowanceResponse>
      >('/swap/v1/allowance', {
        params,
        signal: this._checkTokenApproveAllowanceAbortController.signal,
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      });
      return data?.data;
    } catch (e) {
      if (axios.isCancel(e)) {
        // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error -- needs standard Error cause semantics
        throw new Error('swap check token approve allowance cancel', {
          cause: ESwapFetchCancelCause.SWAP_APPROVE_ALLOWANCE_CANCEL,
        });
      }
      throw e;
    }
  }

  @backgroundMethod()
  async fetchSwapNativeTokenConfig({ networkId }: { networkId: string }) {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const resp = await client.get<{
        data: ISwapNativeTokenConfig;
      }>(`/swap/v1/native-token-config`, {
        params: { networkId },
      });
      return resp.data.data;
    } catch (e) {
      console.error(e);
      return {
        networkId,
        reserveGas: 0,
      };
    }
  }

  // swap approving transaction
  @backgroundMethod()
  async getApprovingTransaction() {
    const { swapApprovingTransaction } = await inAppNotificationAtom.get();
    return swapApprovingTransaction;
  }

  @backgroundMethod()
  async getSpeedSwapApprovingTransaction() {
    const { speedSwapApprovingTransaction } = await inAppNotificationAtom.get();
    return speedSwapApprovingTransaction;
  }

  @backgroundMethod()
  async setApprovingTransaction(item?: ISwapApproveTransaction) {
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapApprovingTransaction: item,
      ...(item?.status !== ESwapApproveTransactionStatus.PENDING && {
        swapApprovingLoading: false,
      }),
    }));
  }

  @backgroundMethod()
  async setSpeedSwapApprovingTransaction(item?: ISwapApproveTransaction) {
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      speedSwapApprovingTransaction: item,
      ...(item?.status !== ESwapApproveTransactionStatus.PENDING && {
        speedSwapApprovingLoading: false,
      }),
    }));
  }

  @backgroundMethod()
  async closeApproving() {
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapApprovingTransaction: undefined,
      swapApprovingLoading: false,
    }));
  }

  @backgroundMethod()
  async closeSpeedSwapApproving() {
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      speedSwapApprovingTransaction: undefined,
      speedSwapApprovingLoading: false,
    }));
  }

  // --- swap provider manager
  @backgroundMethod()
  async getSwapProviderManager() {
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const resp = await client.get<{
      data: ISwapServiceProvider[];
    }>(`/swap/v1/providers/list`);
    return resp.data.data;
  }

  @backgroundMethod()
  async updateSwapProviderManager(
    data: ISwapProviderManager[],
    isBridge?: boolean,
  ) {
    if (isBridge) {
      await this.backgroundApi.simpleDb.swapConfigs.setBridgeProviderManager(
        data,
      );
      await inAppNotificationAtom.set((pre) => ({
        ...pre,
        bridgeProviderManager: data,
      }));
      return;
    }
    const shouldClearLegacyBridgeProviderManager =
      hasUnifiedCrossChainSwapProviderManagers(data);

    await this.backgroundApi.simpleDb.swapConfigs.setSwapProviderManager(data);
    if (shouldClearLegacyBridgeProviderManager) {
      await this.backgroundApi.simpleDb.swapConfigs.setBridgeProviderManager(
        [],
      );
    }
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapProviderManager: data,
      ...(shouldClearLegacyBridgeProviderManager
        ? { bridgeProviderManager: [] }
        : undefined),
    }));
  }

  @backgroundMethod()
  async updateSwapApprovingLoading(loading: boolean) {
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapApprovingLoading: loading,
    }));
  }

  @backgroundMethod()
  async cleanApprovingInterval() {
    if (this.approvingInterval) {
      clearTimeout(this.approvingInterval);
      this.approvingInterval = undefined;
    }
  }

  @backgroundMethod()
  async cleanSpeedSwapApprovingInterval() {
    if (this.speedSwapApprovingInterval) {
      clearTimeout(this.speedSwapApprovingInterval);
      this.speedSwapApprovingInterval = undefined;
    }
  }

  async approvingStateRunSync(networkId: string, txId: string) {
    let enableInterval = true;
    try {
      const txState = await this.fetchTxState({
        txId,
        networkId,
      });
      const preApproveTx = await this.getApprovingTransaction();
      if (
        txState.state === ESwapTxHistoryStatus.SUCCESS ||
        txState.state === ESwapTxHistoryStatus.FAILED
      ) {
        enableInterval = false;
        if (preApproveTx) {
          if (
            txState.state === ESwapTxHistoryStatus.SUCCESS ||
            txState.state === ESwapTxHistoryStatus.FAILED
          ) {
            let newApproveTx: ISwapApproveTransaction = {
              ...preApproveTx,
              blockNumber: txState.blockNumber,
              status: ESwapApproveTransactionStatus.SUCCESS,
            };
            if (txState.state === ESwapTxHistoryStatus.FAILED) {
              newApproveTx = {
                ...preApproveTx,
                txId: undefined,
                status: ESwapApproveTransactionStatus.FAILED,
              };
            }
            await this.setApprovingTransaction(newApproveTx);
          }
        }
      } else if (
        preApproveTx &&
        preApproveTx.status !== ESwapApproveTransactionStatus.PENDING
      ) {
        await this.setApprovingTransaction({
          ...preApproveTx,
          status: ESwapApproveTransactionStatus.PENDING,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (enableInterval) {
        this.approvingIntervalCount += 1;
        void this.approvingStateAction();
      } else {
        void this.cleanApprovingInterval();
        this.approvingIntervalCount = 0;
      }
    }
  }

  async speedSwapApprovingStateRunSync(networkId: string, txId: string) {
    let enableInterval = true;
    try {
      const txState = await this.fetchTxState({
        txId,
        networkId,
      });
      const preApproveTx = await this.getSpeedSwapApprovingTransaction();
      if (
        txState.state === ESwapTxHistoryStatus.SUCCESS ||
        txState.state === ESwapTxHistoryStatus.FAILED
      ) {
        enableInterval = false;
        if (preApproveTx) {
          if (
            txState.state === ESwapTxHistoryStatus.SUCCESS ||
            txState.state === ESwapTxHistoryStatus.FAILED
          ) {
            let newApproveTx: ISwapApproveTransaction = {
              ...preApproveTx,
              blockNumber: txState.blockNumber,
              status: ESwapApproveTransactionStatus.SUCCESS,
            };
            if (txState.state === ESwapTxHistoryStatus.FAILED) {
              newApproveTx = {
                ...preApproveTx,
                txId: undefined,
                status: ESwapApproveTransactionStatus.FAILED,
              };
            }
            await this.setSpeedSwapApprovingTransaction(newApproveTx);
          }
        }
      } else if (
        preApproveTx &&
        preApproveTx.status !== ESwapApproveTransactionStatus.PENDING
      ) {
        await this.setSpeedSwapApprovingTransaction({
          ...preApproveTx,
          status: ESwapApproveTransactionStatus.PENDING,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (enableInterval) {
        this.speedSwapApprovingIntervalCount += 1;
        void this.speedSwapApprovingStateAction();
      } else {
        void this.cleanSpeedSwapApprovingInterval();
        this.speedSwapApprovingIntervalCount = 0;
      }
    }
  }

  @backgroundMethod()
  async approvingStateAction() {
    void this.cleanApprovingInterval();
    const approvingTransaction = await this.getApprovingTransaction();
    if (approvingTransaction && approvingTransaction.txId) {
      this.approvingInterval = setTimeout(
        () => {
          if (approvingTransaction.txId) {
            void this.approvingStateRunSync(
              approvingTransaction.fromToken.networkId,
              approvingTransaction.txId,
            );
          }
        },
        swapApprovingStateFetchInterval *
          (Math.floor(
            this.approvingIntervalCount /
              swapHistoryStateFetchRiceIntervalCount,
          ) +
            1),
      );
    }
  }

  @backgroundMethod()
  async speedSwapApprovingStateAction() {
    void this.cleanSpeedSwapApprovingInterval();
    const approvingTransaction = await this.getSpeedSwapApprovingTransaction();
    if (approvingTransaction && approvingTransaction.txId) {
      this.speedSwapApprovingInterval = setTimeout(
        () => {
          if (approvingTransaction.txId) {
            void this.speedSwapApprovingStateRunSync(
              approvingTransaction.fromToken.networkId,
              approvingTransaction.txId,
            );
          }
        },
        swapSpeedSwapApprovingStateFetchInterval *
          (Math.floor(
            this.speedSwapApprovingIntervalCount /
              swapHistoryStateFetchRiceIntervalCount,
          ) +
            1),
      );
    }
  }

  // --- swap history
  @backgroundMethod()
  async fetchSwapHistoryListFromSimple() {
    const histories =
      await this.backgroundApi.simpleDb.swapHistory.getSwapHistoryList();
    return histories.toSorted((a, b) => b.date.created - a.date.created);
  }

  private isSwapHistoryPendingStatus(history: ISwapTxHistory) {
    return (
      history.status === ESwapTxHistoryStatus.PENDING ||
      history.status === ESwapTxHistoryStatus.CANCELING
    );
  }

  private isSameSwapHistoryItem(a: ISwapTxHistory, b: ISwapTxHistory) {
    const bPrimaryId = b.txInfo.useOrderId ? b.txInfo.orderId : b.txInfo.txId;
    const aPrimaryId = b.txInfo.useOrderId ? a.txInfo.orderId : a.txInfo.txId;
    if (bPrimaryId && aPrimaryId === bPrimaryId) {
      return true;
    }
    return isSamePrivateSendSwapHistoryItem(a, b);
  }

  private getSwapHistoryIntervalKey(swapTxHistory: ISwapTxHistory) {
    return swapTxHistory.txInfo.useOrderId
      ? (swapTxHistory.txInfo.orderId ?? '')
      : (swapTxHistory.txInfo.txId ?? '');
  }

  private getSwapHistoryIntervalKeys(swapTxHistory: ISwapTxHistory) {
    return Array.from(
      new Set(
        [
          this.getSwapHistoryIntervalKey(swapTxHistory),
          swapTxHistory.txInfo.txId,
          swapTxHistory.txInfo.orderId,
          swapTxHistory.swapInfo.orderId,
        ].filter((id): id is string => !!id),
      ),
    );
  }

  private async cleanSwapHistoryStateIntervals(
    ...swapTxHistories: ISwapTxHistory[]
  ) {
    const ids = Array.from(
      new Set(
        swapTxHistories.flatMap((item) =>
          this.getSwapHistoryIntervalKeys(item),
        ),
      ),
    );
    await Promise.all(ids.map((id) => this.cleanHistoryStateIntervals(id)));
  }

  @backgroundMethod()
  async syncSwapHistoryPendingList() {
    const histories = await this.fetchSwapHistoryListFromSimple();
    const pendingHistories = histories.filter((history) =>
      this.isSwapHistoryPendingStatus(history),
    );
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: filterSwapHistoryPendingList(pendingHistories),
    }));
  }

  @backgroundMethod()
  async refreshSwapHistoryPendingStatusOnce() {
    const histories = await this.fetchSwapHistoryListFromSimple();
    const pendingHistories = histories.filter((history) =>
      this.isSwapHistoryPendingStatus(history),
    );
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: filterSwapHistoryPendingList(pendingHistories),
    }));

    if (!pendingHistories.length) {
      return;
    }

    await Promise.all(
      pendingHistories.map((swapTxHistory) =>
        this.swapHistoryStatusRunFetch(swapTxHistory, {
          shouldScheduleNextFetch: false,
          shouldShowToast: false,
        }),
      ),
    );
  }

  @backgroundMethod()
  async getSwapHistoryByTxId({ txId }: { txId: string }) {
    const history =
      await this.backgroundApi.simpleDb.swapHistory.getSwapHistoryByTxId(txId);
    return history;
  }

  @backgroundMethod()
  async addSwapHistoryItem(item: ISwapTxHistory) {
    await this.backgroundApi.simpleDb.swapHistory.addSwapHistoryItem(item);
    await inAppNotificationAtom.set((pre) => {
      const filteredList = filterSwapHistoryPendingList(
        pre.swapHistoryPendingList,
      );
      const matchFn = (i: ISwapTxHistory) =>
        this.isSameSwapHistoryItem(i, item);
      const unmatchedList = filteredList.filter((i) => !matchFn(i));
      if (this.isSwapHistoryPendingStatus(item)) {
        return {
          ...pre,
          swapHistoryPendingList: [...unmatchedList, item],
        };
      }
      const matchedInPendingList = filteredList.some(matchFn);
      if (matchedInPendingList) {
        return {
          ...pre,
          swapHistoryPendingList: filteredList.map((i) =>
            matchFn(i) ? item : i,
          ),
        };
      }
      // Item already exists — only update state if dirty entries were removed,
      // otherwise return the original reference to avoid unnecessary re-renders.
      if (filteredList.length !== pre.swapHistoryPendingList.length) {
        return { ...pre, swapHistoryPendingList: filteredList };
      }
      return pre;
    });
    if (
      isPrivateSendSwapHistoryItem(item) &&
      !this.isSwapHistoryPendingStatus(item)
    ) {
      appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
    }
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
    const oldHistoryItem = filterSwapHistoryPendingList(
      swapHistoryPendingList,
    ).find((item) => item.txInfo.txId === oldTxId);
    if (oldHistoryItem) {
      const updated = Date.now();
      const newHistoryItem = {
        ...oldHistoryItem,
        date: { ...oldHistoryItem.date, updated },
        txInfo: { ...oldHistoryItem.txInfo, txId: newTxId },
        status,
      };
      await this.backgroundApi.simpleDb.swapHistory.updateSwapHistoryItem(
        newHistoryItem,
        oldTxId,
      );
      await inAppNotificationAtom.set((pre) => {
        const newPendingList = filterSwapHistoryPendingList(
          pre.swapHistoryPendingList,
        ).map((item) => (item.txInfo.txId === oldTxId ? newHistoryItem : item));
        return {
          ...pre,
          swapHistoryPendingList: newPendingList,
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
  async updateSwapHistoryItem(
    item: ISwapTxHistory,
    options?: { shouldShowToast?: boolean },
  ) {
    const { swapHistoryPendingList } = await inAppNotificationAtom.get();
    const shouldShowToast = options?.shouldShowToast ?? true;
    const filteredList = filterSwapHistoryPendingList(swapHistoryPendingList);
    const matchFn = (i: ISwapTxHistory) => this.isSameSwapHistoryItem(i, item);
    const oldItem = filteredList.find(matchFn);
    const updated = Date.now();
    item.date = { ...item.date, updated };
    if (oldItem) {
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
      await inAppNotificationAtom.set((pre) => {
        const newPendingList = filterSwapHistoryPendingList(
          pre.swapHistoryPendingList,
        ).map((i) => (matchFn(i) ? item : i));
        return {
          ...pre,
          swapHistoryPendingList: newPendingList,
        };
      });
      const isPrivateSendHistory = isPrivateSendSwapHistoryItem(item);
      const isSuccessStatus =
        item.status === ESwapTxHistoryStatus.SUCCESS ||
        item.status === ESwapTxHistoryStatus.PARTIALLY_FILLED;
      if (
        shouldShowToast &&
        item.status !== ESwapTxHistoryStatus.PENDING &&
        (!isPrivateSendHistory || isSuccessStatus)
      ) {
        let toastTitleId = ETranslations.swap_page_toast_swap_failed;
        if (isSuccessStatus) {
          toastTitleId = isPrivateSendHistory
            ? ETranslations.private_send_success
            : ETranslations.swap_page_toast_swap_successful;
        }
        let fromAmountFinal = item.baseInfo.fromAmount;
        if (item.swapInfo.otherFeeInfos?.length) {
          item.swapInfo.otherFeeInfos.forEach((extraFeeInfo) => {
            if (
              equalTokenNoCaseSensitive({
                token1: extraFeeInfo.token,
                token2: item.baseInfo.fromToken,
              })
            ) {
              fromAmountFinal = new BigNumber(fromAmountFinal)
                .plus(extraFeeInfo.amount ?? 0)
                .toFixed();
            }
          });
        }
        void this.backgroundApi.serviceApp.showToast({
          method: isSuccessStatus ? 'success' : 'error',
          title: appLocale.intl.formatMessage({
            id: toastTitleId,
          }),
          message: `${numberFormat(item.baseInfo.fromAmount, formatter)} ${
            item.baseInfo.fromToken.symbol
          } → ${numberFormat(item.baseInfo.toAmount, formatter)} ${
            item.baseInfo.toToken.symbol
          }`,
        });
      }
    }
    await this.backgroundApi.simpleDb.swapHistory.updateSwapHistoryItem(item);
    if (isPrivateSendSwapHistoryItem(item)) {
      appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
    }
  }

  @backgroundMethod()
  async cleanSwapHistoryItems(
    statuses?: ESwapTxHistoryStatus[],
    options?: {
      excludeProtocols?: EProtocolOfExchange[];
    },
  ) {
    await this.backgroundApi.simpleDb.swapHistory.deleteSwapHistoryItem(
      statuses,
      options,
    );
    const inAppNotification = await inAppNotificationAtom.get();
    const deleteHistoryIds = filterSwapHistoryPendingList(
      inAppNotification.swapHistoryPendingList,
    )
      .filter((item) => {
        if (
          isSwapHistoryProtocolExcluded({
            item,
            excludeProtocols: options?.excludeProtocols,
          })
        ) {
          return false;
        }
        return statuses ? statuses.includes(item.status) : true;
      })
      .map((item) =>
        item.txInfo.useOrderId ? item.txInfo.orderId : item.txInfo.txId,
      );
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: filterSwapHistoryPendingList(
        pre.swapHistoryPendingList,
      ).filter((item) => {
        if (
          isSwapHistoryProtocolExcluded({
            item,
            excludeProtocols: options?.excludeProtocols,
          })
        ) {
          return true;
        }
        return statuses ? !statuses.includes(item.status) : false;
      }),
    }));
    await Promise.all(
      deleteHistoryIds.map((id) => this.cleanHistoryStateIntervals(id)),
    );
  }

  @backgroundMethod()
  async cleanOneSwapHistory(txInfo: {
    txId?: string;
    useOrderId?: boolean;
    orderId?: string;
  }) {
    await this.backgroundApi.simpleDb.swapHistory.deleteOneSwapHistory(txInfo);
    const deleteHistoryId = txInfo.useOrderId
      ? (txInfo.orderId ?? '')
      : (txInfo.txId ?? '');
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: filterSwapHistoryPendingList(
        pre.swapHistoryPendingList,
      ).filter(
        (item) =>
          (item.txInfo.useOrderId ? item.txInfo.orderId : item.txInfo.txId) !==
          deleteHistoryId,
      ),
    }));
    await this.cleanHistoryStateIntervals(deleteHistoryId);
  }

  @backgroundMethod()
  async cleanHistoryStateIntervals(historyId?: string) {
    if (!historyId) {
      this.historyCurrentStateIntervalIds = [];
      await Promise.all(
        Object.keys(this.historyStateIntervals).map(async (id) => {
          clearInterval(this.historyStateIntervals[id]);
          delete this.historyStateIntervals[id];
          delete this.historyStateIntervalCountMap[id];
        }),
      );
    } else {
      if (this.historyStateIntervals[historyId]) {
        clearInterval(this.historyStateIntervals[historyId]);
      }
      this.historyCurrentStateIntervalIds =
        this.historyCurrentStateIntervalIds.filter((id) => id !== historyId);
      delete this.historyStateIntervals[historyId];
      delete this.historyStateIntervalCountMap[historyId];
    }
  }

  private async clearLocalPendingTxForTerminalSwap(
    swapTxHistory: ISwapTxHistory,
  ) {
    const txId = swapTxHistory.txInfo.txId;
    if (!txId) {
      return;
    }

    try {
      await this.backgroundApi.serviceHistory.clearLocalHistoryPendingTxByTxId({
        accountId: swapTxHistory.accountInfo.sender.accountId,
        networkId: swapTxHistory.baseInfo.fromToken.networkId,
        txid: txId,
        accountAddress: swapTxHistory.txInfo.sender,
      });
    } catch (error) {
      console.error('Clear swap local pending tx error', error);
    }
  }

  private async fetchSwapHistoryStateTx({
    currentSwapTxHistory,
    isPrivateSendHistory,
  }: {
    currentSwapTxHistory: ISwapTxHistory;
    isPrivateSendHistory: boolean;
  }) {
    const stateOrderId = getSwapHistoryStateOrderId({
      swapTxHistory: currentSwapTxHistory,
      isPrivateSendHistory,
    });
    const stateReceivedAddress = getSwapHistoryStateReceivedAddress({
      swapTxHistory: currentSwapTxHistory,
      isPrivateSendHistory,
    });
    return this.fetchTxState({
      txId: getSwapHistoryStateTxIdParam(currentSwapTxHistory),
      provider: currentSwapTxHistory.swapInfo.provider.provider,
      protocol:
        currentSwapTxHistory.protocol ??
        (currentSwapTxHistory.swapInfo.provider.provider === privateSendProvider
          ? EProtocolOfExchange.PRIVATE_SEND
          : EProtocolOfExchange.SWAP),
      networkId: currentSwapTxHistory.baseInfo.fromToken.networkId,
      ctx: currentSwapTxHistory.ctx,
      toTokenAddress: currentSwapTxHistory.baseInfo.toToken.contractAddress,
      receivedAddress: stateReceivedAddress,
      orderId: stateOrderId,
    });
  }

  private async fetchSwapHistoryStatus({
    currentSwapTxHistory,
    isPrivateSendHistory,
    privateSendStatusSource,
  }: {
    currentSwapTxHistory: ISwapTxHistory;
    isPrivateSendHistory: boolean;
    privateSendStatusSource: IPrivateSendStatusSource;
  }): Promise<IFetchSwapHistoryStatusResult | undefined> {
    if (isPrivateSendHistory && privateSendStatusSource === 'orderDetail') {
      const orderDetail = await this.fetchSwapOrderDetail({
        txId: currentSwapTxHistory.txInfo.txId,
      });
      const orderDetailTxStatusRes =
        getPrivateSendOrderDetailTxState(orderDetail);
      return orderDetailTxStatusRes
        ? {
            orderDetail,
            txStatusRes: orderDetailTxStatusRes,
            shouldPreserveExistingExtraStatus: true,
          }
        : undefined;
    }
    const txStatusRes = await this.fetchSwapHistoryStateTx({
      currentSwapTxHistory,
      isPrivateSendHistory,
    });
    return { txStatusRes };
  }

  @backgroundMethod()
  async fetchPrivateSendInitialTxState(swapTxHistory: ISwapTxHistory) {
    if (!isPrivateSendSwapHistoryItem(swapTxHistory)) {
      return;
    }
    await this.fetchSwapHistoryStateTx({
      currentSwapTxHistory: swapTxHistory,
      isPrivateSendHistory: true,
    });
  }

  async swapHistoryStatusRunFetch(
    swapTxHistory: ISwapTxHistory,
    options?: {
      shouldScheduleNextFetch?: boolean;
      shouldShowToast?: boolean;
      privateSendStatusSource?: IPrivateSendStatusSource;
    },
  ) {
    let enableInterval = true;
    const shouldScheduleNextFetch = options?.shouldScheduleNextFetch ?? true;
    const shouldShowToast = options?.shouldShowToast ?? true;
    const privateSendStatusSource =
      options?.privateSendStatusSource ?? 'orderDetail';
    let currentSwapTxHistory = cloneDeep(swapTxHistory);
    const isPrivateSendHistory =
      currentSwapTxHistory.protocol === EProtocolOfExchange.PRIVATE_SEND ||
      currentSwapTxHistory.swapInfo.provider.provider === privateSendProvider;
    try {
      const fetchResult = await this.fetchSwapHistoryStatus({
        currentSwapTxHistory,
        isPrivateSendHistory,
        privateSendStatusSource,
      });
      const txStatusRes = fetchResult?.txStatusRes;
      if (!txStatusRes) {
        return;
      }
      const previousSwapTxHistory = currentSwapTxHistory;
      if (fetchResult?.orderDetail) {
        currentSwapTxHistory = mergePrivateSendOrderDetailToSwapHistory({
          item: currentSwapTxHistory,
          orderDetail: fetchResult.orderDetail,
        });
      }
      const shouldUpdateOrderDetailFields = !isEqual(
        previousSwapTxHistory,
        currentSwapTxHistory,
      );
      if (
        shouldUpdateOrderDetailFields ||
        shouldUpdateSwapHistoryAfterTxState({
          swapTxHistory: currentSwapTxHistory,
          txStatusRes,
        })
      ) {
        const rawStatus = txStatusRes.state;
        const previousStateDetail = previousSwapTxHistory.stateDetail;
        const shouldPreserveExistingExtraStatus =
          fetchResult?.shouldPreserveExistingExtraStatus &&
          !isSwapTxHistoryStatusTerminal(rawStatus);
        currentSwapTxHistory = {
          ...currentSwapTxHistory,
          status: rawStatus,
          extraStatus: shouldPreserveExistingExtraStatus
            ? (txStatusRes.extraStatus ?? currentSwapTxHistory.extraStatus)
            : txStatusRes.extraStatus,
          stateDetail:
            txStatusRes.stateDetail ?? currentSwapTxHistory.stateDetail,
          swapInfo: {
            ...currentSwapTxHistory.swapInfo,
            surplus:
              txStatusRes.surplus ?? currentSwapTxHistory.swapInfo.surplus,
            chainFlipExplorerUrl:
              txStatusRes.chainFlipExplorerUrl ??
              currentSwapTxHistory.swapInfo?.chainFlipExplorerUrl,
          },
          swapOrderHash:
            txStatusRes.swapOrderHash ?? currentSwapTxHistory.swapOrderHash,
          crossChainStatus:
            txStatusRes.crossChainStatus ??
            currentSwapTxHistory?.crossChainStatus,
          txInfo: {
            ...currentSwapTxHistory.txInfo,
            txId: txStatusRes.txId ?? currentSwapTxHistory.txInfo.txId,
            receiverTransactionId: txStatusRes.crossChainReceiveTxHash || '',
            gasFeeInNative: txStatusRes.gasFee
              ? txStatusRes.gasFee
              : currentSwapTxHistory.txInfo.gasFeeInNative,
            gasFeeFiatValue: txStatusRes.gasFeeFiatValue
              ? txStatusRes.gasFeeFiatValue
              : currentSwapTxHistory.txInfo.gasFeeFiatValue,
          },
          baseInfo: {
            ...currentSwapTxHistory.baseInfo,
            toAmount: txStatusRes.dealReceiveAmount
              ? txStatusRes.dealReceiveAmount
              : currentSwapTxHistory.baseInfo.toAmount,
          },
        };
        await this.updateSwapHistoryItem(currentSwapTxHistory, {
          shouldShowToast,
        });
        const finalStatus = currentSwapTxHistory.status;
        if (
          finalStatus === ESwapTxHistoryStatus.FAILED ||
          finalStatus === ESwapTxHistoryStatus.CANCELED
        ) {
          await this.clearLocalPendingTxForTerminalSwap(currentSwapTxHistory);
        }
        if (
          shouldEmitSwapHistoryBalanceUpdate({
            swapTxHistory: currentSwapTxHistory,
            txStatusRes,
            previousStateDetail,
          })
        ) {
          appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
            fromToken: currentSwapTxHistory.baseInfo.fromToken,
            toToken: currentSwapTxHistory.baseInfo.toToken,
            status: rawStatus,
            crossChainStatus: txStatusRes.crossChainStatus,
          });
          appEventBus.emit(EAppEventBusNames.SwapSpeedBalanceUpdate, {
            orderFromToken: currentSwapTxHistory.baseInfo.fromToken,
            orderToToken: currentSwapTxHistory.baseInfo.toToken,
          });
        }
        if (isSwapTxHistoryStatusTerminal(finalStatus)) {
          enableInterval = false;
          await this.cleanSwapHistoryStateIntervals(
            previousSwapTxHistory,
            currentSwapTxHistory,
          );
        }
      }
    } catch (e) {
      const error = e as { message?: string };
      console.error('Swap History Status Fetch Error', error?.message);
    } finally {
      const keyId = this.getSwapHistoryIntervalKey(currentSwapTxHistory);
      if (
        enableInterval &&
        shouldScheduleNextFetch &&
        this.historyCurrentStateIntervalIds.includes(keyId)
      ) {
        this.historyStateIntervalCountMap[keyId] =
          (this.historyStateIntervalCountMap[keyId] ?? 0) + 1;
        this.historyStateIntervals[keyId] = setTimeout(
          () => {
            void this.swapHistoryStatusRunFetch(currentSwapTxHistory);
          },
          swapHistoryStateFetchInterval *
            (Math.floor(
              (this.historyStateIntervalCountMap[keyId] ?? 0) /
                swapHistoryStateFetchRiceIntervalCount,
            ) +
              1),
        );
      }
    }
  }

  @backgroundMethod()
  async swapHistoryStatusFetchLoop() {
    const { swapHistoryPendingList } = await inAppNotificationAtom.get();
    const statusPendingList = filterSwapHistoryPendingList(
      swapHistoryPendingList,
    ).filter((item) => this.isSwapHistoryPendingStatus(item));
    const newHistoryStatePendingList = statusPendingList.filter(
      (item) =>
        !this.historyCurrentStateIntervalIds.includes(
          this.getSwapHistoryIntervalKey(item),
        ),
    );
    if (!newHistoryStatePendingList.length) return;
    await Promise.all(
      newHistoryStatePendingList.map(async (swapTxHistory) => {
        this.historyCurrentStateIntervalIds = [
          ...this.historyCurrentStateIntervalIds,
          this.getSwapHistoryIntervalKey(swapTxHistory),
        ];
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

  @backgroundMethod()
  async buildOkxSwapEncodedTx(params: {
    accountId: string;
    networkId: string;
    okxTx: IOKXTransactionObject;
    fromTokenInfo: ISwapTokenBase;
    type: ESwapTabSwitchType;
  }) {
    const vault = await vaultFactory.getVault({
      accountId: params.accountId,
      networkId: params.networkId,
    });
    return vault.buildOkxSwapEncodedTx({
      okxTx: params.okxTx,
      fromTokenInfo: params.fromTokenInfo,
      type: params.type,
    });
  }

  @backgroundMethod()
  async buildLMSwapEncodedTx(params: {
    accountId: string;
    networkId: string;
    lmTx: ILMTronObject;
  }) {
    const vault = await vaultFactory.getVault({
      accountId: params.accountId,
      networkId: params.networkId,
    });
    return vault.buildLiquidMeshSwapEncodedTx({
      lmTx: params.lmTx,
    });
  }

  async getCacheSwapSupportNetworks() {
    const now = Date.now();
    if (
      this._swapSupportNetworks.length &&
      now - this.swapSupportNetworksCacheTime < this.swapSupportNetworksTtl
    ) {
      return this._swapSupportNetworks;
    }
    const swapSupportNetworks = await this.fetchSwapNetworks();
    this._swapSupportNetworks = swapSupportNetworks;
    this.swapSupportNetworksCacheTime = now;
    return swapSupportNetworks;
  }

  // --- limit order ---

  async checkLimitOrderStatus(
    fetchResult: IFetchLimitOrderRes[],
    currentSwapLimitOrders: IFetchLimitOrderRes[],
  ) {
    const openOrders = currentSwapLimitOrders.filter(
      (order) =>
        order.status === ESwapLimitOrderStatus.OPEN ||
        order.status === ESwapLimitOrderStatus.PRESIGNATURE_PENDING,
    );
    openOrders.forEach((openOrder) => {
      const updatedOrder = fetchResult.find(
        (order) => order.orderId === openOrder.orderId,
      );
      const newStatus = updatedOrder?.status;
      if (
        updatedOrder &&
        newStatus !== ESwapLimitOrderStatus.OPEN &&
        newStatus !== ESwapLimitOrderStatus.PRESIGNATURE_PENDING
      ) {
        let toastTitle = '';
        let toastMessage = '';
        const method: 'success' | 'error' | 'message' = 'success';
        if (ESwapLimitOrderStatus.FULFILLED === newStatus) {
          appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
            fromToken: updatedOrder.fromTokenInfo,
            toToken: updatedOrder.toTokenInfo,
            status: ESwapTxHistoryStatus.SUCCESS,
          });
          const executedBuyAmountBN = new BigNumber(
            updatedOrder.executedBuyAmount ?? '0',
          ).shiftedBy(-(updatedOrder.toTokenInfo?.decimals ?? 0));
          const formattedExecutedBuyAmount = formatBalance(
            executedBuyAmountBN.toFixed(),
          );
          const executedSellAmountBN = new BigNumber(
            updatedOrder.executedSellAmount ?? '0',
          ).shiftedBy(-(updatedOrder.fromTokenInfo?.decimals ?? 0));
          const formattedExecutedSellAmount = formatBalance(
            executedSellAmountBN.toFixed(),
          );
          toastTitle = appLocale.intl.formatMessage({
            id: ETranslations.limit_toast_order_filled,
          });
          toastMessage = appLocale.intl.formatMessage(
            {
              id: ETranslations.limit_toast_order_content,
            },
            {
              num1: formattedExecutedSellAmount.formattedValue,
              num2: formattedExecutedBuyAmount.formattedValue,
              token1: updatedOrder.fromTokenInfo.symbol,
              token2: updatedOrder.toTokenInfo.symbol,
            },
          );
        }
        if (ESwapLimitOrderStatus.CANCELLED === newStatus) {
          toastTitle = appLocale.intl.formatMessage({
            id: ETranslations.limit_toast_order_cancelled,
          });
        }
        if (toastTitle || toastMessage) {
          void this.backgroundApi.serviceApp.showToast({
            method,
            title: toastTitle,
            message: toastMessage,
          });
        }
      }
    });
  }

  @backgroundMethod()
  async swapLimitOrdersFetchLoop(
    indexedAccountId?: string,
    otherWalletTypeAccountId?: string,
    isFetchNewOrder?: boolean,
    interval?: boolean,
  ) {
    if (this.limitOrderStateInterval) {
      clearTimeout(this.limitOrderStateInterval);
      this.limitOrderStateInterval = null;
    }
    if (
      interval &&
      this._limitOrderCurrentAccountId &&
      this._limitOrderCurrentAccountId !==
        `${indexedAccountId ?? ''}-${otherWalletTypeAccountId ?? ''}`
    ) {
      return;
    }
    if (
      !interval &&
      this._limitOrderCurrentAccountId !==
        `${indexedAccountId ?? ''}-${otherWalletTypeAccountId ?? ''}`
    ) {
      this._limitOrderCurrentAccountId = `${indexedAccountId ?? ''}-${
        otherWalletTypeAccountId ?? ''
      }`;
    }
    let sameAccount = true;
    const swapSupportNetworks = await this.getCacheSwapSupportNetworks();
    const swapLimitSupportNetworks = swapSupportNetworks.filter(
      (item) => item.supportLimit,
    );
    const { swapSupportAccounts } = await this.getSupportSwapAllAccounts({
      indexedAccountId,
      otherWalletTypeAccountId,
      swapSupportNetworks: swapLimitSupportNetworks,
    });
    if (swapSupportAccounts.length > 0) {
      const { swapLimitOrders } = await inAppNotificationAtom.get();
      if (
        swapLimitOrders.length &&
        swapLimitOrders.find(
          (item) =>
            !swapSupportAccounts.find(
              (account) =>
                equalsIgnoreCase(item.userAddress, account.apiAddress) &&
                item.networkId === account.networkId,
            ),
        )
      ) {
        sameAccount = false;
      }
      const openOrders = swapLimitOrders.filter(
        (or) => or.status === ESwapLimitOrderStatus.OPEN,
      );
      let res: IFetchLimitOrderRes[] = [];
      try {
        if (
          !swapLimitOrders.length ||
          isFetchNewOrder ||
          !sameAccount ||
          openOrders.length
        ) {
          const accounts = swapSupportAccounts.map((account) => ({
            userAddress: account.apiAddress,
            networkId: account.networkId,
          }));
          await inAppNotificationAtom.set((pre) => ({
            ...pre,
            swapLimitOrdersLoading: true,
          }));
          res = await this.fetchLimitOrders(accounts);
          await this.checkLimitOrderStatus(res, swapLimitOrders);
          await inAppNotificationAtom.set((pre) => {
            if (sameAccount) {
              let newList = [...pre.swapLimitOrders];
              res.forEach((item) => {
                const index = newList.findIndex(
                  (i) => i.orderId === item.orderId,
                );
                if (index !== -1) {
                  newList[index] = item;
                } else {
                  newList = [item, ...newList];
                }
              });
              return {
                ...pre,
                swapLimitOrders: [...newList],
                swapLimitOrdersLoading: false,
              };
            }
            return {
              ...pre,
              swapLimitOrdersLoading: false,
              swapLimitOrders: [...res],
            };
          });
          if (res.find((item) => item.status === ESwapLimitOrderStatus.OPEN)) {
            this.limitOrderStateInterval = setTimeout(() => {
              void this.swapLimitOrdersFetchLoop(
                indexedAccountId,
                otherWalletTypeAccountId,
                false,
                true,
              );
            }, ESwapLimitOrderUpdateInterval);
          }
        }
      } catch (_error) {
        this.limitOrderStateInterval = setTimeout(() => {
          void this.swapLimitOrdersFetchLoop(
            indexedAccountId,
            otherWalletTypeAccountId,
            false,
            true,
          );
        }, ESwapLimitOrderUpdateInterval);
      } finally {
        await inAppNotificationAtom.set((pre) => ({
          ...pre,
          swapLimitOrdersLoading: false,
        }));
      }
    }
  }

  @backgroundMethod()
  async fetchLimitOrders(
    accounts: {
      userAddress: string;
      networkId: string;
      orderIds?: string;
      limit?: number;
      offset?: number;
    }[],
  ) {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const res = await client.post<{
        data: IFetchLimitOrderRes[];
      }>(`/swap/v1/limit-orders`, {
        accounts,
      });
      return res.data.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  @backgroundMethod()
  async cancelLimitOrder(params: {
    orderIds: string[];
    signature: string;
    signingScheme: ESigningScheme;
    networkId: string;
    provider: string;
    userAddress: string;
  }) {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const resp = await client.post<{ success: boolean }>(
        `/swap/v1/cancel-limit-orders`,
        {
          networkId: params.networkId,
          orderIds: params.orderIds.join(','),
          userAddress: params.userAddress,
          provider: params.provider,
          signature: params.signature,
          signingScheme: params.signingScheme,
        },
      );
      return resp.data.success;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  @backgroundMethod()
  async fetchLimitMarketPrice(params: {
    fromToken: ISwapTokenBase;
    toToken: ISwapTokenBase;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const fromTokenFetchPromise = client.get<{ data: IMarketTokenDetailData }>(
      `/utility/v2/market/token/detail`,
      {
        params: {
          tokenAddress: params.fromToken.contractAddress,
          networkId: params.fromToken.networkId,
        },
      },
    );
    const toTokenFetchPromise = client.get<{ data: IMarketTokenDetailData }>(
      `/utility/v2/market/token/detail`,
      {
        params: {
          tokenAddress: params.toToken.contractAddress,
          networkId: params.toToken.networkId,
        },
      },
    );
    try {
      const [{ data: fromTokenRes }, { data: toTokenRes }] = await Promise.all([
        fromTokenFetchPromise,
        toTokenFetchPromise,
      ]);
      return {
        fromTokenPrice: fromTokenRes.data?.token?.price,
        toTokenPrice: toTokenRes.data?.token?.price,
      };
    } catch (error) {
      console.error(error);
      return {
        fromTokenPrice: '',
        toTokenPrice: '',
      };
    }
  }

  @backgroundMethod()
  async fetchSpeedSwapConfig(params: { networkId: string }) {
    const defaultConfig = {
      provider: '',
      speedConfig: {
        slippage: 0.5,
        spenderAddress: '',
        defaultTokens: [],
        defaultLimitTokens: [],
        swapMevNetConfig: mevSwapNetworks,
      },
      supportSpeedSwap: false,
      onlySupportCrossChain: false,
      onlySupportSingleChain: false,
      speedDefaultSelectToken: swapDefaultSetTokens['evm--1'].toToken,
    };
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const res = await client.get<{ data: ISpeedSwapConfig }>(
        `/swap/v1/speed-config`,
        {
          params: { networkId: params.networkId },
        },
      );
      return res?.data?.data || defaultConfig;
    } catch (error) {
      console.error(error);
      return defaultConfig;
    }
  }

  @backgroundMethod()
  async fetchCheckUSMarketStatus(): Promise<IFetchUSMarketStatusResult> {
    const unavailableStatus: IFetchUSMarketStatusResult = {
      open: false,
      session: 'CLOSED',
      reason: 'market-status-unavailable',
      unavailable: true,
    };
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const { data } = await client.get<
        IFetchResponse<IFetchUSMarketStatusResult>
      >('/swap/v1/check/us-market-status');
      return data?.data ?? unavailableStatus;
    } catch (error) {
      console.error(error);
      return unavailableStatus;
    }
  }

  @backgroundMethod()
  async fetchSpeedCheck(params: {
    fromNetworkId: string;
    toNetworkId: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    fromTokenAmount: string;
    protocol: string;
  }): Promise<IFetchSpeedCheckResult | null> {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const { data } = await client.get<IFetchResponse<IFetchSpeedCheckResult>>(
        '/swap/v1/check/speed',
        {
          params,
        },
      );
      return data?.data ?? null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  @backgroundMethod()
  async fetchSpeedSwapQuote({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    slippagePercentage,
    autoSlippage,
    blockNumber,
    accountId,
    expirationTime,
    receivingAddress,
    kind,
    protocol,
  }: IFetchSwapQuoteParams) {
    await this.cancelFetchSpeedSwapQuote();
    const walletDevice =
      await this.backgroundApi.serviceAccount.getAccountDeviceSafe({
        accountId: accountId ?? '',
      });
    const params: IFetchQuotesParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      protocol: getProtocolOfExchangeFromSwapTab(protocol),
      userAddress,
      slippagePercentage,
      autoSlippage,
      blockNumber,
      receivingAddress,
      expirationTime,
      kind,
      walletDeviceType: walletDevice?.deviceType,
    };
    this._speedSwapQuoteAbortController = new AbortController();
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const fetchUrl = '/swap/v1/quote/speed';
    try {
      const { data } = await client.get<IFetchResponse<IFetchQuoteResult[]>>(
        fetchUrl,
        {
          params,
          signal: this._speedSwapQuoteAbortController.signal,
          headers:
            await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              {
                accountId,
              },
            ),
        },
      );
      this._speedSwapQuoteAbortController = undefined;

      if (data?.code === 0 && data?.data?.length) {
        return data?.data;
      }
    } catch (e) {
      if (axios.isCancel(e)) {
        // eslint-disable-next-line no-restricted-syntax, onekey/no-raw-error -- needs standard Error cause semantics
        throw new Error('swap speed fetch quote cancel', {
          cause: ESwapFetchCancelCause.SWAP_SPEED_QUOTE_CANCEL,
        });
      }
    }
    return [
      {
        info: { provider: '', providerName: '' },
        fromTokenInfo: fromToken,
        toTokenInfo: toToken,
      },
    ];
  }

  @backgroundMethod()
  async fetchSpeedMarketQuote({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    receivingAddress,
    slippagePercentage,
    accountId,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
    userAddress: string;
    receivingAddress: string;
    slippagePercentage: number;
    accountId?: string;
  }): Promise<IFetchQuoteResult | undefined> {
    const client = await this.getClient(EServiceEndpointEnum.Swap);
    const params = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      userAddress,
      receivingAddress,
      slippagePercentage,
    };
    const headers =
      await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
        accountId,
      });
    try {
      const { data } = await client.get<IFetchResponse<IFetchQuoteResult[]>>(
        '/swap/v1/quote-market/speed',
        {
          params,
          headers,
        },
      );
      if (data?.code === 0 && data?.data?.length) {
        return data.data[0];
      }
      if (data?.code !== 0 && data?.message) {
        throw new OneKeyError(data.message);
      }
    } catch (e) {
      console.error('fetchSpeedMarketQuote error', e);
      throw e;
    }
    return undefined;
  }

  @backgroundMethod()
  @toastIfError()
  async fetchBuildSpeedSwapTx({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    provider,
    receivingAddress,
    slippagePercentage,
    accountId,
    protocol,
    kind,
    quoteResultCtx,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
    provider: string;
    userAddress: string;
    receivingAddress: string;
    slippagePercentage: number;
    accountId?: string;
    protocol: EProtocolOfExchange;
    kind: ESwapQuoteKind;
    walletType?: string;
    quoteResultCtx?: any;
  }): Promise<IFetchBuildTxResponse | undefined> {
    let headers = await getRequestHeaders();
    const walletType =
      await this.backgroundApi.serviceAccountProfile._getRequestWalletType({
        accountId,
      });
    headers = {
      ...headers,
      ...(accountId
        ? {
            'X-OneKey-Wallet-Type': walletType,
          }
        : {}),
    };
    const params: IFetchBuildTxParams = buildSpeedSwapTxParams({
      fromToken,
      toToken,
      fromTokenAmount,
      protocol,
      provider,
      userAddress,
      receivingAddress,
      slippagePercentage,
      kind,
      walletType,
      quoteResultCtx,
    });
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const { data } = await client.post<IFetchResponse<IFetchBuildTxResponse>>(
        '/swap/v1/build-tx/speed',
        params,
        {
          headers,
        },
      );
      return data?.data;
    } catch (e) {
      const error = e as {
        code?: number;
        message?: string;
        requestId?: string;
        response?: {
          status?: number;
          data?: unknown;
        };
      };
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: error?.message ?? 'Request failed',
        message: error?.requestId,
      });
      return undefined;
    }
  }

  @backgroundMethod()
  async fetchSwapTips() {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const { data } = await client.get<{ data: ISwapTips }>(
        '/utility/v1/swap-tips',
      );
      return data?.data;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  @backgroundMethod()
  async fetchSwapConfigs() {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const { data } = await client.get<{
        data: {
          swapMevNetConfig: string[];
        };
      }>('/swap/v1/swap-config');
      return data?.data;
    } catch (e) {
      console.error(e);
      return {
        swapMevNetConfig: null,
      };
    }
  }

  @backgroundMethod()
  async fetchPerpDepositQuote(params: {
    fromNetworkId: string;
    fromTokenAmount: string;
    fromTokenAddress: string;
    userAddress: string;
    receivingAddress: string;
    accountId?: string;
  }) {
    try {
      await this.cancelFetchPerpDepositQuote();
      const { accountId } = params;
      let headers = await getRequestHeaders();
      this._perpDepositQuoteController = new AbortController();
      const walletType =
        await this.backgroundApi.serviceAccountProfile._getRequestWalletType({
          accountId,
        });
      headers = {
        ...headers,
        ...(accountId
          ? {
              'X-OneKey-Wallet-Type': walletType,
            }
          : {}),
      };
      const fetchParams = {
        fromNetworkId: params.fromNetworkId,
        fromTokenAmount: params.fromTokenAmount,
        fromTokenAddress: params.fromTokenAddress,
        userAddress: params.userAddress,
        receivingAddress: params.receivingAddress,
      };
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const { data } = await client.post<{ data: IPerpDepositQuoteResponse }>(
        '/swap/v1/perp-deposit-quote',
        fetchParams,
        {
          headers,
          signal: this._perpDepositQuoteController.signal,
        },
      );
      return data?.data;
    } catch (e) {
      if (axios.isCancel(e)) {
        throw new OneKeyError({
          message: 'perp deposit quote cancel',
          autoToast: false,
          data: {
            cause: ESwapFetchCancelCause.SWAP_PERP_DEPOSIT_QUOTE_CANCEL,
          },
        });
      }
      throw e;
    }
  }

  @backgroundMethod()
  async fetchPerpDepositOrderStatus(params: {
    networkId: string;
    txId: string;
    isArbUSDCToken: boolean;
    toPerpDepositTokenAddress?: string;
    receivingAddress: string;
  }) {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);

      const { data } = await client.get<
        IFetchResponse<IFetchSwapTxHistoryStatusResponse>
      >('/swap/v1/perp-deposit-order-status', {
        params: {
          networkId: params.networkId,
          txId: params.txId,
          isArbUSDCToken: params.isArbUSDCToken,
          toPerpDepositTokenAddress: params.toPerpDepositTokenAddress,
          receivedAddress: params.receivingAddress,
        },
      });
      if (data?.data) {
        const perpDepositOrder = await perpsDepositOrderAtom.get();
        const findTxidOrder = perpDepositOrder.orders.find(
          (item) => item.fromTxId === params.txId,
        );
        if (findTxidOrder) {
          const filteredPerpDepositOrder = perpDepositOrder.orders.filter(
            (item) => item.fromTxId !== params.txId,
          );
          if (data?.data.state === ESwapTxHistoryStatus.SUCCESS) {
            findTxidOrder.status = ESwapTxHistoryStatus.SUCCESS;
            if (!params.isArbUSDCToken) {
              findTxidOrder.toTxId = data?.data.swapOrderHash?.toTxHash;
            }
            void this.backgroundApi.serviceApp.showToast({
              method: 'success',
              title: appLocale.intl.formatMessage({
                id: ETranslations.perp_deposit_success_title,
              }),
              message: appLocale.intl.formatMessage(
                {
                  id: ETranslations.perp_deposit_success_msg,
                },
                {
                  num: findTxidOrder.amount,
                  token: USDC_TOKEN_INFO.symbol,
                },
              ),
            });
            await perpsDepositOrderAtom.set((prev) => ({
              ...prev,
              orders: [...filteredPerpDepositOrder],
            }));
          } else if (
            data?.data.state === ESwapTxHistoryStatus.FAILED ||
            data?.data.state === ESwapTxHistoryStatus.CANCELED ||
            data?.data.state === ESwapTxHistoryStatus.CANCELING ||
            data?.data.state === ESwapTxHistoryStatus.PARTIALLY_FILLED
          ) {
            findTxidOrder.status = ESwapTxHistoryStatus.FAILED;
            void this.backgroundApi.serviceApp.showToast({
              method: 'error',
              title: appLocale.intl.formatMessage({
                id: ETranslations.perp_deposit_fail_title,
              }),
              message: appLocale.intl.formatMessage(
                {
                  id: ETranslations.perp_deposit_fail_msg,
                },
                {
                  num: findTxidOrder.amount,
                  token: USDC_TOKEN_INFO.symbol,
                },
              ),
            });
            await perpsDepositOrderAtom.set((prev) => ({
              ...prev,
              orders: [...filteredPerpDepositOrder],
            }));
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  @backgroundMethod()
  async perpDepositOrderFetchLoop(params: {
    accountId?: string | null;
    indexedAccountId?: string | null;
  }) {
    if (this.perpDepositOrderFetchLoopInterval) {
      clearTimeout(this.perpDepositOrderFetchLoopInterval);
      this.perpDepositOrderFetchLoopInterval = null;
    }
    const { accountId, indexedAccountId } = params;
    const perpDepositOrder = await perpsDepositOrderAtom.get();
    const filteredPerpDepositOrder = perpDepositOrder.orders.filter((item) => {
      return (
        ((!item.accountId && !accountId) || item.accountId === accountId) &&
        ((!item.indexedAccountId && !indexedAccountId) ||
          item.indexedAccountId === indexedAccountId) &&
        item.status === ESwapTxHistoryStatus.PENDING
      );
    });
    if (filteredPerpDepositOrder.length > 0) {
      const receivingAddressInfo =
        await this.backgroundApi.serviceAccount.getNetworkAccount({
          accountId: indexedAccountId ? undefined : (accountId ?? ''),
          indexedAccountId: indexedAccountId ?? '',
          networkId: PERPS_NETWORK_ID,
          deriveType: 'default',
        });
      await Promise.all(
        filteredPerpDepositOrder.map((item) => {
          return this.fetchPerpDepositOrderStatus({
            networkId: item.token.networkId,
            txId: item.fromTxId,
            isArbUSDCToken: item.isArbUSDCOrder,
            toPerpDepositTokenAddress: HYPERLIQUID_DEPOSIT_ADDRESS,
            receivingAddress: receivingAddressInfo.addressDetail.address,
          });
        }),
      );
      this.perpDepositOrderFetchLoopInterval = setTimeout(() => {
        void this.perpDepositOrderFetchLoop(params);
      }, this.perpDepositOrderFetchLoopIntervalTimeout);
    }
  }

  @backgroundMethod()
  async fetchPopularTrading(
    params: { limit?: number; saveToLocal?: boolean } | undefined,
  ) {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Swap);
      const { data } = await client.get<IFetchResponse<IPopularTrading[]>>(
        '/swap/v1/popular/tokens',
      );

      let result = data?.data ?? [];

      if (params?.limit) {
        result = result.slice(0, params.limit);
      }
      if (params?.saveToLocal) {
        void this.updateLocalPopularTrading(result);
      }
      return result;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  @backgroundMethod()
  async updateLocalPopularTrading(popularTrading: IPopularTrading[]) {
    await this.backgroundApi.simpleDb.swapConfigs.updatePopularTrading(
      popularTrading,
    );
  }

  @backgroundMethod()
  async getLocalPopularTrading() {
    return this.backgroundApi.simpleDb.swapConfigs.getPopularTrading();
  }
}
