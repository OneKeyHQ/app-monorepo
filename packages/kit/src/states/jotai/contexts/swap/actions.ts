import { useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import {
  isUSMarketStatusStockTokenSource,
  shouldCheckSwapWarningUSMarketClosed,
} from '@onekeyhq/kit/src/views/Swap/utils/usMarketStatusUtils';
import { moveNetworkToFirst } from '@onekeyhq/kit/src/views/Swap/utils/utils';
import { settingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEventSourceMessageEvent } from '@onekeyhq/shared/src/eventSource';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { buildSwapAllNetworkTokenListCacheKey } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  swapBridgeDefaultTokenConfigs,
  swapBridgeDefaultTokenExtraConfigs,
  swapDefaultSetTokens,
  swapRateDifferenceMax,
  swapRateDifferenceMin,
  swapTokenCatchMapMaxCount,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchTokensParams,
  ISwapAlertActionData,
  ISwapAlertState,
  ISwapLimitPriceInfo,
  ISwapNetwork,
  ISwapQuoteEvent,
  ISwapQuoteEventAutoSlippage,
  ISwapQuoteEventData,
  ISwapQuoteEventError,
  ISwapQuoteEventInfo,
  ISwapQuoteEventQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapAlertActionType,
  ESwapAlertLevel,
  ESwapDirectionType,
  ESwapFetchCancelCause,
  ESwapLimitOrderMarketPriceUpdateInterval,
  ESwapProTradeType,
  ESwapQuoteKind,
  ESwapRateDifferenceUnit,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  type ISwapQuoteEventErrorState,
  SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS,
  buildSwapProPositionsOwnerKey,
  contextAtomMethod,
  limitOrderMarketPriceAtom,
  rateDifferenceAtom,
  swapAlertsAtom,
  swapAllNetworkActionLockAtom,
  swapAllNetworkTokenListMapAtom,
  swapAutoSlippageSuggestedValueAtom,
  swapBuildTxFetchingAtom,
  swapFromTokenAmountAtom,
  swapLimitExpirationTimeAtom,
  swapLimitPartiallyFillAtom,
  swapLimitPriceUseRateAtom,
  swapManualSelectQuoteProvidersAtom,
  swapNetworks,
  swapNetworksIncludeAllNetworkAtom,
  swapProDirectionAtom,
  swapProInputAmountAtom,
  swapProPositionsCacheAtom,
  swapProSelectTokenAtom,
  swapProSellToTokenAtom,
  swapProSupportNetworksTokenListAtom,
  swapProSupportNetworksTokenListLoadingAtom,
  swapProTokenDetailWebsocketAtom,
  swapProTokenMarketDetailInfoAtom,
  swapProTokenMarketDetailInfoLoadingAtom,
  swapProTradeTypeAtom,
  swapProUseSelectBuyTokenAtom,
  swapQuoteActionLockAtom,
  swapQuoteCurrentEventProviderKeysAtom,
  swapQuoteCurrentEventReceivedCountAtom,
  swapQuoteCurrentSelectAtom,
  swapQuoteEventCompletedAtom,
  swapQuoteEventErrorAtom,
  swapQuoteEventTotalCountAtom,
  swapQuoteFetchingAtom,
  swapQuoteIntervalCountAtom,
  swapQuoteListAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectTokenDetailFetchingAtom,
  swapSelectedFromTokenBalanceAtom,
  swapSelectedToTokenBalanceAtom,
  swapShouldRefreshQuoteAtom,
  swapSilenceQuoteLoading,
  swapSpeedQuoteFetchingAtom,
  swapSpeedQuoteResultAtom,
  swapToTokenAmountAtom,
  swapTokenFetchingAtom,
  swapTokenMapAtom,
  swapTokenMetadataAtom,
  swapTypeSwitchAtom,
} from './atoms';
import {
  SWAP_INCOGNITO_QUOTE_PROVIDER_COUNT_CAP,
  buildSwapQuoteProviderKey,
  getSwapQuoteEventProgressTotalCount,
  getSwapQuoteProgressState,
  hasSwapZeroProviderQuoteEvent,
  isSwapQuoteEventFetching,
} from './quoteProgress';

