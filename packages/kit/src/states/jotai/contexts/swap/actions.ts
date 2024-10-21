import { useRef } from 'react';

import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import { moveNetworkToFirst } from '@onekeyhq/kit/src/views/Swap/utils/utils';
import type { IEventSourceMessageEvent } from '@onekeyhq/shared/src/eventSource';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  swapApprovingStateFetchInterval,
  swapBridgeDefaultTokenConfigs,
  swapBridgeDefaultTokenExtraConfigs,
  swapDefaultSetTokens,
  swapHistoryStateFetchRiceIntervalCount,
  swapQuoteFetchInterval,
  swapQuoteIntervalMaxCount,
  swapRateDifferenceMax,
  swapRateDifferenceMin,
  swapTokenCatchMapMaxCount,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuotesParams,
  IFetchTokensParams,
  ISwapAlertActionData,
  ISwapAlertState,
  ISwapApproveTransaction,
  ISwapNetwork,
  ISwapQuoteEvent,
  ISwapQuoteEventAutoSlippage,
  ISwapQuoteEventData,
  ISwapQuoteEventInfo,
  ISwapQuoteEventQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapAlertActionType,
  ESwapAlertLevel,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  ESwapFetchCancelCause,
  ESwapRateDifferenceUnit,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  rateDifferenceAtom,
  swapAlertsAtom,
  swapAllNetworkActionLockAtom,
  swapAllNetworkTokenListMapAtom,
  swapAutoSlippageSuggestedValueAtom,
  swapBuildTxFetchingAtom,
  swapFromTokenAmountAtom,
  swapManualSelectQuoteProvidersAtom,
  swapNetworks,
  swapNetworksIncludeAllNetworkAtom,
  swapQuoteActionLockAtom,
  swapQuoteCurrentSelectAtom,
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
  swapSlippagePercentageAtom,
  swapSlippagePercentageModeAtom,
  swapTokenFetchingAtom,
  swapTokenMapAtom,
  swapTokenMetadataAtom,
  swapTypeSwitchAtom,
} from './atoms';

class ContentJotaiActionsSwap extends ContextJotaiActionsBase {
  private quoteInterval: ReturnType<typeof setTimeout> | undefined;

  private approvingInterval: ReturnType<typeof setTimeout> | undefined;

  private approvingIntervalCount = 0;