function getSelectedPairLimitPriceRate({
  protocol,
  limitPriceUseRate,
  fromToken,
  toToken,
}: {
  protocol: ESwapTabSwitchType;
  limitPriceUseRate: ISwapLimitPriceInfo;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  if (protocol !== ESwapTabSwitchType.LIMIT || !limitPriceUseRate.rate) {
    return undefined;
  }

  const isSelectedPair =
    equalTokenNoCaseSensitive({
      token1: limitPriceUseRate.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: limitPriceUseRate.toToken,
      token2: toToken,
    });

  return isSelectedPair ? limitPriceUseRate.rate : undefined;
}

function isQuoteResultSelectedTokenPair({
  quoteResult,
  fromToken,
  toToken,
}: {
  quoteResult?: IFetchQuoteResult;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  return Boolean(
    quoteResult &&
    fromToken &&
    toToken &&
    equalTokenNoCaseSensitive({
      token1: quoteResult.fromTokenInfo,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: quoteResult.toTokenInfo,
      token2: toToken,
    }),
  );
}

function isQuoteEventErrorSelectedTokenPair({
  quoteEventError,
  fromToken,
  toToken,
}: {
  quoteEventError?: ISwapQuoteEventErrorState;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  return Boolean(
    quoteEventError &&
    fromToken &&
    toToken &&
    equalTokenNoCaseSensitive({
      token1: quoteEventError.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: quoteEventError.toToken,
      token2: toToken,
    }),
  );
}

class ContentJotaiActionsSwap extends ContextJotaiActionsBase {
  private quoteInterval: ReturnType<typeof setTimeout> | undefined;

  private stockTokenCheckCache = new Map<string, Promise<boolean>>();

  private usMarketStatusCache:
    | {
        expiresAt: number;
        promise: ReturnType<
          typeof backgroundApiProxy.serviceSwap.fetchCheckUSMarketStatus
        >;
      }
    | undefined;

  private limitOrderMarketPriceInterval:
    | ReturnType<typeof setTimeout>
    | undefined;

  private limitOrderMarketPriceRequestId = 0;

  /**
   * Execute promises in batches with concurrency control to prevent overwhelming the system
   * This fixes iOS app hangs when fetching token lists for multiple networks simultaneously
   * @param tasks - Array of promise-returning functions to execute
   * @param concurrency - Maximum number of concurrent promises (default: 3)
   * @returns Array of settled results
   */
  private async executeBatched<T>(
    tasks: Array<() => Promise<T>>,
    concurrency = 3,
  ): Promise<Array<PromiseSettledResult<T>>> {
    const results: Array<PromiseSettledResult<T>> = [];

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((task) => task()),
      );
      results.push(...batchResults);
    }

    return results;
  }

  // Set swap pro select token with persistence
  // If token is provided: set to atom and save to db
  // If token is not provided: load from db, if db is empty, use defaultToken
  setSwapProSelectToken = contextAtomMethod(
    async (get, set, token?: ISwapToken, defaultToken?: ISwapToken) => {
      // Remove realtime properties before saving to db
      const getTokenForStorage = (t: ISwapToken): ISwapToken => {
        const {
          balanceParsed,
          price,
          fiatValue,
          reservationValue,
          accountAddress,
          ...rest
        } = t;
        return rest;
      };

      if (token) {
        set(swapProSelectTokenAtom(), token);
        await backgroundApiProxy.simpleDb.swapProSelectToken.setSwapProSelectToken(
          getTokenForStorage(token),
        );
      } else {
        const savedToken =
          await backgroundApiProxy.simpleDb.swapProSelectToken.getSwapProSelectToken();
        if (savedToken) {
          set(swapProSelectTokenAtom(), savedToken);
        } else if (defaultToken) {
          set(swapProSelectTokenAtom(), defaultToken);
          await backgroundApiProxy.simpleDb.swapProSelectToken.setSwapProSelectToken(
            getTokenForStorage(defaultToken),
          );
        }
      }
    },
  );

  syncNetworksSort = contextAtomMethod(async (get, set, netWorkId: string) => {
    if (!netWorkId) return;
    const networks = get(swapNetworks());
    const sortNetworks = moveNetworkToFirst(networks, netWorkId);
    set(swapNetworks(), sortNetworks);
    await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
      data: sortNetworks,
    });
  });

  cleanManualSelectQuoteProviders = contextAtomMethod((get, set) => {
    set(swapManualSelectQuoteProvidersAtom(), undefined);
  });

  reconcileManualSelectQuoteProviders = contextAtomMethod((get, set) => {
    const selectionIntent = get(swapManualSelectQuoteProvidersAtom());
    if (selectionIntent?.type !== 'manual-provider') {
      return;
    }

    const currentEventProviderKeys = get(
      swapQuoteCurrentEventProviderKeysAtom(),
    );
    const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
    if (
      quoteEventTotalCount.count === 0 ||
      !currentEventProviderKeys.includes(
        buildSwapQuoteProviderKey(selectionIntent),
      )
    ) {
      set(swapManualSelectQuoteProvidersAtom(), undefined);
    }
  });

  catchSwapTokensMap = contextAtomMethod(
    async (get, set, key: string, tokens: ISwapToken[]) => {
      const swapTokenMap = get(swapTokenMapAtom());
      const swapNetworksList = get(swapNetworks());
      const catchTokens = swapTokenMap.tokenCatch?.[key];
      const dateNow = Date.now();
      let catchCount = 0;
      const newTokens = tokens.map((token) => {
        const network = swapNetworksList.find(
          (n) => n.networkId === token.networkId,
        );
        if (network) {
          token.networkLogoURI = network.logoURI;
        }
        return token;
      });
      if (swapTokenMap.tokenCatch && catchTokens?.data) {
        // have catch
        if (JSON.stringify(catchTokens.data) !== JSON.stringify(newTokens)) {
          // catch data not equal
          const newTokenCatch = { ...swapTokenMap.tokenCatch };
          newTokenCatch[key] = {
            data: newTokens,
            updatedAt: dateNow,
          };
          swapTokenMap.tokenCatch = { ...newTokenCatch };
        }
        catchCount = Object.keys(swapTokenMap.tokenCatch).length;
      } else {
        // no catch
        swapTokenMap.tokenCatch = {
          ...swapTokenMap.tokenCatch,
          [key]: { data: newTokens, updatedAt: dateNow },
        };
        catchCount = Object.keys(swapTokenMap.tokenCatch).length;
      }
      if (swapTokenMap.tokenCatch && catchCount > swapTokenCatchMapMaxCount) {
        // clean old catch
        const oldUpdatedAtKey = Object.entries(swapTokenMap.tokenCatch).reduce(
          (min, [mapKey, obj]) =>
            obj.updatedAt < (swapTokenMap.tokenCatch?.[min]?.updatedAt ?? 0)
              ? mapKey
              : min,
          Object.keys(swapTokenMap.tokenCatch)[0],
        );
        if (oldUpdatedAtKey) {
          delete swapTokenMap.tokenCatch[oldUpdatedAtKey];
        }
      }
      set(swapTokenMapAtom(), { ...swapTokenMap, updatedAt: dateNow });
    },
  );

  needChangeToken = ({
    token,
    toToken,
    swapTypeSwitchValue,
  }: {
    token: ISwapToken;
    swapTypeSwitchValue: ESwapTabSwitchType;
    toToken?: ISwapToken;
  }) => {
    if (
      token.networkId !== toToken?.networkId &&
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT
    ) {
      const defaultTokenSet = swapDefaultSetTokens[token.networkId];
      if (defaultTokenSet?.limitToToken && defaultTokenSet?.limitFromToken) {
        if (
          equalTokenNoCaseSensitive({
            token1: defaultTokenSet?.limitToToken,
            token2: token,
          }) &&
          !equalTokenNoCaseSensitive({
            token1: defaultTokenSet?.limitFromToken,
            token2: token,
          })
        ) {
          return defaultTokenSet?.limitFromToken;
        }
        return defaultTokenSet?.limitToToken;
      }
      return undefined;
    }
    if (
      token.networkId !== toToken?.networkId &&
      swapTypeSwitchValue === ESwapTabSwitchType.SWAP
    ) {
      const defaultTokenSet = swapDefaultSetTokens[token.networkId];
      if (
        token.isNative &&
        defaultTokenSet?.toToken &&
        !defaultTokenSet?.toToken?.isNative
      ) {
        return defaultTokenSet?.toToken;
      }
      if (
        !token.isNative &&
        defaultTokenSet?.fromToken &&
        defaultTokenSet?.fromToken?.isNative
      ) {
        return defaultTokenSet?.fromToken;
      }
    }
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.BRIDGE &&
      (token.networkId === toToken?.networkId || !toToken)
    ) {
      let needChangeToToken: ISwapToken | null = null;
      swapBridgeDefaultTokenConfigs.some((config) => {
        const findToken = config.fromTokens.find((t) =>
          equalTokenNoCaseSensitive({
            token1: {
              networkId: t.networkId,
              contractAddress: t.contractAddress,
            },
            token2: {
              networkId: token.networkId,
              contractAddress: token.contractAddress,
            },
          }),
        );
        if (findToken) {
          needChangeToToken = config.toTokenDefaultMatch;
        }
        return !!findToken;
      });
      if (!needChangeToToken) {
        needChangeToToken =
          token.networkId ===
          swapBridgeDefaultTokenExtraConfigs.mainNetDefaultToTokenConfig
            .networkId
            ? swapBridgeDefaultTokenExtraConfigs.mainNetDefaultToTokenConfig
                .defaultToToken
            : swapBridgeDefaultTokenExtraConfigs.defaultToToken;
      }
      return needChangeToToken;
    }

    return null;
  };

  resetSwapTokenData = contextAtomMethod(async (get, set, type) => {
    if (type === ESwapDirectionType.FROM) {
      set(swapSelectFromTokenAtom(), undefined);
      set(swapSelectedFromTokenBalanceAtom(), '');
    } else {
      set(swapSelectToTokenAtom(), undefined);
      set(swapSelectedToTokenBalanceAtom(), '');
    }
    set(swapQuoteListAtom(), []);
    set(rateDifferenceAtom(), undefined);
  });

  selectFromToken = contextAtomMethod(
    async (
      get,
      set,
      token: ISwapToken,
      disableCheckToToken?: boolean,
      skipCleanManualSelectQuoteProviders?: boolean,
      skipCheckEqualToken?: boolean,
    ) => {
      const toToken = get(swapSelectToTokenAtom());
      if (
        !skipCheckEqualToken &&
        equalTokenNoCaseSensitive({
          token1: toToken,
          token2: token,
        })
      ) {
        return;
      }
      const swapTypeSwitchValue = get(swapTypeSwitchAtom());
      if (!skipCleanManualSelectQuoteProviders) {
        this.cleanManualSelectQuoteProviders.call(set);
      }
      await this.syncNetworksSort.call(set, token.networkId);
      const needChangeToToken = this.needChangeToken({
        token,
        swapTypeSwitchValue,
        toToken,
      });
      if (needChangeToToken !== null && !disableCheckToToken) {
        set(swapSelectToTokenAtom(), undefined);
        set(swapSelectFromTokenAtom(), token);
        set(swapSelectToTokenAtom(), needChangeToToken);
      } else {
        if (
          toToken?.networkId !== token.networkId &&
          swapTypeSwitchValue === ESwapTabSwitchType.SWAP
        ) {
          void this.resetSwapTokenData.call(set, ESwapDirectionType.TO);
        }
        set(swapSelectFromTokenAtom(), token);
      }
    },
  );

  selectToToken = contextAtomMethod(
    async (
      get,
      set,
      token: ISwapToken,
      skipCleanManualSelectQuoteProviders?: boolean,
      skipCheckEqualToken?: boolean,
    ) => {
      if (!skipCleanManualSelectQuoteProviders) {
        this.cleanManualSelectQuoteProviders.call(set);
      }
      const fromToken = get(swapSelectFromTokenAtom());
      if (
        !skipCheckEqualToken &&
        equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: token,
        })
      ) {
        return;
      }
      await this.syncNetworksSort.call(set, token.networkId);
      set(swapSelectToTokenAtom(), token);
    },
  );

  alternationToken = contextAtomMethod((get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    if (!fromToken && !toToken) {
      return;
    }
    set(swapSelectFromTokenAtom(), toToken);
    set(swapSelectToTokenAtom(), fromToken);
    this.cleanManualSelectQuoteProviders.call(set);
  });

  tokenListFetchAction = contextAtomMethod(
    async (get, set, params: IFetchTokensParams) => {
      try {
        if (!params.networkId) return;
        set(swapTokenFetchingAtom(), true);
        const protocol = get(swapTypeSwitchAtom());
        const result = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
          ...params,
          protocol,
        });
        if (result.length > 0) {
          await this.catchSwapTokensMap.call(
            set,
            JSON.stringify(params),
            result,
          );
        }
        set(swapTokenFetchingAtom(), false);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e?.cause !== ESwapFetchCancelCause.SWAP_TOKENS_CANCEL) {
          set(swapTokenFetchingAtom(), false);
        }
      }
    },
  );

  runQuote = contextAtomMethod(
    async (
      get,
      set,
      fromToken: ISwapToken,
      toToken: ISwapToken,
      slippagePercentage: number,
      autoSlippage?: boolean,
      address?: string,
      accountId?: string,
      loadingDelayEnable?: boolean,
      blockNumber?: number,
      kind?: ESwapQuoteKind,
      fromTokenAmount?: string,
      toTokenAmount?: string,
      receivingAddress?: string,
      incognito?: boolean,
    ) => {
      const shouldRefreshQuote = get(swapShouldRefreshQuoteAtom());
      if (shouldRefreshQuote) {
        this.cleanQuoteInterval();
        set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
        return;
      }
      await backgroundApiProxy.serviceSwap.closeApproving();
      set(swapQuoteEventErrorAtom(), undefined);
      try {
        if (!loadingDelayEnable) {
          set(swapQuoteFetchingAtom(), true);
        }
        const protocol = get(swapTypeSwitchAtom());
        const { swapIncognitoMode } = await settingsAtom.get();
        const incognitoEnabled =
          protocol === ESwapTabSwitchType.LIMIT
            ? false
            : (incognito ?? swapIncognitoMode);
        const limitPartiallyFillableObj = get(swapLimitPartiallyFillAtom());
        const limitPartiallyFillable = limitPartiallyFillableObj.value;
        const expirationTime = get(swapLimitExpirationTimeAtom());
        const limitUserMarketPrice = get(swapLimitPriceUseRateAtom());
        const userMarketPriceRate = getSelectedPairLimitPriceRate({
          protocol,
          limitPriceUseRate: limitUserMarketPrice,
          fromToken,
          toToken,
        });
        const res = await backgroundApiProxy.serviceSwap.fetchQuotes({
          fromToken,
          toToken,
          fromTokenAmount,
          toTokenAmount,
          kind,
          userAddress: address,
          slippagePercentage,
          autoSlippage,
          blockNumber,
          receivingAddress,
          incognito: incognitoEnabled,
          accountId,
          protocol,
          userMarketPriceRate,
          ...(protocol === ESwapTabSwitchType.LIMIT
            ? {
                expirationTime: Number(expirationTime.value),
                limitPartiallyFillable,
              }
            : {}),
        });
        const currentEventProviderKeys = res.map((quote) =>
          buildSwapQuoteProviderKey(quote),
        );
        if (!loadingDelayEnable) {
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteListAtom(), res);
          set(
            swapQuoteCurrentEventProviderKeysAtom(),
            currentEventProviderKeys,
          );
          set(swapQuoteCurrentEventReceivedCountAtom(), res.length);
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteEventTotalCountAtom(), {
            count: res.length,
          });
        } else {
          set(swapSilenceQuoteLoading(), true);
          setTimeout(() => {
            set(swapSilenceQuoteLoading(), false);
            set(swapQuoteListAtom(), res);
            set(
              swapQuoteCurrentEventProviderKeysAtom(),
              currentEventProviderKeys,
            );
            set(swapQuoteCurrentEventReceivedCountAtom(), res.length);
            set(swapQuoteEventCompletedAtom(), true);
            set(swapQuoteEventTotalCountAtom(), {
              count: res.length,
            });
          }, 800);
        }
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e?.cause !== ESwapFetchCancelCause.SWAP_QUOTE_CANCEL) {
          set(swapQuoteFetchingAtom(), false);
        }
      } finally {
        set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
      }
    },
  );

  quoteEventHandler = contextAtomMethod(
    (
      get,
      set,
      event: {
        event: ISwapQuoteEvent;
        type: 'done' | 'close' | 'error' | 'message' | 'open';
        params: IFetchQuotesParams;
        tokenPairs: { fromToken: ISwapToken; toToken: ISwapToken };
        accountId?: string;
      },
    ) => {
      switch (event.type) {
        case 'open': {
          break;
        }
        case 'message': {
          const { data } = event.event as IEventSourceMessageEvent;
          if (data) {
            const dataJson = JSON.parse(data) as ISwapQuoteEventData;
            const errorData = dataJson as ISwapQuoteEventError;
            if (errorData?.errorMessage) {
              const errorAlert: ISwapAlertState = {
                message: errorData.errorMessage,
                alertLevel: ESwapAlertLevel.ERROR,
              };
              set(swapQuoteListAtom(), []);
              set(swapQuoteCurrentEventProviderKeysAtom(), []);
              set(swapQuoteCurrentEventReceivedCountAtom(), 0);
              set(swapQuoteEventCompletedAtom(), true);
              set(swapQuoteEventTotalCountAtom(), {
                eventId: errorData.eventId,
                count: 0,
              });
              set(swapQuoteFetchingAtom(), false);
              set(swapQuoteEventErrorAtom(), {
                message: errorData.errorMessage,
                fromToken: event.tokenPairs.fromToken,
                toToken: event.tokenPairs.toToken,
              });
              set(swapAlertsAtom(), {
                states: [errorAlert],
                quoteId: '',
              });
              this.reconcileManualSelectQuoteProviders.call(set);
              set(swapQuoteActionLockAtom(), (v) => ({
                ...v,
                actionLock: false,
              }));
              this.closeQuoteEvent();
              break;
            }
            const autoSlippageData = dataJson as ISwapQuoteEventAutoSlippage;
            if (autoSlippageData?.autoSuggestedSlippage) {
              const {
                autoSuggestedSlippage,
                eventId,
                fromNetworkId,
                fromTokenAddress,
                toNetworkId,
                toTokenAddress,
              } = autoSlippageData;
              const quoteResult = get(swapQuoteListAtom());
              const quoteUpdateSlippage = quoteResult.map((quotRes) => {
                if (
                  equalTokenNoCaseSensitive({
                    token1: quotRes.fromTokenInfo,
                    token2: {
                      networkId: fromNetworkId,
                      contractAddress: fromTokenAddress,
                    },
                  }) &&
                  equalTokenNoCaseSensitive({
                    token1: quotRes.toTokenInfo,
                    token2: {
                      networkId: toNetworkId,
                      contractAddress: toTokenAddress,
                    },
                  }) &&
                  quotRes.eventId === eventId &&
                  !quotRes.autoSuggestedSlippage
                ) {
                  return {
                    ...quotRes,
                    autoSuggestedSlippage,
                  };
                }
                return quotRes;
              });
              set(swapQuoteListAtom(), [...quoteUpdateSlippage]);
              set(swapAutoSlippageSuggestedValueAtom(), {
                value: autoSuggestedSlippage,
                from: `${fromNetworkId}-${fromTokenAddress}`,
                to: `${toNetworkId}-${toTokenAddress}`,
                eventId,
              });
            } else if (
              (dataJson as ISwapQuoteEventInfo).totalQuoteCount ||
              (dataJson as ISwapQuoteEventInfo).totalQuoteCount === 0
            ) {
              const { totalQuoteCount, eventId } =
                dataJson as ISwapQuoteEventInfo;
              const quoteEventError = get(swapQuoteEventErrorAtom());
              set(swapQuoteCurrentEventProviderKeysAtom(), []);
              set(swapQuoteCurrentEventReceivedCountAtom(), 0);
              set(swapQuoteEventTotalCountAtom(), {
                eventId,
                count: totalQuoteCount,
              });
              const isZeroProviderQuoteEvent = hasSwapZeroProviderQuoteEvent({
                quoteEventTotalCount: {
                  eventId,
                  count: totalQuoteCount,
                },
              });
              if (totalQuoteCount === 0) {
                set(swapQuoteListAtom(), []);
              }
              if (quoteEventError || isZeroProviderQuoteEvent) {
                this.reconcileManualSelectQuoteProviders.call(set);
                set(swapQuoteEventCompletedAtom(), true);
                set(swapQuoteFetchingAtom(), false);
                set(swapQuoteActionLockAtom(), (v) => ({
                  ...v,
                  actionLock: false,
                }));
                this.closeQuoteEvent();
                break;
              }
              set(swapQuoteEventCompletedAtom(), false);
            } else {
              const quoteResultData = dataJson as ISwapQuoteEventQuoteResult;
              const swapAutoSlippageSuggestedValue = get(
                swapAutoSlippageSuggestedValueAtom(),
              );
              const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
              if (
                quoteResultData.data?.length &&
                quoteEventTotalCount.eventId === quoteResultData.data[0].eventId
              ) {
                const quoteResultsUpdateSlippage = quoteResultData.data.map(
                  (quote) => {
                    if (
                      `${quote.fromTokenInfo.networkId}-${quote.fromTokenInfo.contractAddress}` ===
                        swapAutoSlippageSuggestedValue?.from &&
                      `${quote.toTokenInfo.networkId}-${quote.toTokenInfo.contractAddress}` ===
                        swapAutoSlippageSuggestedValue?.to &&
                      quote.eventId ===
                        swapAutoSlippageSuggestedValue?.eventId &&
                      swapAutoSlippageSuggestedValue.value &&
                      !quote.autoSuggestedSlippage
                    ) {
                      return {
                        ...quote,
                        autoSuggestedSlippage:
                          swapAutoSlippageSuggestedValue.value,
                      };
                    }
                    return quote;
                  },
                );
                const currentQuoteList = get(swapQuoteListAtom());
                let newQuoteList = currentQuoteList.map((oldQuoteRes) => {
                  const newUpdateQuoteRes = quoteResultsUpdateSlippage.find(
                    (quote) =>
                      quote.info.provider === oldQuoteRes.info.provider &&
                      quote.info.providerName === oldQuoteRes.info.providerName,
                  );
                  if (newUpdateQuoteRes) {
                    return newUpdateQuoteRes;
                  }
                  // OK-49700: 如果旧报价的 fromAmount 与当前询价的 fromTokenAmount 相同，
                  // 则更新旧报价的 eventId 为当前的 eventId，这样它就不会被 eventId 过滤掉，
                  // 实现再次询价时保留旧报价、只更新部分渠道商报价的效果
                  if (
                    oldQuoteRes.fromAmount === event.params.fromTokenAmount &&
                    quoteEventTotalCount.eventId
                  ) {
                    return {
                      ...oldQuoteRes,
                      eventId: quoteEventTotalCount.eventId,
                    };
                  }
                  return oldQuoteRes;
                });
                const newAddQuoteRes = quoteResultsUpdateSlippage.filter(
                  (quote) =>
                    !currentQuoteList.find(
                      (oldQuoteRes) =>
                        quote.info.provider === oldQuoteRes.info.provider &&
                        quote.info.providerName ===
                          oldQuoteRes.info.providerName,
                    ),
                );
                newQuoteList = [...newQuoteList, ...newAddQuoteRes]
                  .filter((quote) => !!quote.info.provider)
                  ?.filter(
                    (q) =>
                      equalTokenNoCaseSensitive({
                        token1: q.fromTokenInfo,
                        token2: event.tokenPairs.fromToken,
                      }) &&
                      equalTokenNoCaseSensitive({
                        token1: q.toTokenInfo,
                        token2: event.tokenPairs.toToken,
                      }) &&
                      q.protocol === event.params.protocol,
                  )
                  ?.filter(
                    (q) =>
                      quoteEventTotalCount.eventId &&
                      q.eventId &&
                      quoteEventTotalCount.eventId === q.eventId,
                  );
                set(swapQuoteListAtom(), [...newQuoteList]);
                set(swapQuoteCurrentEventProviderKeysAtom(), (keys) => [
                  ...new Set([
                    ...keys,
                    ...quoteResultData.data.map((quote) =>
                      buildSwapQuoteProviderKey(quote),
                    ),
                  ]),
                ]);
                set(swapQuoteCurrentEventReceivedCountAtom(), (count) =>
                  Math.min(
                    quoteEventTotalCount.count,
                    count + quoteResultData.data.length,
                  ),
                );
              }
              set(swapQuoteFetchingAtom(), false);
            }
          }
          break;
        }
        case 'done': {
          this.reconcileManualSelectQuoteProviders.call(set);
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          if (platformEnv.isExtension) {
            set(swapQuoteFetchingAtom(), false);
          }
          this.closeQuoteEvent();
          break;
        }
        case 'error': {
          this.reconcileManualSelectQuoteProviders.call(set);
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          this.closeQuoteEvent();
          break;
        }
        case 'close': {
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          break;
        }
        default:
      }
    },
  );

  runQuoteEvent = contextAtomMethod(
    async (
      get,
      set,
      fromToken: ISwapToken,
      toToken: ISwapToken,
      slippagePercentage: number,
      autoSlippage?: boolean,
      address?: string,
      accountId?: string,
      blockNumber?: number,
      kind?: ESwapQuoteKind,
      fromTokenAmount?: string,
      toTokenAmount?: string,
      receivingAddress?: string,
      incognito?: boolean,
    ) => {
      const shouldRefreshQuote = get(swapShouldRefreshQuoteAtom());
      const protocol = get(swapTypeSwitchAtom());
      const { swapIncognitoMode } = await settingsAtom.get();
      const incognitoEnabled =
        protocol === ESwapTabSwitchType.LIMIT
          ? false
          : (incognito ?? swapIncognitoMode);
      const limitPartiallyFillableObj = get(swapLimitPartiallyFillAtom());
      const limitPartiallyFillable = limitPartiallyFillableObj.value;
      const expirationTime = get(swapLimitExpirationTimeAtom());
      if (shouldRefreshQuote) {
        this.cleanQuoteInterval();
        set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
        return;
      }
      await backgroundApiProxy.serviceSwap.closeApproving();
      set(swapQuoteEventErrorAtom(), undefined);
      set(swapQuoteFetchingAtom(), true);
      set(swapQuoteEventCompletedAtom(), false);
      const limitUserMarketPrice = get(swapLimitPriceUseRateAtom());
      const userMarketPriceRate = getSelectedPairLimitPriceRate({
        protocol,
        limitPriceUseRate: limitUserMarketPrice,
        fromToken,
        toToken,
      });
      await backgroundApiProxy.serviceSwap.fetchQuotesEvents({
        fromToken,
        toToken,
        fromTokenAmount,
        userAddress: address,
        slippagePercentage,
        autoSlippage,
        blockNumber,
        accountId,
        kind,
        toTokenAmount,
        protocol,
        receivingAddress,
        incognito: incognitoEnabled,
        userMarketPriceRate,
        ...(protocol === ESwapTabSwitchType.LIMIT
          ? {
              expirationTime: Number(expirationTime.value),
              limitPartiallyFillable,
            }
          : {}),
      });
    },
  );

  resetQuoteAction = contextAtomMethod(async (get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    const fromTokenAmount = get(swapFromTokenAmountAtom());
    const toTokenAmount = get(swapToTokenAmountAtom());
    set(swapQuoteFetchingAtom(), false);
    set(swapQuoteEventErrorAtom(), undefined);
    set(swapQuoteCurrentEventProviderKeysAtom(), []);
    set(swapQuoteCurrentEventReceivedCountAtom(), 0);
    set(swapQuoteEventCompletedAtom(), false);
    set(swapQuoteEventTotalCountAtom(), {
      count: 0,
    });
    set(swapQuoteListAtom(), []);
    set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
    if (!fromToken) {
      set(swapFromTokenAmountAtom(), { value: '', isInput: false });
    }
    if (!toToken) {
      set(swapToTokenAmountAtom(), { value: '', isInput: false });
    }
    if (!fromTokenAmount.value && fromTokenAmount.isInput) {
      set(swapToTokenAmountAtom(), { value: '', isInput: false });
    } else if (!toTokenAmount.value && toTokenAmount.isInput) {
      set(swapFromTokenAmountAtom(), { value: '', isInput: false });
    }
  });

  quoteAction = contextAtomMethod(
    async (
      get,
      set,
      slippageItem: { key: ESwapSlippageSegmentKey; value: number },
      address?: string,
      accountId?: string,
      blockNumber?: number,
      unResetCount?: boolean,
      kind?: ESwapQuoteKind,
      reQuote?: boolean,
      receivingAddress?: string,
      incognito?: boolean,
    ) => {
      let fromToken = get(swapSelectFromTokenAtom());
      let toToken = get(swapSelectToTokenAtom());
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      const swapTabSwitchType = get(swapTypeSwitchAtom());
      const toTokenAmount = get(swapToTokenAmountAtom());
      const swapProTradeType = get(swapProTradeTypeAtom());
      const swapProDirection = get(swapProDirectionAtom());
      set(swapQuoteEventErrorAtom(), undefined);
      if (
        swapTabSwitchType === ESwapTabSwitchType.LIMIT &&
        swapProTradeType === ESwapProTradeType.MARKET &&
        platformEnv.isNative
      ) {
        void this.resetQuoteAction.call(set);
        return;
      }
      if (
        swapProTradeType === ESwapProTradeType.LIMIT &&
        swapTabSwitchType === ESwapTabSwitchType.LIMIT
      ) {
        if (swapProDirection === ESwapDirection.BUY) {
          fromToken = get(swapProUseSelectBuyTokenAtom());
          toToken = get(swapProSelectTokenAtom());
        } else {
          fromToken = get(swapProSelectTokenAtom());
          toToken = get(swapProSellToTokenAtom());
        }
      }
      // check limit zero
      set(swapQuoteActionLockAtom(), (v) => ({
        ...v,
        type: swapTabSwitchType,
        actionLock: true,
        fromToken,
        toToken,
        fromTokenAmount: fromTokenAmount.value,
        toTokenAmount: toTokenAmount.value,
        kind,
        accountId,
        address,
        receivingAddress,
      }));
      this.cleanQuoteInterval();
      this.closeQuoteEvent();
      if (!unResetCount) {
        set(swapQuoteIntervalCountAtom(), 0);
      }
      set(swapQuoteCurrentEventProviderKeysAtom(), []);
      set(swapQuoteCurrentEventReceivedCountAtom(), 0);
      set(swapQuoteEventCompletedAtom(), false);
      set(swapQuoteEventTotalCountAtom(), { count: 0 });
      set(swapBuildTxFetchingAtom(), false);
      set(swapShouldRefreshQuoteAtom(), false);
      const fromTokenAmountNumber = Number(fromTokenAmount.value);
      const toTokenAmountNumber = Number(toTokenAmount.value);
      let quoteKind = kind;
      if (reQuote) {
        if (
          kind === ESwapQuoteKind.SELL &&
          !Number.isNaN(toTokenAmountNumber) &&
          toTokenAmountNumber > 0 &&
          (fromTokenAmountNumber === 0 || Number.isNaN(fromTokenAmountNumber))
        ) {
          quoteKind = ESwapQuoteKind.BUY;
        } else if (
          kind === ESwapQuoteKind.BUY &&
          !Number.isNaN(fromTokenAmountNumber) &&
          fromTokenAmountNumber > 0 &&
          (toTokenAmountNumber === 0 || Number.isNaN(toTokenAmountNumber))
        ) {
          quoteKind = ESwapQuoteKind.SELL;
        }
      }
      if (
        fromToken &&
        toToken &&
        ((quoteKind === ESwapQuoteKind.SELL &&
          !Number.isNaN(fromTokenAmountNumber) &&
          fromTokenAmountNumber > 0) ||
          (quoteKind === ESwapQuoteKind.BUY &&
            !Number.isNaN(toTokenAmountNumber) &&
            toTokenAmountNumber > 0))
      ) {
        void this.runQuoteEvent.call(
          set,
          fromToken,
          toToken,
          slippageItem.value,
          slippageItem.key === ESwapSlippageSegmentKey.AUTO,
          address,
          accountId,
          blockNumber,
          quoteKind,
          fromTokenAmount.value,
          toTokenAmount.value,
          receivingAddress,
          incognito,
        );
      } else {
        void this.resetQuoteAction.call(set);
      }
    },
  );

  runSpeedQuote = contextAtomMethod(
    async (
      get,
      set,
      fromToken: ISwapToken,
      toToken: ISwapToken,
      slippagePercentage: number,
      autoSlippage?: boolean,
      address?: string,
      accountId?: string,
      kind?: ESwapQuoteKind,
      fromTokenAmount?: string,
      toTokenAmount?: string,
      receivingAddress?: string,
    ) => {
      try {
        set(swapSpeedQuoteFetchingAtom(), true);
        set(swapSpeedQuoteResultAtom(), undefined);
        const res = await backgroundApiProxy.serviceSwap.fetchSpeedSwapQuote({
          fromToken,
          toToken,
          fromTokenAmount,
          toTokenAmount,
          kind,
          userAddress: address,
          slippagePercentage,
          autoSlippage,
          receivingAddress,
          accountId,
          protocol: ESwapTabSwitchType.SWAP,
        });
        if (res && res.length > 0) {
          const quoteResult = res[0];
          const quoteResultFromAmount = quoteResult.fromAmount;
          const fromTokenCurrentAmount = get(swapProInputAmountAtom());
          if (
            !quoteResult.errorMessage &&
            quoteResultFromAmount !== fromTokenCurrentAmount
          ) {
            return;
          }
          set(swapSpeedQuoteResultAtom(), quoteResult);
        }
        set(swapSpeedQuoteFetchingAtom(), false);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e?.cause !== ESwapFetchCancelCause.SWAP_SPEED_QUOTE_CANCEL) {
          set(swapSpeedQuoteFetchingAtom(), false);
        }
      }
    },
  );

  quoteSpeedAction = contextAtomMethod(
    async (
      get,
      set,
      slippageItem: { key: ESwapSlippageSegmentKey; value: number },
      address?: string,
      accountId?: string,
      receivingAddress?: string,
    ) => {
      this.cancelSpeedQuote();
      const selectedToken = get(swapProSelectTokenAtom());
      const buySelectToken = get(swapProUseSelectBuyTokenAtom());
      const sellSelectToken = get(swapProSellToTokenAtom());
      const swapProDirection = get(swapProDirectionAtom());
      const fromTokenAmount = get(swapProInputAmountAtom());
      const fromToken =
        swapProDirection === ESwapDirection.BUY
          ? buySelectToken
          : selectedToken;
      const toToken =
        swapProDirection === ESwapDirection.BUY
          ? selectedToken
          : sellSelectToken;
      if (!fromToken || !toToken || fromToken.networkId !== toToken.networkId) {
        return;
      }
      void this.runSpeedQuote.call(
        set,
        fromToken,
        toToken,
        slippageItem.value,
        slippageItem.key === ESwapSlippageSegmentKey.AUTO,
        address,
        accountId,
        ESwapQuoteKind.SELL,
        fromTokenAmount,
        undefined,
        receivingAddress,
      );
    },
  );

  cleanQuoteInterval = () => {
    if (this.quoteInterval) {
      clearTimeout(this.quoteInterval);
      this.quoteInterval = undefined;
    }
    void backgroundApiProxy.serviceSwap.cancelFetchQuotes();
  };

  closeQuoteEvent = () => {
    void backgroundApiProxy.serviceSwap.cancelFetchQuoteEvents();
  };

  cancelSpeedQuote = () => {
    void backgroundApiProxy.serviceSwap.cancelFetchSpeedSwapQuote();
  };

  cleanSpeedQuote = contextAtomMethod(async (get, set) => {
    set(swapSpeedQuoteFetchingAtom(), false);
    set(swapSpeedQuoteResultAtom(), undefined);
  });

  cleanLimitOrderMarketPriceInterval = () => {
    this.limitOrderMarketPriceRequestId += 1;
    if (this.limitOrderMarketPriceInterval) {
      clearInterval(this.limitOrderMarketPriceInterval);
      this.limitOrderMarketPriceInterval = undefined;
    }
  };

  checkAddressNeedCreate = (
    swapSupportAllNetworks: ISwapNetwork[],
    fromToken: ISwapToken,
    addressInfo: ReturnType<typeof useSwapAddressInfo>,
    directionType: ESwapDirectionType,
  ) => {
    const netInfo = swapSupportAllNetworks.find(
      (net) => net.networkId === fromToken.networkId,
    );
    const isAllNetwork = networkUtils.isAllNetwork({
      networkId: addressInfo.accountInfo?.network?.id,
    });
    const networkId = isAllNetwork
      ? fromToken.networkId
      : addressInfo.accountInfo?.network?.id;
    const walletId = addressInfo.accountInfo?.wallet?.id;
    const indexedAccountId = addressInfo.accountInfo?.indexedAccount?.id;
    const deriveType = addressInfo.accountInfo?.deriveType;
    const account = {
      walletId,
      indexedAccountId,
      deriveType,
      networkId,
    };
    const key =
      networkId && walletId && (deriveType || indexedAccountId)
        ? [networkId, deriveType, walletId, indexedAccountId].join('-')
        : Math.random().toString();
    return {
      icon: 'WalletCryptoOutline',
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage(
        {
          id: ETranslations.swap_page_no_address,
        },
        { network: netInfo?.name ?? '' },
      ),
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      message: appLocale.intl.formatMessage({
        id: ETranslations.swap_page_create_to_enable_network,
      }),
      alertLevel: ESwapAlertLevel.INFO,
      action: {
        actionType: ESwapAlertActionType.CREATE_ADDRESS,
        // eslint-disable-next-line onekey/no-app-locale-main-thread
        actionLabel: appLocale.intl.formatMessage({
          id: ETranslations.global_create,
        }),
        directionType,
        actionData: {
          num: 0,
          key,
          account,
        } as ISwapAlertActionData,
      },
    } as ISwapAlertState;
  };

  checkAccountNetworkNotSupportedAlert = async ({
    addressInfo,
    activeNetworkId,
  }: {
    addressInfo?: ReturnType<typeof useSwapAddressInfo>;
    activeNetworkId: string;
  }) => {
    if (!addressInfo) {
      return undefined;
    }

    const walletId = addressInfo.accountInfo?.wallet?.id;
    const accountId = addressInfo.accountInfo?.account?.id;

    const accountNetworkNotSupported =
      await backgroundApiProxy.serviceAccount.checkAccountNetworkNotSupported({
        walletId,
        accountId,
        activeNetworkId,
      });
    if (accountNetworkNotSupported) {
      return {
        // eslint-disable-next-line onekey/no-app-locale-main-thread
        message: appLocale.intl.formatMessage({
          id: ETranslations.swap_page_alert_account_does_not_support_swap,
        }),
        alertLevel: ESwapAlertLevel.ERROR,
      };
    }
    return undefined;
  };

  private async checkSwapTokenIsStock(token?: ISwapToken) {
    if (!token?.networkId) {
      return false;
    }

    const cacheKey = `${token.networkId}:${token.contractAddress}`;
    const cached = this.stockTokenCheckCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const checkPromise = backgroundApiProxy.serviceMarketV2
      .fetchMarketTokenDetailByTokenAddress(
        token.contractAddress,
        token.networkId,
        {
          autoHandleError: false,
        },
      )
      .then((tokenDetail) => {
        if (tokenDetail?.code !== 0 || !tokenDetail?.data?.token) {
          throw new OneKeyLocalError(
            `Market token detail is not available: ${
              tokenDetail?.code ?? 'empty'
            }`,
          );
        }
        return isUSMarketStatusStockTokenSource(
          tokenDetail.data.token.stock?.source,
        );
      })
      .catch((error) => {
        defaultLogger.swap.stockTokenCheck.stockTokenCheckUnavailable({
          cacheKey,
          networkId: token.networkId,
          tokenSymbol: token.symbol,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        this.stockTokenCheckCache.delete(cacheKey);
        return false;
      });
    this.stockTokenCheckCache.set(cacheKey, checkPromise);
    return checkPromise;
  }

  private async fetchCheckUSMarketStatus() {
    const now = Date.now();
    if (this.usMarketStatusCache && this.usMarketStatusCache.expiresAt > now) {
      return this.usMarketStatusCache.promise;
    }

    const promise = backgroundApiProxy.serviceSwap
      .fetchCheckUSMarketStatus()
      .then((marketStatus) => {
        if (!marketStatus || marketStatus.unavailable) {
          this.usMarketStatusCache = undefined;
        }
        return marketStatus;
      })
      .catch(() => {
        this.usMarketStatusCache = undefined;
        return {
          open: false,
          session: 'CLOSED' as const,
          reason: 'market-status-unavailable',
          unavailable: true,
        };
      });
    this.usMarketStatusCache = {
      expiresAt: now + 30_000,
      promise,
    };
    return promise;
  }

  private async checkSwapPairUSMarketClosed({
    fromToken,
    toToken,
  }: {
    fromToken?: ISwapToken;
    toToken?: ISwapToken;
  }) {
    const [fromTokenIsStock, toTokenIsStock] = await Promise.all([
      this.checkSwapTokenIsStock(fromToken),
      this.checkSwapTokenIsStock(toToken),
    ]);

    if (!fromTokenIsStock && !toTokenIsStock) {
      return false;
    }

    const marketStatus = await this.fetchCheckUSMarketStatus();
    return marketStatus?.open === false && marketStatus.unavailable !== true;
  }

  private getUSMarketClosedAlert(): ISwapAlertState & { message: string } {
    return {
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      message: appLocale.intl.formatMessage({
        id: ETranslations.dexmarket_stock_status_closed_error,
      }),
      alertLevel: ESwapAlertLevel.ERROR,
    };
  }

  checkSwapWarning = contextAtomMethod(
    async (
      get,
      set,
      swapFromAddressInfo: ReturnType<typeof useSwapAddressInfo>,
      swapToAddressInfo: ReturnType<typeof useSwapAddressInfo>,
    ) => {
      const fromToken = get(swapSelectFromTokenAtom());
      const toToken = get(swapSelectToTokenAtom());
      const networks = get(swapNetworks());
      const swapSupportAllNetworks = get(swapNetworksIncludeAllNetworkAtom());
      const quoteResult = get(swapQuoteCurrentSelectAtom());
      const tokenMetadata = get(swapTokenMetadataAtom());
      const quoteLoading =
        get(swapQuoteFetchingAtom()) || get(swapSilenceQuoteLoading());
      const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
      const quoteEventCompleted = get(swapQuoteEventCompletedAtom());
      const currentEventReceivedCount = get(
        swapQuoteCurrentEventReceivedCountAtom(),
      );
      const { swapIncognitoMode } = await settingsAtom.get();
      const swapTypeSwitch = get(swapTypeSwitchAtom());
      const quoteEventProgressTotalCount = getSwapQuoteEventProgressTotalCount({
        quoteEventTotalCount,
        maxQuoteCount:
          swapIncognitoMode && swapTypeSwitch !== ESwapTabSwitchType.LIMIT
            ? SWAP_INCOGNITO_QUOTE_PROVIDER_COUNT_CAP
            : undefined,
      });
      const quoteEventFetching = isSwapQuoteEventFetching({
        quoteEventTotalCount: quoteEventProgressTotalCount,
        currentEventReceivedCount,
        quoteEventCompleted,
      });
      const { isWaitingActionableQuote } = getSwapQuoteProgressState({
        quoteLoading,
        quoteEventFetching,
        quoteCurrentSelect: quoteResult,
      });
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      let alertsRes: ISwapAlertState[] = [];
      const quoteEventError = get(swapQuoteEventErrorAtom());
      const isCurrentQuoteResult = isQuoteResultSelectedTokenPair({
        quoteResult,
        fromToken,
        toToken,
      });
      const isCurrentQuoteEventError = isQuoteEventErrorSelectedTokenPair({
        quoteEventError,
        fromToken,
        toToken,
      });
      if (
        quoteEventError &&
        (isCurrentQuoteResult || isCurrentQuoteEventError)
      ) {
        alertsRes = [
          {
            message: quoteEventError.message,
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      } else if (quoteEventError) {
        set(swapQuoteEventErrorAtom(), undefined);
      }
      let rateDifferenceRes:
        | { value: string; unit: ESwapRateDifferenceUnit }
        | undefined;
      // current quote result  current token  not match
      if (quoteResult && fromToken && toToken && !isCurrentQuoteResult) {
        set(swapAlertsAtom(), {
          states: alertsRes,
          quoteId: '',
        });
        set(rateDifferenceAtom(), rateDifferenceRes);
        return;
      }

      if (
        !networks.length ||
        !swapFromAddressInfo.accountInfo?.ready ||
        isWaitingActionableQuote
      ) {
        if (alertsRes.length) {
          set(swapAlertsAtom(), {
            states: alertsRes,
            quoteId: '',
          });
        }
        return;
      }
      // check account
      if (!swapFromAddressInfo.accountInfo?.wallet) {
        // Set noConnectWallet flag without showing alert message
        set(swapAlertsAtom(), {
          states: [...alertsRes, { noConnectWallet: true }],
          quoteId: quoteResult?.quoteId ?? '',
        });
        return;
      }
      if (
        shouldCheckSwapWarningUSMarketClosed({
          alerts: alertsRes,
          swapTypeSwitch,
          fromToken,
          toToken,
          accountReady: swapFromAddressInfo.accountInfo?.ready,
          isWaitingActionableQuote,
          hasFromAccountWallet: Boolean(
            swapFromAddressInfo.accountInfo?.wallet,
          ),
        })
      ) {
        const isUSMarketClosed = await this.checkSwapPairUSMarketClosed({
          fromToken,
          toToken,
        });
        const latestFromToken = get(swapSelectFromTokenAtom());
        const latestToToken = get(swapSelectToTokenAtom());
        const latestSwapTypeSwitch = get(swapTypeSwitchAtom());
        const isSameTokenPair =
          equalTokenNoCaseSensitive({
            token1: latestFromToken,
            token2: fromToken,
          }) &&
          equalTokenNoCaseSensitive({
            token1: latestToToken,
            token2: toToken,
          });
        if (!isSameTokenPair || latestSwapTypeSwitch !== swapTypeSwitch) {
          return;
        }
        if (isUSMarketClosed) {
          alertsRes = [this.getUSMarketClosedAlert()];
        }
      }
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      const notSupportSwapMessage = appLocale.intl.formatMessage({
        id: ETranslations.swap_page_alert_account_does_not_support_swap,
      });
      if (
        fromToken &&
        !swapFromAddressInfo.address &&
        !accountUtils.isHdWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        }) &&
        !accountUtils.isHwWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        }) &&
        !accountUtils.isQrWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        })
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: notSupportSwapMessage,
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      if (
        fromToken &&
        swapFromAddressInfo.accountInfo?.wallet?.id &&
        alertsRes.every((item) => item.message !== notSupportSwapMessage)
      ) {
        const needCheck =
          !swapFromAddressInfo.address ||
          accountUtils.isHwWallet({
            walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          });

        if (needCheck) {
          const accountNetworkNotSupportedAlert =
            await this.checkAccountNetworkNotSupportedAlert({
              addressInfo: swapFromAddressInfo,
              activeNetworkId: fromToken.networkId,
            });
          if (accountNetworkNotSupportedAlert) {
            alertsRes = [...alertsRes, accountNetworkNotSupportedAlert];
            set(swapAlertsAtom(), {
              states: alertsRes,
              quoteId: quoteResult?.quoteId ?? '',
            });
            return;
          }
        }
      }
      if (
        toToken &&
        !swapToAddressInfo.address &&
        swapToAddressInfo.accountInfo?.wallet?.id &&
        alertsRes.every((item) => item.message !== notSupportSwapMessage)
      ) {
        const accountNetworkNotSupportedAlert =
          await this.checkAccountNetworkNotSupportedAlert({
            addressInfo: swapToAddressInfo,
            activeNetworkId: toToken.networkId,
          });
        if (accountNetworkNotSupportedAlert) {
          alertsRes = [...alertsRes, accountNetworkNotSupportedAlert];
          set(swapAlertsAtom(), {
            states: alertsRes,
            quoteId: quoteResult?.quoteId ?? '',
          });
          return;
        }
      }

      // check from address
      if (
        fromToken &&
        swapFromAddressInfo.isAddressInfoReady &&
        !swapFromAddressInfo.address &&
        (accountUtils.isHdWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        }) ||
          accountUtils.isHwWallet({
            walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          }) ||
          accountUtils.isQrWallet({
            walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          }))
      ) {
        const alertAction: ISwapAlertState = this.checkAddressNeedCreate(
          swapSupportAllNetworks,
          fromToken,
          swapFromAddressInfo,
          ESwapDirectionType.FROM,
        );
        alertsRes = [...alertsRes, alertAction];
      }
      // check to address
      if (
        toToken &&
        swapToAddressInfo.isAddressInfoReady &&
        !swapToAddressInfo.address &&
        (accountUtils.isHdWallet({
          walletId: swapToAddressInfo.accountInfo?.wallet?.id,
        }) ||
          accountUtils.isHwWallet({
            walletId: swapToAddressInfo.accountInfo?.wallet?.id,
          }) ||
          accountUtils.isQrWallet({
            walletId: swapToAddressInfo.accountInfo?.wallet?.id,
          }))
      ) {
        if (!(fromToken && fromToken.networkId === toToken.networkId)) {
          const alertAction = this.checkAddressNeedCreate(
            swapSupportAllNetworks,
            toToken,
            swapToAddressInfo,
            ESwapDirectionType.TO,
          );
          alertsRes = [...alertsRes, alertAction];
        }
      }

      const limitPriceUseRate = get(swapLimitPriceUseRateAtom());
      // market rate check
      if (
        fromToken?.price &&
        toToken?.price &&
        (quoteResult?.instantRate ||
          (limitPriceUseRate?.rate &&
            quoteResult?.protocol === EProtocolOfExchange.LIMIT))
      ) {
        const fromTokenPrice = new BigNumber(fromToken.price);
        const toTokenPrice = new BigNumber(toToken.price);
        if (!fromTokenPrice.isZero() && !toTokenPrice.isZero()) {
          const marketingRate = fromTokenPrice.dividedBy(toTokenPrice);
          let instantRate = quoteResult?.instantRate;
          if (
            quoteResult?.protocol === EProtocolOfExchange.LIMIT &&
            limitPriceUseRate.rate
          ) {
            instantRate = limitPriceUseRate.rate;
          }
          const quoteRateBN = new BigNumber(instantRate ?? 0);
          const difference = quoteRateBN
            .dividedBy(marketingRate)
            .minus(1)
            .multipliedBy(100);
          if (difference.absoluteValue().gte(swapRateDifferenceMin)) {
            let unit = ESwapRateDifferenceUnit.POSITIVE;
            if (difference.isNegative()) {
              if (difference.lte(swapRateDifferenceMax)) {
                unit = ESwapRateDifferenceUnit.NEGATIVE;
              } else {
                unit = ESwapRateDifferenceUnit.DEFAULT;
              }
            }
            rateDifferenceRes = {
              value: `${difference.isPositive() ? '+' : ''}${numberFormat(
                difference.toFixed(),
                {
                  formatter: 'priceChange',
                },
              )}`,
              unit,
            };
          }
        }
      }

      const fromTokenAmountBN = new BigNumber(fromTokenAmount.value);
      // check min max amount
      if (quoteResult && quoteResult.limit?.min) {
        const minAmountBN = new BigNumber(quoteResult.limit.min);
        if (fromTokenAmountBN.lt(minAmountBN)) {
          alertsRes = [
            ...alertsRes,
            {
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              message: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_minimum_amount,
                },
                {
                  number: minAmountBN.toFixed(),
                  symbol: fromToken?.symbol ?? 'unknown',
                },
              ),
              alertLevel: ESwapAlertLevel.ERROR,
              inputShowError: true,
            },
          ];
        }
      }
      if (quoteResult && quoteResult.limit?.max) {
        const maxAmountBN = new BigNumber(quoteResult.limit.max);
        if (fromTokenAmountBN.gt(maxAmountBN)) {
          alertsRes = [
            ...alertsRes,
            {
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              message: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_maximum_amount,
                },
                {
                  number: maxAmountBN.toFixed(),
                  symbol: fromToken?.symbol ?? 'unknown',
                },
              ),
              alertLevel: ESwapAlertLevel.ERROR,
              inputShowError: true,
            },
          ];
        }
      }

      // check other fee
      const otherFeeInfo = quoteResult?.fee?.otherFeeInfos;
      if (otherFeeInfo?.length) {
        otherFeeInfo.forEach((item) => {
          const tokenAmountBN = new BigNumber(item.amount ?? 0);
          if (tokenAmountBN.gt(0)) {
            alertsRes = [
              ...alertsRes,
              {
                icon: 'HandCoinsOutline',
                // eslint-disable-next-line onekey/no-app-locale-main-thread
                title: appLocale.intl.formatMessage(
                  {
                    id: ETranslations.swap_page_alert_require_native_token_title,
                  },
                  {
                    n: numberFormat(tokenAmountBN.toFixed(), {
                      formatter: 'balance',
                    }),
                    token: item.token?.symbol ?? '',
                  },
                ),
                alertLevel: ESwapAlertLevel.WARNING,
                // eslint-disable-next-line onekey/no-app-locale-main-thread
                message: appLocale.intl.formatMessage({
                  id: ETranslations.swap_page_alert_require_native_token_content,
                }),
              },
            ];
          }
        });
      }

      if (tokenMetadata?.swapTokenMetadata) {
        const { buyToken, sellToken } = tokenMetadata.swapTokenMetadata;
        const buyTokenBuyTaxBN = new BigNumber(
          buyToken?.buyTaxBps ? buyToken?.buyTaxBps : 0,
        );
        const buyTokenSellTaxBN = new BigNumber(
          buyToken?.sellTaxBps ? buyToken?.sellTaxBps : 0,
        );
        const sellTokenBuyTaxBN = new BigNumber(
          sellToken?.buyTaxBps ? sellToken?.buyTaxBps : 0,
        );
        const sellTokenSellTaxBN = new BigNumber(
          sellToken?.sellTaxBps ? sellToken?.sellTaxBps : 0,
        );
        if (buyTokenBuyTaxBN.gt(0) || buyTokenSellTaxBN.gt(0)) {
          // eslint-disable-next-line onekey/no-app-locale-main-thread
          const actionLabel = appLocale.intl.formatMessage({
            id: buyTokenSellTaxBN.gt(buyTokenBuyTaxBN)
              ? ETranslations.swap_page_alert_tax_detected_sell
              : ETranslations.swap_page_alert_tax_detected_buy,
          });

          const showTax = BigNumber.maximum(
            buyTokenSellTaxBN,
            buyTokenBuyTaxBN,
          );
          alertsRes = [
            ...alertsRes,
            {
              icon: 'HandCoinsOutline',
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              title: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_tax_detected_title,
                },
                {
                  percentage: `${showTax.dividedBy(100).toNumber()}%`,
                  token: toToken?.symbol ?? '',
                  action: actionLabel,
                },
              ),
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              message: appLocale.intl.formatMessage({
                id: ETranslations.swap_page_alert_tax_detected,
              }),
              alertLevel: ESwapAlertLevel.INFO,
            },
          ];
        }
        if (sellTokenBuyTaxBN.gt(0) || sellTokenSellTaxBN.gt(0)) {
          // eslint-disable-next-line onekey/no-app-locale-main-thread
          const actionLabel = appLocale.intl.formatMessage({
            id: sellTokenSellTaxBN.gt(sellTokenBuyTaxBN)
              ? ETranslations.swap_page_alert_tax_detected_sell
              : ETranslations.swap_page_alert_tax_detected_buy,
          });
          const showTax = BigNumber.maximum(
            sellTokenBuyTaxBN,
            sellTokenSellTaxBN,
          );
          alertsRes = [
            ...alertsRes,
            {
              icon: 'HandCoinsOutline',
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              title: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_tax_detected_title,
                },
                {
                  percentage: `${showTax.dividedBy(100).toNumber()}%`,
                  token: fromToken?.symbol ?? '',
                  action: actionLabel,
                },
              ),
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              message: appLocale.intl.formatMessage({
                id: ETranslations.swap_page_alert_tax_detected,
              }),
              alertLevel: ESwapAlertLevel.INFO,
            },
          ];
        }
      }

      // check limit native should wrapped
      if (quoteResult?.shouldWrappedToken) {
        alertsRes = [
          ...alertsRes,
          {
            icon: 'ErrorSolid',
            // eslint-disable-next-line onekey/no-app-locale-main-thread
            title: appLocale.intl.formatMessage(
              {
                id: ETranslations.Limit_native_token_no_sell,
              },
              {
                token: quoteResult.fromTokenInfo.symbol,
              },
            ),
            alertLevel: ESwapAlertLevel.INFO,
            action: {
              actionType: ESwapAlertActionType.LIMIT_NATIVE_WRAPPED,
              actionData: {
                wrappedToken: quoteResult?.shouldWrappedToken,
              },
            },
          },
        ];
      }

      set(swapAlertsAtom(), {
        states: alertsRes,
        quoteId: quoteResult?.quoteId ?? '',
      });
      set(rateDifferenceAtom(), rateDifferenceRes);
    },
  );

  loadSwapSelectTokenDetail = contextAtomMethod(
    async (
      get,
      set,
      type: ESwapDirectionType,
      swapAddressInfo: ReturnType<typeof useSwapAddressInfo>,
      fetchBalance?: boolean,
    ) => {
      const token =
        type === ESwapDirectionType.FROM
          ? get(swapSelectFromTokenAtom())
          : get(swapSelectToTokenAtom());
      let accountAddress: string | undefined;
      let accountNetworkId: string | undefined;
      let accountId: string | undefined;
      if (type === ESwapDirectionType.TO) {
        // fetch to Token balance use FromAccount id
        if (
          token?.networkId &&
          !networkUtils.isAllNetwork({ networkId: token?.networkId })
        ) {
          try {
            const accountDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                { networkId: token.networkId },
              );
            const toAccountInfos =
              await backgroundApiProxy.serviceAccount.getNetworkAccount({
                deriveType: accountDeriveType ?? 'default',
                indexedAccountId:
                  swapAddressInfo.accountInfo?.indexedAccount?.id,
                accountId: swapAddressInfo.accountInfo?.indexedAccount?.id
                  ? undefined
                  : (swapAddressInfo.accountInfo?.account?.id ?? ''),
                dbAccount: swapAddressInfo.accountInfo?.dbAccount,
                networkId: token.networkId,
              });
            if (toAccountInfos) {
              accountAddress = toAccountInfos.addressDetail?.address;
              accountNetworkId = toAccountInfos.addressDetail?.networkId;
              accountId = toAccountInfos.id;
            }
          } catch (e) {
            console.error('swap_toToken_getNetworkAccountError--', e);
          }
        }
      } else {
        accountAddress = swapAddressInfo.address;
        accountNetworkId = swapAddressInfo.networkId;
        accountId = swapAddressInfo.accountInfo?.account?.id;
      }
      let balanceDisplay;
      if (
        (token &&
          accountAddress &&
          accountNetworkId &&
          accountNetworkId === token?.networkId) ||
        (!token?.price && token)
      ) {
        if (
          token.accountAddress === accountAddress &&
          accountNetworkId === token.networkId &&
          token.balanceParsed &&
          !fetchBalance
        ) {
          const balanceParsedBN = new BigNumber(token.balanceParsed ?? 0);
          balanceDisplay = balanceParsedBN.isNaN()
            ? '0.0'
            : balanceParsedBN.toFixed();
        } else {
          try {
            set(swapSelectTokenDetailFetchingAtom(), (pre) => ({
              ...pre,
              [type]: true,
            }));
            // reset balance
            if (type === ESwapDirectionType.FROM) {
              set(swapSelectedFromTokenBalanceAtom(), '');
            } else {
              set(swapSelectedToTokenBalanceAtom(), '');
            }
            const detailInfo =
              await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                networkId: token.networkId,
                accountAddress,
                accountId,
                contractAddress: token.contractAddress,
                direction: type,
              });
            if (detailInfo?.[0]) {
              const balanceParsedBN = new BigNumber(
                detailInfo[0].balanceParsed ?? 0,
              );
              balanceDisplay = balanceParsedBN.isNaN()
                ? '0.0'
                : balanceParsedBN.toFixed();
              const condition: {
                price?: string;
                fiatValue?: string;
                balanceParsed?: string;
                reservationValue?: string;
                logoURI?: string;
              } = {};
              if (detailInfo[0].price) {
                condition.price = detailInfo[0].price;
              }
              if (detailInfo[0].fiatValue) {
                condition.fiatValue = detailInfo[0].fiatValue;
              }
              if (detailInfo[0].balanceParsed) {
                condition.balanceParsed = detailInfo[0].balanceParsed;
              }
              if (detailInfo[0].reservationValue) {
                condition.reservationValue = detailInfo[0].reservationValue;
              }
              if (detailInfo[0].logoURI) {
                condition.logoURI = detailInfo[0].logoURI;
              }
              const newToken =
                type === ESwapDirectionType.FROM
                  ? get(swapSelectFromTokenAtom())
                  : get(swapSelectToTokenAtom());
              if (
                equalTokenNoCaseSensitive({
                  token1: newToken,
                  token2: token,
                })
              ) {
                if (type === ESwapDirectionType.FROM) {
                  set(swapSelectFromTokenAtom(), (pre) => {
                    if (pre) {
                      return {
                        ...pre,
                        ...condition,
                        accountAddress,
                      };
                    }
                  });
                } else {
                  set(swapSelectToTokenAtom(), (pre) => {
                    if (pre) {
                      return {
                        ...pre,
                        ...condition,
                        accountAddress,
                      };
                    }
                  });
                }
              }
            }
          } catch (e: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (e?.cause !== ESwapFetchCancelCause.SWAP_TOKENS_CANCEL) {
              balanceDisplay = '0.0';
            }
          } finally {
            set(swapSelectTokenDetailFetchingAtom(), (pre) => ({
              ...pre,
              [type]: false,
            }));
          }
        }
      }
      const newToken =
        type === ESwapDirectionType.FROM
          ? get(swapSelectFromTokenAtom())
          : get(swapSelectToTokenAtom());
      if (
        equalTokenNoCaseSensitive({ token1: newToken, token2: token }) ||
        (!token && !newToken)
      ) {
        if (type === ESwapDirectionType.FROM) {
          set(swapSelectedFromTokenBalanceAtom(), balanceDisplay ?? '');
        } else {
          set(swapSelectedToTokenBalanceAtom(), balanceDisplay ?? '');
        }
      }
    },
  );

  updateAllNetworkTokenList = contextAtomMethod(
    async (
      get,
      set,
      accountNetworkId: string,
      accountId?: string,
      accountAddress?: string,
      isFirstFetch?: boolean,
      allNetAccountId?: string,
      lpToken?: boolean,
    ) => {
      const protocol = get(swapTypeSwitchAtom());
      const result = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
        networkId: accountNetworkId,
        accountNetworkId,
        accountAddress,
        accountId,
        onlyAccountTokens: true,
        isAllNetworkFetchAccountTokens: true,
        protocol,
        lpToken,
      });
      if (result?.length) {
        if (isFirstFetch && allNetAccountId) {
          set(swapAllNetworkTokenListMapAtom(), (v) => {
            const oldTokens = v[allNetAccountId] ?? [];
            const newTokens =
              result.filter(
                (t) =>
                  !oldTokens?.find((tk) =>
                    equalTokenNoCaseSensitive({
                      token1: tk,
                      token2: t,
                    }),
                  ),
              ) ?? [];
            const needUpdateTokens =
              result.filter(
                (t) =>
                  !newTokens.find((tk) =>
                    equalTokenNoCaseSensitive({
                      token1: tk,
                      token2: t,
                    }),
                  ),
              ) ?? [];
            const filterTokens =
              oldTokens?.filter(
                (tk) =>
                  !needUpdateTokens.find((t) =>
                    equalTokenNoCaseSensitive({
                      token1: tk,
                      token2: t,
                    }),
                  ),
              ) ?? [];
            return {
              ...v,
              [allNetAccountId]: [
                ...filterTokens,
                ...needUpdateTokens,
                ...newTokens,
              ],
            };
          });
        } else {
          return result;
        }
      }
    },
  );

  swapLoadAllNetworkTokenList = contextAtomMethod(
    async (
      get,
      set,
      indexedAccountId?: string,
      otherWalletTypeAccountId?: string,
      lpToken?: boolean,
    ) => {
      const swapAllNetworkActionLock = get(swapAllNetworkActionLockAtom());
      const swapTypeSwitchValue = get(swapTypeSwitchAtom());
      const swapSupportNetworks = get(swapNetworks());
      const currentTypeSupportNetworks =
        swapTypeSwitchValue === ESwapTabSwitchType.SWAP ||
        swapTypeSwitchValue === ESwapTabSwitchType.BRIDGE
          ? swapSupportNetworks
          : swapSupportNetworks.filter((item) => item.supportLimit);
      const tokenListSupportNetworks = lpToken
        ? currentTypeSupportNetworks.filter((item) => item.backendIndex)
        : currentTypeSupportNetworks;
      const { accountIdKey, swapSupportAccounts } =
        await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
          indexedAccountId,
          otherWalletTypeAccountId,
          swapSupportNetworks: tokenListSupportNetworks,
        });
      const tokenListCacheKey = buildSwapAllNetworkTokenListCacheKey({
        accountId: accountIdKey,
        lpToken,
      });
      if (swapAllNetworkActionLock[tokenListCacheKey]) {
        return;
      }
      if (swapSupportAccounts.length > 0) {
        set(swapAllNetworkActionLockAtom(), (v) => ({
          ...v,
          [tokenListCacheKey]: true,
        }));
        const currentSwapAllNetworkTokenList = get(
          swapAllNetworkTokenListMapAtom(),
        )[tokenListCacheKey];
        const accountAddressList = swapSupportAccounts
          .filter((item) => item.apiAddress)
          .filter(
            (item) => !networkUtils.isAllNetwork({ networkId: item.networkId }),
          );

        // Create tasks as functions to delay execution until batched
        const tasks = accountAddressList.map((networkDataString) => {
          const {
            apiAddress,
            networkId: accountNetworkId,
            accountId,
          } = networkDataString;
          return () =>
            this.updateAllNetworkTokenList.call(
              set,
              accountNetworkId,
              accountId,
              apiAddress,
              !currentSwapAllNetworkTokenList,
              tokenListCacheKey,
              lpToken,
            );
        });

        try {
          // Execute requests in batches of 3 to prevent UI thread blocking
          const results = await this.executeBatched(tasks, 3);

          if (!currentSwapAllNetworkTokenList) {
            set(swapAllNetworkTokenListMapAtom(), (v) => {
              if (v[tokenListCacheKey] !== undefined) {
                return v;
              }
              return {
                ...v,
                [tokenListCacheKey]: [],
              };
            });
          } else {
            // Subsequent fetches: collect results and update atom
            const allTokensResult = results
              .filter((r) => r.status === 'fulfilled' && r.value)
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              .map((r) => (r as PromiseFulfilledResult<any>).value)
              .filter(Boolean)
              .flat();
            set(swapAllNetworkTokenListMapAtom(), (v) => ({
              ...v,
              [tokenListCacheKey]: allTokensResult,
            }));
          }
        } finally {
          set(swapAllNetworkActionLockAtom(), (v) => ({
            ...v,
            [tokenListCacheKey]: false,
          }));
        }
      } else {
        set(swapAllNetworkTokenListMapAtom(), (v) => ({
          ...v,
          [tokenListCacheKey]: [],
        }));
      }
    },
  );

  swapProLoadSupportNetworksTokenList = contextAtomMethod(
    async (
      get,
      set,
      supportNetworks: ISwapNetwork[],
      indexedAccountId?: string,
      otherWalletTypeAccountId?: string,
    ) => {
      set(swapProSupportNetworksTokenListLoadingAtom(), true);
      const positionNetworkIdsKey = supportNetworks
        .map((item) => item.networkId)
        .filter(Boolean)
        .toSorted()
        .join(',');
      const positionOwnerKey = buildSwapProPositionsOwnerKey({
        accountId: indexedAccountId ?? otherWalletTypeAccountId,
        networkIdsKey: positionNetworkIdsKey,
      });
      const updatePositionsCache = (tokens: ISwapToken[]) => {
        if (!positionOwnerKey || !positionNetworkIdsKey) {
          return;
        }
        set(swapProPositionsCacheAtom(), (prev) => {
          const updatedAt = Date.now();
          const byOwner = {
            ...prev.byOwner,
            [positionOwnerKey]: {
              ownerKey: positionOwnerKey,
              networkIdsKey: positionNetworkIdsKey,
              tokens,
              updatedAt,
            },
          };
          const entries = Object.entries(byOwner)
            .toSorted(([, a], [, b]) => b.updatedAt - a.updatedAt)
            .slice(0, SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS);
          return {
            byOwner: Object.fromEntries(entries),
          };
        });
      };
      const { swapSupportAccounts: swapProSupportAccounts } =
        await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
          indexedAccountId,
          otherWalletTypeAccountId,
          swapSupportNetworks: supportNetworks,
        });
      if (swapProSupportAccounts.length > 0) {
        const accountAddressList = swapProSupportAccounts
          .filter((item) => item.apiAddress)
          .filter(
            (item) => !networkUtils.isAllNetwork({ networkId: item.networkId }),
          );

        // Create tasks as functions to delay execution until batched
        const tasks = accountAddressList.map((networkDataString) => {
          const {
            apiAddress,
            networkId: accountNetworkId,
            accountId,
          } = networkDataString;
          return () =>
            backgroundApiProxy.serviceSwap.fetchSwapTokens({
              networkId: accountNetworkId,
              accountNetworkId,
              accountAddress: apiAddress,
              accountId,
              onlyAccountTokens: true,
              isAllNetworkFetchAccountTokens: true,
              protocol: ESwapTabSwitchType.SWAP,
            });
        });

        // Execute requests in batches of 3 to prevent UI thread blocking
        const results = await this.executeBatched(tasks, 3);

        // Extract successful results and sort by fiat value
        const sortedResult = results
          .filter((r) => r.status === 'fulfilled' && r.value)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          .map((r) => (r as PromiseFulfilledResult<any>).value)
          .filter(Boolean)
          .flat()
          .toSorted((a, b) => {
            return new BigNumber(b.fiatValue ?? '0').comparedTo(
              new BigNumber(a.fiatValue ?? '0'),
            );
          });
        set(swapProSupportNetworksTokenListAtom(), sortedResult);
        updatePositionsCache(sortedResult);
      } else {
        set(swapProSupportNetworksTokenListAtom(), []);
        updatePositionsCache([]);
      }
      set(swapProSupportNetworksTokenListLoadingAtom(), false);
    },
  );

  swapTypeSwitchAction = contextAtomMethod(
    async (
      get,
      set,
      type: ESwapTabSwitchType,
      swapAccountNetworkId?: string,
    ) => {
      const oldType = get(swapTypeSwitchAtom());
      if (
        platformEnv.isNative &&
        (oldType === ESwapTabSwitchType.LIMIT ||
          type === ESwapTabSwitchType.LIMIT)
      ) {
        set(swapFromTokenAmountAtom(), { value: '', isInput: false });
        set(swapToTokenAmountAtom(), { value: '', isInput: false });
      }
      // OK-49718: Clear quote list when switching type to prevent showing stale data
      set(swapQuoteListAtom(), []);
      set(swapQuoteCurrentEventProviderKeysAtom(), []);
      set(swapQuoteCurrentEventReceivedCountAtom(), 0);
      set(swapQuoteEventCompletedAtom(), false);
      set(swapQuoteEventTotalCountAtom(), { count: 0 });
      set(swapTypeSwitchAtom(), type);
      if (platformEnv.isNative && type === ESwapTabSwitchType.LIMIT) {
        return;
      }
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      const fromTokenAmountBN = new BigNumber(fromTokenAmount.value);
      if (
        type === ESwapTabSwitchType.LIMIT &&
        !fromTokenAmountBN.isNaN() &&
        !fromTokenAmountBN.isZero()
      ) {
        set(swapFromTokenAmountAtom(), (o) => ({ ...o, isInput: true }));
      }
      this.cleanManualSelectQuoteProviders.call(set);
      const swapSupportNetworks = get(swapNetworksIncludeAllNetworkAtom());
      const fromToken = get(swapSelectFromTokenAtom());
      const toToken = get(swapSelectToTokenAtom());
      const fromNetworkDefault =
        swapDefaultSetTokens[swapAccountNetworkId ?? ''];
      if (
        fromToken &&
        !swapSupportNetworks.some(
          (net) => net.networkId === fromToken?.networkId,
        )
      ) {
        void this.resetSwapTokenData.call(set, ESwapDirectionType.FROM);
      }
      if (
        toToken &&
        !swapSupportNetworks.some((net) => net.networkId === toToken?.networkId)
      ) {
        void this.resetSwapTokenData.call(set, ESwapDirectionType.TO);
      }
      if (
        swapSupportNetworks.some(
          (net) => net.networkId === swapAccountNetworkId,
        )
      ) {
        if (type === ESwapTabSwitchType.BRIDGE) {
          let shouldSetFromToken = null;
          if (fromToken) {
            shouldSetFromToken = fromToken;
          }
          if (!fromToken && toToken?.networkId !== swapAccountNetworkId) {
            if (fromNetworkDefault?.fromToken?.isNative) {
              shouldSetFromToken = fromNetworkDefault?.fromToken;
              set(swapSelectFromTokenAtom(), fromNetworkDefault?.fromToken);
            }
          }
          if (shouldSetFromToken) {
            const needChangeToToken = this.needChangeToken({
              token: shouldSetFromToken,
              toToken,
              swapTypeSwitchValue: type,
            });
            if (needChangeToToken) {
              set(swapSelectToTokenAtom(), needChangeToToken);
              void this.syncNetworksSort.call(set, needChangeToToken.networkId);
            }
          }
        } else if (type === ESwapTabSwitchType.SWAP) {
          if (
            !fromToken &&
            fromNetworkDefault?.fromToken?.isNative &&
            !toToken?.isNative
          ) {
            set(swapSelectFromTokenAtom(), fromNetworkDefault?.fromToken);
          }
          if (toToken?.networkId !== fromToken?.networkId) {
            if (
              !fromToken?.isNative &&
              fromNetworkDefault?.fromToken &&
              fromNetworkDefault?.fromToken?.isNative
            ) {
              set(swapSelectToTokenAtom(), fromNetworkDefault?.fromToken);
              void this.syncNetworksSort.call(
                set,
                fromNetworkDefault?.fromToken?.networkId,
              );
            } else if (
              fromToken?.isNative &&
              fromNetworkDefault?.toToken &&
              !fromNetworkDefault?.toToken?.isNative
            ) {
              set(swapSelectToTokenAtom(), fromNetworkDefault?.toToken);
              void this.syncNetworksSort.call(
                set,
                fromNetworkDefault?.toToken?.networkId,
              );
            } else {
              void this.resetSwapTokenData.call(set, ESwapDirectionType.TO);
            }
          }
        } else if (type === ESwapTabSwitchType.LIMIT) {
          if (
            !fromToken &&
            !equalTokenNoCaseSensitive({
              token1: fromNetworkDefault?.limitFromToken,
              token2: toToken,
            })
          ) {
            set(swapSelectFromTokenAtom(), fromNetworkDefault?.limitFromToken);
          }
          // limit only support single network
          if (toToken?.networkId !== fromToken?.networkId) {
            if (fromNetworkDefault?.limitToToken) {
              if (
                !fromToken ||
                !equalsIgnoreCase(
                  fromToken?.contractAddress,
                  fromNetworkDefault?.limitToToken?.contractAddress,
                )
              ) {
                set(swapSelectToTokenAtom(), fromNetworkDefault?.limitToToken);
                if (fromNetworkDefault?.limitToToken?.networkId) {
                  void this.syncNetworksSort.call(
                    set,
                    fromNetworkDefault?.limitToToken?.networkId,
                  );
                }
              } else if (
                fromToken &&
                !equalsIgnoreCase(
                  fromToken?.contractAddress,
                  fromNetworkDefault?.limitFromToken?.contractAddress,
                )
              ) {
                set(
                  swapSelectToTokenAtom(),
                  fromNetworkDefault?.limitFromToken,
                );
                if (fromNetworkDefault?.limitFromToken?.networkId) {
                  void this.syncNetworksSort.call(
                    set,
                    fromNetworkDefault?.limitFromToken?.networkId,
                  );
                }
              }
            } else {
              void this.resetSwapTokenData.call(set, ESwapDirectionType.TO);
            }
          }
          const fromLimitTokenDefault = fromNetworkDefault?.limitFromToken;
          if (
            fromToken &&
            fromToken.isNative &&
            !equalTokenNoCaseSensitive({
              token1: toToken,
              token2: fromLimitTokenDefault,
            })
          ) {
            set(swapSelectFromTokenAtom(), fromLimitTokenDefault);
          }
        }
      }
    },
  );

  limitMarketPriceRun = contextAtomMethod(
    async (
      get,
      set,
      fromToken?: ISwapToken,
      toToken?: ISwapToken,
      requestId?: number,
    ) => {
      try {
        if (fromToken && toToken) {
          const { fromTokenPrice, toTokenPrice } =
            await backgroundApiProxy.serviceSwap.fetchLimitMarketPrice({
              fromToken,
              toToken,
            });
          if (requestId !== this.limitOrderMarketPriceRequestId) {
            return;
          }
          const fromTokenPriceInfo = {
            tokenInfo: fromToken,
            price: fromTokenPrice || (fromToken.price ?? ''),
          };
          const toTokenPriceInfo = {
            tokenInfo: toToken,
            price: toTokenPrice || (toToken.price ?? ''),
          };
          set(limitOrderMarketPriceAtom(), (v) => ({
            ...v,
            fromTokenPriceInfo,
            toTokenPriceInfo,
          }));
        }
      } catch (error) {
        console.error(error);
      }
      if (requestId !== this.limitOrderMarketPriceRequestId) {
        return;
      }
      this.limitOrderMarketPriceInterval = setTimeout(() => {
        void this.limitOrderMarketPriceIntervalAction.call(
          set,
          fromToken,
          toToken,
        );
      }, ESwapLimitOrderMarketPriceUpdateInterval);
    },
  );

  limitOrderMarketPriceIntervalAction = contextAtomMethod(
    async (get, set, fromToken?: ISwapToken, toToken?: ISwapToken) => {
      this.limitOrderMarketPriceRequestId += 1;
      const requestId = this.limitOrderMarketPriceRequestId;
      if (this.limitOrderMarketPriceInterval) {
        clearInterval(this.limitOrderMarketPriceInterval);
      }
      const type = get(swapTypeSwitchAtom());
      if (type !== ESwapTabSwitchType.LIMIT) {
        set(limitOrderMarketPriceAtom(), {});
        return;
      }
      if (checkWrappedTokenPair({ fromToken, toToken })) {
        set(limitOrderMarketPriceAtom(), {});
        return;
      }
      await this.limitMarketPriceRun.call(set, fromToken, toToken, requestId);
    },
  );

  swapProTokenMarketDetailFetchAction = contextAtomMethod(
    async (get, set, contractAddress: string, networkId: string) => {
      try {
        set(swapProTokenMarketDetailInfoLoadingAtom(), true);
        const tokenDetail =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            contractAddress,
            networkId,
          );
        const responseData = tokenDetail;

        if (
          typeof responseData?.data?.token?.name === 'undefined' ||
          responseData.data.token.name === ''
        ) {
          console.warn('Token detail is not available');
          return;
        }

        // Extract token and websocket data from new response format
        const tokenData = responseData.data.token;
        const websocketConfig = responseData.data.websocket;
        const currentSelectToken = get(swapProSelectTokenAtom());
        const currentTokenDetail = get(swapProTokenMarketDetailInfoAtom());
        const isSameToken =
          currentTokenDetail &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId,
              contractAddress: tokenData.address,
            },
            token2: {
              networkId,
              contractAddress: currentTokenDetail.address || '',
            },
          });
        const hasKLinePrice = isSameToken && currentTokenDetail?.lastUpdated;

        const finalTokenData = {
          ...(hasKLinePrice
            ? {
                ...tokenData,
                price: currentTokenDetail.price, // Always use K-line price
                lastUpdated: currentTokenDetail.lastUpdated,
              }
            : tokenData),
          networkId,
        };
        set(swapProTokenMarketDetailInfoAtom(), finalTokenData);
        set(swapProTokenDetailWebsocketAtom(), websocketConfig);
        if (
          currentSelectToken &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId,
              contractAddress,
            },
            token2: currentSelectToken,
          })
        ) {
          set(swapProSelectTokenAtom(), {
            ...currentSelectToken,
            price: finalTokenData.price,
          });
        }
      } catch (error) {
        console.error('swap__tokenDetail error', error);
      } finally {
        set(swapProTokenMarketDetailInfoLoadingAtom(), false);
      }
    },
  );
}