  syncNetworksSort = contextAtomMethod(async (get, set, netWorkId: string) => {
    const networks = get(swapNetworks());
    const sortNetworks = moveNetworkToFirst(networks, netWorkId);
    set(swapNetworks(), sortNetworks);
    await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
      data: sortNetworks,
    });
  });

  resetSwapSlippage = contextAtomMethod((get, set) => {
    set(swapSlippagePercentageModeAtom(), ESwapSlippageSegmentKey.AUTO);
  });

  cleanManualSelectQuoteProviders = contextAtomMethod((get, set) => {
    set(swapManualSelectQuoteProvidersAtom(), undefined);
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
          ...(swapTokenMap.tokenCatch ?? {}),
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
      swapTypeSwitchValue === ESwapTabSwitchType.SWAP
    ) {
      const defaultTokenSet = swapDefaultSetTokens[token.networkId];
      if (token.isNative && !defaultTokenSet.toToken?.isNative) {
        return defaultTokenSet.toToken;
      }
      if (!token.isNative && defaultTokenSet.fromToken?.isNative) {
        return defaultTokenSet.fromToken;
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
    async (get, set, token: ISwapToken, disableCheckToToken?: boolean) => {
      const toToken = get(swapSelectToTokenAtom());
      const swapTypeSwitchValue = get(swapTypeSwitchAtom());
      this.cleanManualSelectQuoteProviders.call(set);
      this.resetSwapSlippage.call(set);
      await this.syncNetworksSort.call(set, token.networkId);
      const needChangeToToken = this.needChangeToken({
        token,
        swapTypeSwitchValue,
        toToken,
      });
      if (needChangeToToken && !disableCheckToToken) {
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

  selectToToken = contextAtomMethod(async (get, set, token: ISwapToken) => {
    this.cleanManualSelectQuoteProviders.call(set);
    this.resetSwapSlippage.call(set);
    await this.syncNetworksSort.call(set, token.networkId);
    set(swapSelectToTokenAtom(), token);
  });

  alternationToken = contextAtomMethod((get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    if (!fromToken && !toToken) {
      return;
    }
    set(swapSelectFromTokenAtom(), toToken);
    set(swapSelectToTokenAtom(), fromToken);
    this.resetSwapSlippage.call(set);
    this.cleanManualSelectQuoteProviders.call(set);
  });

  tokenListFetchAction = contextAtomMethod(
    async (get, set, params: IFetchTokensParams) => {
      try {
        if (!params.networkId) return;
        set(swapTokenFetchingAtom(), true);
        const result = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
          ...params,
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
      fromTokenAmount: string,
      slippagePercentage: number,
      autoSlippage?: boolean,
      address?: string,
      accountId?: string,
      loadingDelayEnable?: boolean,
      blockNumber?: number,
    ) => {
      const shouldRefreshQuote = get(swapShouldRefreshQuoteAtom());
      if (shouldRefreshQuote) {
        this.cleanQuoteInterval();
        set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
        return;
      }
      await backgroundApiProxy.serviceSwap.setApprovingTransaction(undefined);
      let enableInterval = true;
      try {
        if (!loadingDelayEnable) {
          set(swapQuoteFetchingAtom(), true);
        }
        const res = await backgroundApiProxy.serviceSwap.fetchQuotes({
          fromToken,
          toToken,
          fromTokenAmount,
          userAddress: address,
          slippagePercentage,
          autoSlippage,
          blockNumber,
          accountId,
        });
        if (!loadingDelayEnable) {
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteListAtom(), res);
          set(swapQuoteEventTotalCountAtom(), res.length);
        } else {
          set(swapSilenceQuoteLoading(), true);
          setTimeout(() => {
            set(swapSilenceQuoteLoading(), false);
            set(swapQuoteListAtom(), res);
            set(swapQuoteEventTotalCountAtom(), res.length);
          }, 800);
        }
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e?.cause !== ESwapFetchCancelCause.SWAP_QUOTE_CANCEL) {
          set(swapQuoteFetchingAtom(), false);
        } else {
          enableInterval = false;
        }
      } finally {
        set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
        if (enableInterval) {
          const quoteIntervalCount = get(swapQuoteIntervalCountAtom());
          if (quoteIntervalCount <= swapQuoteIntervalMaxCount) {
            void this.recoverQuoteInterval.call(set, address, accountId, true);
          }
          set(swapQuoteIntervalCountAtom(), quoteIntervalCount + 1);
        }
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
          set(swapQuoteListAtom(), []);
          set(swapQuoteEventTotalCountAtom(), 0);
          break;
        }
        case 'message': {
          const { data } = event.event as IEventSourceMessageEvent;
          if (data) {
            const dataJson = JSON.parse(data) as ISwapQuoteEventData;
            const autoSlippageData = dataJson as ISwapQuoteEventAutoSlippage;
            if (autoSlippageData?.autoSuggestedSlippage) {
              const {
                autoSuggestedSlippage,
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
              });
            } else if (
              (dataJson as ISwapQuoteEventInfo).totalQuoteCount ||
              (dataJson as ISwapQuoteEventInfo).totalQuoteCount === 0
            ) {
              const { totalQuoteCount } = dataJson as ISwapQuoteEventInfo;
              set(swapQuoteEventTotalCountAtom(), totalQuoteCount);
              if (totalQuoteCount === 0) {
                set(swapQuoteListAtom(), [
                  {
                    info: { provider: '', providerName: '' },
                    fromTokenInfo: event.tokenPairs.fromToken,
                    toTokenInfo: event.tokenPairs.toToken,
                  },
                ]);
              }
            } else {
              const quoteResultData = dataJson as ISwapQuoteEventQuoteResult;
              const swapAutoSlippageSuggestedValue = get(
                swapAutoSlippageSuggestedValueAtom(),
              );
              if (quoteResultData.data?.length) {
                const quoteResultsUpdateSlippage = quoteResultData.data.map(
                  (quote) => {
                    if (
                      `${quote.fromTokenInfo.networkId}-${quote.fromTokenInfo.contractAddress}` ===
                        swapAutoSlippageSuggestedValue?.from &&
                      `${quote.toTokenInfo.networkId}-${quote.toTokenInfo.contractAddress}` ===
                        swapAutoSlippageSuggestedValue?.to &&
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
                newQuoteList = [...newQuoteList, ...newAddQuoteRes].filter(
                  (quote) => !!quote.info.provider,
                );
                set(swapQuoteListAtom(), [...newQuoteList]);
              }
              set(swapQuoteFetchingAtom(), false);
            }
          }
          break;
        }
        case 'done': {
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          const quoteIntervalCount = get(swapQuoteIntervalCountAtom());
          if (quoteIntervalCount <= swapQuoteIntervalMaxCount) {
            void this.recoverQuoteInterval.call(
              set,
              event.params.userAddress,
              event.accountId,
              true,
            );
          }
          set(swapQuoteIntervalCountAtom(), quoteIntervalCount + 1);
          this.closeQuoteEvent();
          break;
        }
        case 'error': {
          this.closeQuoteEvent();
          break;
        }
        case 'close': {
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
      fromTokenAmount: string,
      slippagePercentage: number,
      autoSlippage?: boolean,
      address?: string,
      accountId?: string,
      blockNumber?: number,
    ) => {
      const shouldRefreshQuote = get(swapShouldRefreshQuoteAtom());
      if (shouldRefreshQuote) {
        this.cleanQuoteInterval();
        set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
        return;
      }
      await backgroundApiProxy.serviceSwap.setApprovingTransaction(undefined);
      set(swapQuoteFetchingAtom(), true);
      await backgroundApiProxy.serviceSwap.fetchQuotesEvents({
        fromToken,
        toToken,
        fromTokenAmount,
        userAddress: address,
        slippagePercentage,
        autoSlippage,
        blockNumber,
        accountId,
      });
    },
  );

  quoteAction = contextAtomMethod(
    async (
      get,
      set,
      address?: string,
      accountId?: string,
      blockNumber?: number,
    ) => {
      const fromToken = get(swapSelectFromTokenAtom());
      const toToken = get(swapSelectToTokenAtom());
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      set(swapQuoteActionLockAtom(), (v) => ({
        ...v,
        actionLock: true,
        fromToken,
        toToken,
        fromTokenAmount,
        accountId,
        address,
      }));
      this.cleanQuoteInterval();
      this.closeQuoteEvent();
      set(swapQuoteIntervalCountAtom(), 0);
      set(swapBuildTxFetchingAtom(), false);
      set(swapShouldRefreshQuoteAtom(), false);
      const { slippageItem } = get(swapSlippagePercentageAtom());
      const fromTokenAmountNumber = Number(fromTokenAmount);
      if (
        fromToken &&
        toToken &&
        !Number.isNaN(fromTokenAmountNumber) &&
        fromTokenAmountNumber > 0
      ) {
        void this.runQuoteEvent.call(
          set,
          fromToken,
          toToken,
          fromTokenAmount,
          slippageItem.value,
          slippageItem.key === ESwapSlippageSegmentKey.AUTO,
          address,
          accountId,
          blockNumber,
        );
      } else {
        set(swapQuoteFetchingAtom(), false);
        set(swapQuoteEventTotalCountAtom(), 0);
        set(swapQuoteListAtom(), []);
        set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
      }
    },
  );

  approvingStateRunSync = contextAtomMethod(
    async (get, set, networkId: string, txId: string) => {
      let enableInterval = true;
      try {
        const txState = await backgroundApiProxy.serviceSwap.fetchTxState({
          txId,
          networkId,
        });
        const preApproveTx =
          await backgroundApiProxy.serviceSwap.getApprovingTransaction();
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
              await backgroundApiProxy.serviceSwap.setApprovingTransaction(
                newApproveTx,
              );
            }
          }
          if (txState.state !== ESwapTxHistoryStatus.SUCCESS) {
            set(swapBuildTxFetchingAtom(), false);
          }
        } else if (
          preApproveTx &&
          preApproveTx.status !== ESwapApproveTransactionStatus.PENDING
        ) {
          await backgroundApiProxy.serviceSwap.setApprovingTransaction({
            ...preApproveTx,
            status: ESwapApproveTransactionStatus.PENDING,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (enableInterval) {
          this.approvingIntervalCount += 1;
          void this.approvingStateAction.call(set);
        } else {
          this.cleanApprovingInterval();
          this.approvingIntervalCount = 0;
        }
      }
    },
  );

  approvingStateAction = contextAtomMethod(async (get, set) => {
    this.cleanApprovingInterval();
    const approvingTransaction =
      await backgroundApiProxy.serviceSwap.getApprovingTransaction();
    if (approvingTransaction && approvingTransaction.txId) {
      this.approvingInterval = setTimeout(() => {
        if (approvingTransaction.txId) {
          void this.approvingStateRunSync.call(
            set,
            approvingTransaction.fromToken.networkId,
            approvingTransaction.txId,
          );
        }
      }, swapApprovingStateFetchInterval * (Math.floor(this.approvingIntervalCount / swapHistoryStateFetchRiceIntervalCount) + 1));
    }
  });

  recoverQuoteInterval = contextAtomMethod(
    async (
      get,
      set,
      address?: string,
      accountId?: string,
      unResetCount?: boolean,
    ) => {
      const { actionLock: swapQuoteActionLock } = get(
        swapQuoteActionLockAtom(),
      );
      if (swapQuoteActionLock) {
        return;
      }
      this.cleanQuoteInterval();
      if (!unResetCount) {
        set(swapQuoteIntervalCountAtom(), 0);
      }
      set(swapBuildTxFetchingAtom(), false);
      set(swapQuoteFetchingAtom(), false);
      const currentApproveTx =
        await backgroundApiProxy.serviceSwap.getApprovingTransaction();
      if (currentApproveTx?.status === ESwapApproveTransactionStatus.PENDING) {
        void backgroundApiProxy.serviceSwap.setApprovingTransaction({
          ...currentApproveTx,
          status: ESwapApproveTransactionStatus.CANCEL,
        });
      }
      const fromToken = get(swapSelectFromTokenAtom());
      const toToken = get(swapSelectToTokenAtom());
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      const { slippageItem } = get(swapSlippagePercentageAtom());
      const fromTokenAmountNumber = Number(fromTokenAmount);
      if (
        fromToken &&
        toToken &&
        !Number.isNaN(fromTokenAmountNumber) &&
        fromTokenAmountNumber > 0
      ) {
        this.quoteInterval = setTimeout(() => {
          void this.runQuote.call(
            set,
            fromToken,
            toToken,
            fromTokenAmount,
            slippageItem.value,
            slippageItem.key === ESwapSlippageSegmentKey.AUTO,
            address,
            accountId,
            true,
          );
        }, swapQuoteFetchInterval);
      }
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

  cleanApprovingInterval = () => {
    if (this.approvingInterval) {
      clearTimeout(this.approvingInterval);
      this.approvingInterval = undefined;
    }
  };

  checkAddressNeedCreate = (
    swapSupportAllNetworks: ISwapNetwork[],
    fromToken: ISwapToken,
    addressInfo: ReturnType<typeof useSwapAddressInfo>,
  ) => {
    const netInfo = swapSupportAllNetworks.find(
      (net) => net.networkId === fromToken.networkId,
    );
    const networkId = addressInfo.accountInfo?.network?.id;
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
      title: appLocale.intl.formatMessage(
        {
          id: ETranslations.swap_page_no_address,
        },
        { network: netInfo?.name ?? '' },
      ),
      message: appLocale.intl.formatMessage({
        id: ETranslations.swap_page_create_to_enable_network,
      }),
      alertLevel: ESwapAlertLevel.INFO,
      action: {
        actionType: ESwapAlertActionType.CREATE_ADDRESS,
        actionLabel: appLocale.intl.formatMessage({
          id: ETranslations.global_create,
        }),
        actionData: {
          num: 0,
          key,
          account,
        } as ISwapAlertActionData,
      },
    } as ISwapAlertState;
  };

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
      const quoteResultList = get(swapQuoteListAtom());
      const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      let alertsRes: ISwapAlertState[] = [];
      let rateDifferenceRes:
        | { value: string; unit: ESwapRateDifferenceUnit }
        | undefined;

      // current quote result  current token  not match
      if (
        quoteResult &&
        fromToken &&
        toToken &&
        (quoteResult?.fromTokenInfo?.networkId !== fromToken?.networkId ||
          quoteResult?.toTokenInfo?.networkId !== toToken?.networkId ||
          quoteResult?.fromTokenInfo?.contractAddress !==
            fromToken?.contractAddress ||
          quoteResult?.toTokenInfo?.contractAddress !==
            toToken?.contractAddress)
      ) {
        return;
      }

      if (
        !networks.length ||
        !swapFromAddressInfo.accountInfo?.ready ||
        (quoteEventTotalCount > 0 &&
          quoteResultList.length < quoteEventTotalCount)
      ) {
        return;
      }
      // check account
      if (!swapFromAddressInfo.accountInfo?.wallet) {
        alertsRes = [
          ...alertsRes,
          {
            message: appLocale.intl.formatMessage({
              id: ETranslations.swap_page_button_no_connected_wallet,
            }),
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
        set(swapAlertsAtom(), {
          states: alertsRes,
          quoteId: quoteResult?.quoteId ?? '',
        });
        return;
      }

      if (
        fromToken &&
        ((!swapFromAddressInfo.address &&
          !accountUtils.isHdWallet({
            walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          }) &&
          !accountUtils.isHwWallet({
            walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          })) ||
          accountUtils.isWatchingWallet({
            walletId: swapFromAddressInfo.accountInfo.wallet.id,
          }))
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: appLocale.intl.formatMessage({
              id: ETranslations.swap_page_alert_account_does_not_support_swap,
            }),
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      // check from address
      if (
        fromToken &&
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
        );
        alertsRes = [...alertsRes, alertAction];
      }
      // check to address
      if (
        toToken &&
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
          );
          alertsRes = [...alertsRes, alertAction];
        }
      }

      // if (quoteResult?.toAmount && !quoteResult.isBest) {
      //   // provider best check
      //   alertsRes = [
      //     ...alertsRes,
      //     {
      //       message: appLocale.intl.formatMessage({
      //         id: ETranslations.swap_page_alert_not_best_rate,
      //       }),
      //       alertLevel: ESwapAlertLevel.WARNING,
      //     },
      //   ];
      // }

      // market rate check
      if (fromToken?.price && toToken?.price && quoteResult?.instantRate) {
        const fromTokenPrice = new BigNumber(fromToken.price);
        const toTokenPrice = new BigNumber(toToken.price);
        if (!fromTokenPrice.isZero() && !toTokenPrice.isZero()) {
          const marketingRate = fromTokenPrice.dividedBy(toTokenPrice);
          const quoteRateBN = new BigNumber(quoteResult.instantRate);
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
              value: `(${difference.isPositive() ? '+' : ''}${
                numberFormat(difference.toFixed(), {
                  formatter: 'priceChange',
                }) as string
              })`,
              unit,
            };
          }
          if (quoteRateBN.isZero()) {
            alertsRes = [
              ...alertsRes,
              {
                title: appLocale.intl.formatMessage(
                  { id: ETranslations.swap_page_alert_value_drop_title },
                  { number: '100%' },
                ),
                message: appLocale.intl.formatMessage({
                  id: ETranslations.swap_page_alert_value_drop,
                }),
                alertLevel: ESwapAlertLevel.WARNING,
                icon: 'ActivityOutline',
                action: {
                  actionType: ESwapAlertActionType.TOKEN_DETAIL_FETCHING,
                },
              },
            ];
          } else if (difference.lt(swapRateDifferenceMax)) {
            alertsRes = [
              ...alertsRes,
              {
                title: appLocale.intl.formatMessage(
                  {
                    id: ETranslations.swap_page_alert_value_drop_title,
                  },
                  {
                    number: numberFormat(difference.absoluteValue().toFixed(), {
                      formatter: 'priceChange',
                    }) as string,
                  },
                ),
                message: appLocale.intl.formatMessage({
                  id: ETranslations.swap_page_alert_value_drop,
                }),
                alertLevel: ESwapAlertLevel.WARNING,
                icon: 'ActivityOutline',
                action: {
                  actionType: ESwapAlertActionType.TOKEN_DETAIL_FETCHING,
                },
              },
            ];
          }
        }
      }

      const fromTokenAmountBN = new BigNumber(fromTokenAmount);
      // check min max amount
      if (quoteResult && quoteResult.limit?.min) {
        const minAmountBN = new BigNumber(quoteResult.limit.min);
        if (fromTokenAmountBN.lt(minAmountBN)) {
          alertsRes = [
            ...alertsRes,
            {
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

      const fromTokenPriceBN = new BigNumber(fromToken?.price ?? 0);
      const tokenFiatValueBN = fromTokenAmountBN.multipliedBy(fromTokenPriceBN);

      // check network fee
      const gasFeeBN = new BigNumber(
        quoteResult?.fee?.estimatedFeeFiatValue ?? 0,
      );
      if (
        !(tokenFiatValueBN.isNaN() || tokenFiatValueBN.isZero()) &&
        gasFeeBN.gt(tokenFiatValueBN)
      ) {
        alertsRes = [
          ...alertsRes,
          {
            icon: 'GasOutline',
            title: appLocale.intl.formatMessage({
              id: ETranslations.swap_page_alert_fee_exceeds_amount_title,
            }),
            message: appLocale.intl.formatMessage({
              id: ETranslations.swap_page_alert_fee_exceeds_amount,
            }),
            alertLevel: ESwapAlertLevel.WARNING,
            action: {
              actionType: ESwapAlertActionType.TOKEN_DETAIL_FETCHING,
            },
          },
        ];
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
              title: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_tax_detected_title,
                },
                {
                  percentage: `${showTax.dividedBy(100).toNumber()}%`,
                  token: `${toToken?.symbol ?? ''}`,
                  action: `${actionLabel}`,
                },
              ),
              message: appLocale.intl.formatMessage({
                id: ETranslations.swap_page_alert_tax_detected,
              }),
              alertLevel: ESwapAlertLevel.INFO,
            },
          ];
        }
        if (sellTokenBuyTaxBN.gt(0) || sellTokenSellTaxBN.gt(0)) {
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
              title: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_tax_detected_title,
                },
                {
                  percentage: `${showTax.dividedBy(100).toNumber()}%`,
                  token: `${fromToken?.symbol ?? ''}`,
                  action: `${actionLabel}`,
                },
              ),
              message: appLocale.intl.formatMessage({
                id: ETranslations.swap_page_alert_tax_detected,
              }),
              alertLevel: ESwapAlertLevel.INFO,
            },
          ];
        }
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
      const accountAddress = swapAddressInfo.address;
      const accountNetworkId = swapAddressInfo.networkId;
      const accountId = swapAddressInfo.accountInfo?.account?.id;
      let balanceDisplay;
      if (
        token &&
        accountAddress &&
        accountNetworkId &&
        accountNetworkId === token?.networkId
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
              if (
                detailInfo[0].price &&
                detailInfo[0].fiatValue &&
                detailInfo[0].balanceParsed
              ) {
                if (type === ESwapDirectionType.FROM) {
                  set(swapSelectFromTokenAtom(), (pre) => {
                    if (pre) {
                      return {
                        ...pre,
                        price: detailInfo[0].price,
                        fiatValue: detailInfo[0].fiatValue,
                        balanceParsed: detailInfo[0].balanceParsed,
                        reservationValue: detailInfo[0].reservationValue,
                        accountAddress,
                      };
                    }
                  });
                } else {
                  set(swapSelectToTokenAtom(), (pre) => {
                    if (pre) {
                      return {
                        ...pre,
                        price: detailInfo[0].price,
                        fiatValue: detailInfo[0].fiatValue,
                        balanceParsed: detailInfo[0].balanceParsed,
                        reservationValue: detailInfo[0].reservationValue,
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
      if (equalTokenNoCaseSensitive({ token1: newToken, token2: token })) {
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
    ) => {
      const result = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
        networkId: accountNetworkId,
        accountNetworkId,
        accountAddress,
        accountId,
        onlyAccountTokens: true,
        isAllNetworkFetchAccountTokens: true,
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
    ) => {
      const swapAllNetworkActionLock = get(swapAllNetworkActionLockAtom());
      if (swapAllNetworkActionLock) {
        return;
      }
      const swapSupportNetworks = get(swapNetworks());
      const { accountIdKey, swapSupportAccounts } =
        await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
          indexedAccountId,
          otherWalletTypeAccountId,
          swapSupportNetworks,
        });
      if (swapSupportAccounts.length > 0) {
        set(swapAllNetworkActionLockAtom(), true);
        const currentSwapAllNetworkTokenList = get(
          swapAllNetworkTokenListMapAtom(),
        )[accountIdKey];
        const accountAddressList = swapSupportAccounts.filter(
          (item) => item.apiAddress,
        );
        const requests = accountAddressList.map((networkDataString) => {
          const {
            apiAddress,
            networkId: accountNetworkId,
            accountId,
          } = networkDataString;
          return this.updateAllNetworkTokenList.call(
            set,
            accountNetworkId,
            accountId,
            apiAddress,
            !currentSwapAllNetworkTokenList,
            indexedAccountId ?? otherWalletTypeAccountId ?? '',
          );
        });

        if (!currentSwapAllNetworkTokenList) {
          await Promise.all(requests);
        } else {
          const result = await Promise.all(requests);
          const allTokensResult = (result.filter(Boolean) ?? []).flat();
          set(swapAllNetworkTokenListMapAtom(), (v) => ({
            ...v,
            [accountIdKey]: allTokensResult,
          }));
        }
        set(swapAllNetworkActionLockAtom(), false);
      } else {
        set(swapAllNetworkTokenListMapAtom(), (v) => ({
          ...v,
          [accountIdKey]: [],
        }));
      }
    },
  );

  swapTypeSwitchAction = contextAtomMethod(
    async (
      get,
      set,
      type: ESwapTabSwitchType,
      swapAccountNetworkId?: string,
    ) => {
      set(swapTypeSwitchAtom(), type);
      this.cleanManualSelectQuoteProviders.call(set);
      this.resetSwapSlippage.call(set);
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
                fromNetworkDefault.fromToken?.networkId,
              );
            } else if (
              fromToken?.isNative &&
              fromNetworkDefault.toToken &&
              !fromNetworkDefault.toToken.isNative
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
        }
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
  const recoverQuoteInterval = actions.recoverQuoteInterval.use();
  const quoteAction = actions.quoteAction.use();
  const approvingStateAction = actions.approvingStateAction.use();
  const checkSwapWarning = debounce(actions.checkSwapWarning.use(), 300, {
    leading: true,
  });
  const tokenListFetchAction = actions.tokenListFetchAction.use();
  const quoteEventHandler = actions.quoteEventHandler.use();
  const loadSwapSelectTokenDetail = debounce(
    actions.loadSwapSelectTokenDetail.use(),
    200,
    {
      leading: true,
    },
  );
  const swapLoadAllNetworkTokenList = actions.swapLoadAllNetworkTokenList.use();
  const swapTypeSwitchAction = actions.swapTypeSwitchAction.use();
  const { cleanQuoteInterval, cleanApprovingInterval, closeQuoteEvent } =
    actions;

  return useRef({
    selectFromToken,
    quoteAction,
    selectToToken,
    alternationToken,
    syncNetworksSort,
    catchSwapTokensMap,
    cleanQuoteInterval,
    cleanApprovingInterval,
    approvingStateAction,
    tokenListFetchAction,
    recoverQuoteInterval,
    checkSwapWarning,
    loadSwapSelectTokenDetail,
    quoteEventHandler,
    swapLoadAllNetworkTokenList,
    closeQuoteEvent,
    swapTypeSwitchAction,
  });
};