const createActions = memoFn(() => new ContentJotaiActionsSwap());

export const useSwapActions = () => {
  const actions = createActions();
  const selectFromToken = actions.selectFromToken.use();
  const selectToToken = actions.selectToToken.use();
  const alternationToken = actions.alternationToken.use();
  const syncNetworksSort = actions.syncNetworksSort.use();
  const catchSwapTokensMap = actions.catchSwapTokensMap.use();
  const quoteAction = actions.quoteAction.use();
  const checkSwapWarning = actions.checkSwapWarning.use();
  const tokenListFetchAction = actions.tokenListFetchAction.use();
  const quoteEventHandler = actions.quoteEventHandler.use();
  const loadSwapSelectTokenDetail = actions.loadSwapSelectTokenDetail.use();
  const swapLoadAllNetworkTokenList = actions.swapLoadAllNetworkTokenList.use();
  const swapTypeSwitchAction = actions.swapTypeSwitchAction.use();
  const limitOrderMarketPriceIntervalAction =
    actions.limitOrderMarketPriceIntervalAction.use();
  const swapProTokenMarketDetailFetchAction =
    actions.swapProTokenMarketDetailFetchAction.use();
  const swapProLoadSupportNetworksTokenList =
    actions.swapProLoadSupportNetworksTokenList.use();
  const quoteSpeedAction = actions.quoteSpeedAction.use();
  const cleanSpeedQuote = actions.cleanSpeedQuote.use();
  const setSwapProSelectToken = actions.setSwapProSelectToken.use();
  const resetSwapTokenData = actions.resetSwapTokenData.use();
  const {
    cleanQuoteInterval,
    closeQuoteEvent,
    needChangeToken,
    cleanLimitOrderMarketPriceInterval,
    cancelSpeedQuote,
  } = actions;

  return useRef({
    selectFromToken,
    quoteAction,
    selectToToken,
    alternationToken,
    syncNetworksSort,
    catchSwapTokensMap,
    cleanQuoteInterval,
    tokenListFetchAction,
    checkSwapWarning,
    loadSwapSelectTokenDetail,
    quoteEventHandler,
    swapLoadAllNetworkTokenList,
    closeQuoteEvent,
    swapTypeSwitchAction,
    needChangeToken,
    limitOrderMarketPriceIntervalAction,
    cleanLimitOrderMarketPriceInterval,
    swapProTokenMarketDetailFetchAction,
    swapProLoadSupportNetworksTokenList,
    quoteSpeedAction,
    cancelSpeedQuote,
    cleanSpeedQuote,
    setSwapProSelectToken,
    resetSwapTokenData,
  });
};
