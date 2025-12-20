import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  ESwapProJumpTokenDirection,
  useSwapProJumpTokenAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigNetwork,
  IMarketTokenTransaction,
} from '@onekeyhq/shared/types/marketV2';
import {
  swapProPositionsListMaxCount,
  swapProPositionsListMinValue,
  wrappedTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useCurrency } from '../../../components/Currency';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceFromAmountAtom,
  useSwapLimitPriceToAmountAtom,
  useSwapProDirectionAtom,
  useSwapProEnableCurrentSymbolAtom,
  useSwapProErrorAlertAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProSupportNetworksTokenListAtom,
  useSwapProTokenSupportLimitAtom,
  useSwapProTokenTransactionPriceAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSpeedQuoteResultAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { useMarketBasicConfig } from '../../Market/hooks';
import { useTransactionsWebSocket } from '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket';
import { useSpeedSwapInit } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapInit';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

import { useSwapSlippagePercentageModeInfo } from './useSwapState';

export function useSwapProInit() {
  const [, setSwapSwitchType] = useSwapTypeSwitchAtom();
  const [, setSwapProDirection] = useSwapProDirectionAtom();
  const { networkList } = useMarketBasicConfig();
  const [swapProSelectToken, setSwapProSelectToken] =
    useSwapProSelectTokenAtom();
  const [swapProJumpToken, setSwapProJumpToken] = useSwapProJumpTokenAtom();
  const swapSwitchProToken = useCallback(
    (payload: { token: ISwapToken }) => {
      setSwapSwitchType(ESwapTabSwitchType.LIMIT);
      setSwapProSelectToken(payload.token);
    },
    [setSwapSwitchType, setSwapProSelectToken],
  );
  const swapProSelectTokenRef = useRef<ISwapToken | undefined>(
    swapProSelectToken,
  );
  if (swapProSelectTokenRef.current !== swapProSelectToken) {
    swapProSelectTokenRef.current = swapProSelectToken;
  }
  const swapProJumpTokenRef = useRef<ISwapToken | undefined>(
    swapProJumpToken?.token,
  );
  if (swapProJumpTokenRef.current !== swapProJumpToken?.token) {
    swapProJumpTokenRef.current = swapProJumpToken?.token;
  }
  useEffect(() => {
    if (swapProJumpToken.token) {
      swapSwitchProToken({ token: swapProJumpToken.token });
      if (swapProJumpToken.direction === ESwapProJumpTokenDirection.SELL) {
        setSwapProDirection(ESwapDirection.SELL);
      } else {
        setSwapProDirection(ESwapDirection.BUY);
      }
      setSwapProJumpToken({
        token: undefined,
        direction: ESwapProJumpTokenDirection.BUY,
      });
    }
  }, [
    swapProJumpToken,
    swapSwitchProToken,
    setSwapProJumpToken,
    setSwapProDirection,
  ]);
  return {
    networkList,
  };
}

export function useSwapProInputToken() {
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProUseSelectBuyTokenAtom] = useSwapProUseSelectBuyTokenAtom();
  const inputToken = useMemo(() => {
    if (swapProDirection === ESwapDirection.BUY) {
      return swapProUseSelectBuyTokenAtom;
    }
    return swapProSelectToken;
  }, [swapProDirection, swapProUseSelectBuyTokenAtom, swapProSelectToken]);
  return inputToken;
}

export function useSwapProToToken() {
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProSellToTokenAtom] = useSwapProSellToTokenAtom();
  const toToken = useMemo(() => {
    if (swapProDirection === ESwapDirection.BUY) {
      return swapProSelectToken;
    }
    return swapProSellToTokenAtom;
  }, [swapProDirection, swapProSellToTokenAtom, swapProSelectToken]);
  return toToken;
}

export function useSwapProAccount() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const inputToken = useSwapProInputToken();
  const [selectMarketToken] = useSwapProSelectTokenAtom();
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const netAccountRes = usePromiseResult(async () => {
    try {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId:
            inputToken?.networkId ?? selectMarketToken?.networkId ?? '',
        });
      const res = await backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: activeAccount?.indexedAccount?.id
          ? undefined
          : activeAccount?.account?.id,
        indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
        networkId: inputToken?.networkId ?? selectMarketToken?.networkId ?? '',
        deriveType: defaultDeriveType ?? 'default',
      });
      return res;
    } catch (e) {
      return undefined;
    }
  }, [
    activeAccount?.account?.id,
    activeAccount?.indexedAccount?.id,
    inputToken?.networkId,
    selectMarketToken?.networkId,
  ]);

  useEffect(() => {
    if (
      selectMarketToken?.networkId &&
      swapTypeSwitch === ESwapTabSwitchType.LIMIT &&
      activeAccount?.network?.id !== selectMarketToken?.networkId &&
      platformEnv.isNative
    ) {
      void updateSelectedAccountNetwork({
        num: 0,
        networkId: selectMarketToken?.networkId,
      });
    }
  }, [
    activeAccount?.network?.id,
    selectMarketToken?.networkId,
    swapTypeSwitch,
    updateSelectedAccountNetwork,
  ]);

  return netAccountRes;
}

export function useSwapProTokenInfoSync() {
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [swapProSelectToken, setSwapProSelectToken] =
    useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProUseSelectBuyToken, setSwapProUseSelectBuyTokenAtom] =
    useSwapProUseSelectBuyTokenAtom();
  const [, setSwapProSellToToken] = useSwapProSellToTokenAtom();
  const netAccountRes = useSwapProAccount();
  const inputToken = useSwapProInputToken();
  const swapProSellToToken = useSwapProToToken();

  const syncInputTokenBalance = useCallback(async () => {
    if (
      !inputToken?.networkId ||
      !netAccountRes.result?.addressDetail.address ||
      !netAccountRes.result?.id
    ) {
      return;
    }
    setBalanceLoading(true);
    try {
      const balanceTokenInfo =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: inputToken?.networkId ?? '',
          contractAddress: inputToken?.contractAddress ?? '',
          accountAddress: netAccountRes.result?.addressDetail.address ?? '',
          accountId: netAccountRes.result?.id ?? '',
        });
      if (balanceTokenInfo?.length) {
        if (swapProDirection === ESwapDirection.BUY) {
          setSwapProUseSelectBuyTokenAtom((prev) =>
            prev
              ? {
                  ...prev,
                  balanceParsed: balanceTokenInfo[0].balanceParsed ?? '',
                  price: balanceTokenInfo[0].price ?? '',
                  fiatValue: balanceTokenInfo[0].fiatValue ?? '',
                  accountAddress:
                    netAccountRes.result?.addressDetail.address ?? '',
                }
              : undefined,
          );
        } else {
          setSwapProSelectToken((prev) =>
            prev
              ? {
                  ...prev,
                  balanceParsed: balanceTokenInfo[0].balanceParsed ?? '',
                  price: balanceTokenInfo[0].price ?? '',
                  fiatValue: balanceTokenInfo[0].fiatValue ?? '',
                  accountAddress:
                    netAccountRes.result?.addressDetail.address ?? '',
                }
              : undefined,
          );
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBalanceLoading(false);
    }
  }, [
    inputToken?.contractAddress,
    inputToken?.networkId,
    netAccountRes.result?.addressDetail.address,
    netAccountRes.result?.id,
    setSwapProSelectToken,
    setSwapProUseSelectBuyTokenAtom,
    swapProDirection,
  ]);
  const syncOrderTokenBalance = useCallback(async () => {
    if (
      !inputToken?.networkId ||
      !netAccountRes.result?.addressDetail.address ||
      !netAccountRes.result?.id
    ) {
      return;
    }
    setBalanceLoading(true);
    try {
      const [swapProSelectTokenDetail, swapProUseSelectBuyTokenDetail] =
        await Promise.all([
          backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: swapProSelectToken?.networkId ?? '',
            contractAddress: swapProSelectToken?.contractAddress ?? '',
            accountAddress: netAccountRes.result?.addressDetail.address ?? '',
            accountId: netAccountRes.result?.id ?? '',
          }),
          backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: swapProUseSelectBuyToken?.networkId ?? '',
            contractAddress: swapProUseSelectBuyToken?.contractAddress ?? '',
            accountAddress: netAccountRes.result?.addressDetail.address ?? '',
            accountId: netAccountRes.result?.id ?? '',
          }),
        ]);
      if (swapProSelectTokenDetail?.length) {
        setSwapProSelectToken((prev) =>
          prev
            ? {
                ...prev,
                balanceParsed: swapProSelectTokenDetail[0].balanceParsed ?? '',
                price: swapProSelectTokenDetail[0].price ?? '',
                fiatValue: swapProSelectTokenDetail[0].fiatValue ?? '',
                accountAddress:
                  netAccountRes.result?.addressDetail.address ?? '',
              }
            : undefined,
        );
      }
      if (swapProUseSelectBuyTokenDetail?.length) {
        setSwapProUseSelectBuyTokenAtom((prev) =>
          prev
            ? {
                ...prev,
                balanceParsed:
                  swapProUseSelectBuyTokenDetail[0].balanceParsed ?? '',
                price: swapProUseSelectBuyTokenDetail[0].price ?? '',
                fiatValue: swapProUseSelectBuyTokenDetail[0].fiatValue ?? '',
                accountAddress:
                  netAccountRes.result?.addressDetail.address ?? '',
              }
            : undefined,
        );
      }
      return {
        swapProSelectTokenDetail: swapProSelectTokenDetail?.[0],
        swapProUseSelectBuyTokenDetail: swapProUseSelectBuyTokenDetail?.[0],
      };
    } catch (e) {
      console.error(e);
    } finally {
      setBalanceLoading(false);
    }
  }, [
    inputToken?.networkId,
    netAccountRes.result?.addressDetail.address,
    netAccountRes.result?.id,
    setSwapProSelectToken,
    setSwapProUseSelectBuyTokenAtom,
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProUseSelectBuyToken?.contractAddress,
    swapProUseSelectBuyToken?.networkId,
  ]);

  const syncToTokenPrice = useCallback(async () => {
    if (swapProSellToToken?.networkId && !swapProSellToToken?.price) {
      const balanceTokenInfo =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: swapProSellToToken?.networkId ?? '',
          contractAddress: swapProSellToToken?.contractAddress ?? '',
        });
      if (balanceTokenInfo?.length) {
        setSwapProSellToToken((prev) =>
          prev
            ? { ...prev, price: balanceTokenInfo[0].price ?? '' }
            : undefined,
        );
      }
    }
  }, [
    setSwapProSellToToken,
    swapProSellToToken?.contractAddress,
    swapProSellToToken?.networkId,
    swapProSellToToken?.price,
  ]);
  return {
    syncOrderTokenBalance,
    syncInputTokenBalance,
    syncToTokenPrice,
    balanceLoading,
    netAccountRes,
  };
}

export function useSwapProTokenInit() {
  const [swapProSelectToken, setSwapProSelectToken] =
    useSwapProSelectTokenAtom();
  const [swapProTokenSupportLimit] = useSwapProTokenSupportLimitAtom();
  const [swapProJumpToken] = useSwapProJumpTokenAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSellToToken, setSwapProSellToToken] =
    useSwapProSellToTokenAtom();
  const [swapProUseSelectBuyTokenAtom, setSwapProUseSelectBuyTokenAtom] =
    useSwapProUseSelectBuyTokenAtom();
  const [swapProInputAmount] = useSwapProInputAmountAtom();
  const [swapFromInputAmount] = useSwapFromTokenAmountAtom();

  const {
    defaultTokens,
    defaultLimitTokens,
    isLoading,
    speedConfig,
    swapMevNetConfig,
    speedDefaultSelectToken,
    supportSpeedSwap,
  } = useSpeedSwapInit(swapProSelectToken?.networkId || '');

  const defaultTokensFromType = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return defaultTokens;
    }
    return defaultLimitTokens;
  }, [swapProTradeType, defaultTokens, defaultLimitTokens]);

  useEffect(() => {
    if (
      (!swapProUseSelectBuyTokenAtom && defaultTokensFromType.length > 0) ||
      !defaultTokensFromType.some((item) =>
        equalTokenNoCaseSensitive({
          token1: item,
          token2: swapProUseSelectBuyTokenAtom,
        }),
      )
    ) {
      setSwapProUseSelectBuyTokenAtom(defaultTokensFromType[0]);
    }
  }, [
    swapProSelectToken,
    swapProUseSelectBuyTokenAtom,
    setSwapProUseSelectBuyTokenAtom,
    defaultTokensFromType,
  ]);

  useEffect(() => {
    if (
      !swapProTokenSupportLimit &&
      swapProSelectToken &&
      swapProTradeType === ESwapProTradeType.LIMIT
    ) {
      setSwapProTradeType(ESwapProTradeType.MARKET);
    }
  }, [
    swapProTokenSupportLimit,
    swapProSelectToken,
    swapProTradeType,
    setSwapProTradeType,
  ]);

  useEffect(() => {
    if (
      !swapProJumpToken?.token &&
      !swapProSelectToken &&
      speedDefaultSelectToken
    ) {
      setSwapProSelectToken(speedDefaultSelectToken);
    }
  }, [
    swapProJumpToken,
    setSwapProSelectToken,
    speedDefaultSelectToken,
    swapProSelectToken,
  ]);

  useEffect(() => {
    if (
      (!swapProSellToToken && defaultTokensFromType.length > 0) ||
      !defaultTokensFromType.some((item) =>
        equalTokenNoCaseSensitive({
          token1: item,
          token2: swapProSellToToken,
        }),
      )
    ) {
      const nativeToken = defaultTokensFromType.find((item) => item.isNative);
      const wrappedToken = defaultTokensFromType.find((item) =>
        wrappedTokens.some(
          (wrapped) =>
            wrapped.address.toLowerCase() ===
              item.contractAddress.toLowerCase() &&
            wrapped.networkId === item.networkId,
        ),
      );
      if (nativeToken || wrappedToken) {
        if (swapProTradeType === ESwapProTradeType.MARKET && nativeToken) {
          setSwapProSellToToken(nativeToken);
        } else if (
          swapProTradeType === ESwapProTradeType.LIMIT &&
          wrappedToken
        ) {
          setSwapProSellToToken(wrappedToken);
        }
      } else {
        setSwapProSellToToken(defaultTokensFromType[0]);
      }
    }
  }, [
    defaultTokensFromType,
    setSwapProSellToToken,
    swapProSellToToken,
    swapProTradeType,
  ]);
  const inputToken = useSwapProInputToken();

  const {
    syncInputTokenBalance,
    syncToTokenPrice,
    balanceLoading,
    netAccountRes,
  } = useSwapProTokenInfoSync();

  useEffect(() => {
    if (
      (inputToken && !inputToken.balanceParsed) ||
      (inputToken as ISwapToken)?.accountAddress !==
        netAccountRes.result?.addressDetail.address
    ) {
      void syncInputTokenBalance();
    }
  }, [
    inputToken,
    syncInputTokenBalance,
    netAccountRes.result?.addressDetail.address,
  ]);

  useEffect(() => {
    if (swapProSellToToken && !swapProSellToToken.price) {
      void syncToTokenPrice();
    }
  }, [swapProSellToToken, syncToTokenPrice]);

  const isMEV = useMemo(() => {
    return swapMevNetConfig?.includes(swapProSelectToken?.networkId ?? '');
  }, [swapMevNetConfig, swapProSelectToken?.networkId]);

  const hasEnoughBalance = useMemo(() => {
    if (balanceLoading) {
      return true;
    }
    const inputAmountBN =
      swapProTradeType === ESwapProTradeType.MARKET
        ? new BigNumber(swapProInputAmount || '0')
        : new BigNumber(
            swapFromInputAmount.value ? swapFromInputAmount.value : '0',
          );
    if (inputAmountBN.isNaN() || inputAmountBN.isZero()) {
      return true;
    }
    const inputTokenBalanceBN = new BigNumber(inputToken?.balanceParsed || '0');
    return inputTokenBalanceBN.gte(inputAmountBN);
  }, [
    balanceLoading,
    swapProTradeType,
    swapProInputAmount,
    swapFromInputAmount.value,
    inputToken?.balanceParsed,
  ]);

  return {
    defaultTokensFromType,
    isLoading,
    balanceLoading,
    speedConfig,
    swapMevNetConfig,
    swapProSelectToken,
    isMEV,
    hasEnoughBalance,
    supportSpeedSwap,
  };
}

export function useSwapProTokenSearch(
  input: string,
  selectedNetworkId?: string,
) {
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTokenList, setSearchTokenList] = useState<
    (IMarketSearchV2Token & { networkLogoURI: string })[]
  >([]);
  const lastLoggedSearchRef = useRef<string>(''); // query__networkId
  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      if (!input) {
        setSearchTokenList([]);
        return;
      }
      setSearchLoading(true);
      try {
        const searchRes =
          await backgroundApiProxy.serviceUniversalSearch.universalSearchOfV2MarketToken(
            input,
          );
        if (isCancelled) {
          return;
        }
        const searchTokenParse = searchRes
          ?.map((t) => {
            const networkInfo = networkUtils.getLocalNetworkInfo(t.network);
            return {
              ...t,
              networkLogoURI: networkInfo?.logoURI ?? '',
            };
          })
          .filter((t) => !t.isNative);
        const finalList = searchTokenParse ?? [];
        setSearchTokenList(finalList);

        const queryLength = input.length;
        const currentNetworkId = selectedNetworkId ?? '';
        const logKey = `${input}__${currentNetworkId}`;
        if (
          queryLength >= 1 &&
          queryLength <= 10 &&
          lastLoggedSearchRef.current !== logKey
        ) {
          lastLoggedSearchRef.current = logKey;
          const networkInfo = selectedNetworkId
            ? networkUtils.getLocalNetworkInfo(selectedNetworkId)
            : undefined;
          const networkName =
            networkInfo?.name ?? selectedNetworkId ?? 'Market';
          defaultLogger.swap.tokenSelectorSearch.swapTokenSelectorSearch({
            query: input,
            resultCount: finalList.length,
            networkId: currentNetworkId,
            networkName,
            direction: ESwapDirectionType.FROM,
            from: 'pro',
          });
        }
      } catch (e) {
        if (!isCancelled) {
          console.error(e);
        }
      } finally {
        if (!isCancelled) {
          setSearchLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [input, selectedNetworkId]);
  return {
    searchLoading,
    searchTokenList,
  };
}

export function useSwapProTokenDetailInfo() {
  const { swapProTokenMarketDetailFetchAction } = useSwapActions().current;
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const fetchTokenMarketDetailInfo = useCallback(async () => {
    if (swapProSelectToken?.networkId) {
      void swapProTokenMarketDetailFetchAction(
        swapProSelectToken?.contractAddress,
        swapProSelectToken?.networkId,
      );
    }
  }, [
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProTokenMarketDetailFetchAction,
  ]);
  usePromiseResult(
    async () => {
      await fetchTokenMarketDetailInfo();
    },
    [fetchTokenMarketDetailInfo],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 10 }),
    },
  );

  return {
    fetchTokenMarketDetailInfo,
  };
}

export function useSwapProTokenTransactionList(
  tokenAddress: string,
  networkId: string,
  enableWebSocket: boolean,
) {
  const currencyInfo = useCurrency();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [, setSwapProTokenTransactionPrice] =
    useSwapProTokenTransactionPriceAtom();
  const transactionListPageSize = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      return 10;
    }
    return 4;
  }, [swapProTradeType]);
  const transactionListPageSizeRef = useRef(transactionListPageSize);
  if (transactionListPageSizeRef.current !== transactionListPageSize) {
    transactionListPageSizeRef.current = transactionListPageSize;
  }
  const [swapProTokenTransactionList, setSwapProTokenTransactionList] =
    useState<IMarketTokenTransaction[]>([]);
  const swapProTokenTransactionListRef = useRef<IMarketTokenTransaction[]>(
    swapProTokenTransactionList,
  );
  if (swapProTokenTransactionListRef.current !== swapProTokenTransactionList) {
    swapProTokenTransactionListRef.current = [...swapProTokenTransactionList];
  }
  const {
    result: transactionsData,
    isLoading: isRefreshing,
    run: fetchTransactions,
  } = usePromiseResult(
    async () => {
      if (!networkId) {
        return undefined;
      }
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenTransactions({
          tokenAddress,
          networkId,
          limit: transactionListPageSize,
        });
      return response;
    },
    [tokenAddress, networkId, transactionListPageSize],
    {
      watchLoading: true,
    },
  );
  useEffect(() => {
    const newTransactions = transactionsData?.list;
    if (!newTransactions || newTransactions.length === 0) {
      setSwapProTokenTransactionList([]);
      return;
    }
    setSwapProTokenTransactionList(newTransactions);
    setSwapProTokenTransactionPrice(newTransactions[0].to.price ?? '');
  }, [transactionsData?.list, setSwapProTokenTransactionPrice]);

  const addNewTransaction = useCallback(
    (newTransaction: IMarketTokenTransaction) => {
      const prev = swapProTokenTransactionListRef.current;
      // Check if transaction already exists to avoid duplicates
      const existingIndex = prev.findIndex(
        (tx) => tx.hash === newTransaction.hash,
      );

      if (existingIndex !== -1) {
        return;
      }

      // Add new transaction at the beginning and sort by timestamp
      const updatedTransactions = [newTransaction, ...prev]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, transactionListPageSizeRef.current);
      setSwapProTokenTransactionList(updatedTransactions);
      setSwapProTokenTransactionPrice(updatedTransactions[0].to.price ?? '');
    },
    [setSwapProTokenTransactionPrice],
  );

  // Subscribe to real-time transaction updates
  // Only enable if websocket.txs is enabled and other conditions are met
  useTransactionsWebSocket({
    networkId,
    tokenAddress,
    enabled: enableWebSocket,
    currency: currencyInfo.id,
    onNewTransaction: addNewTransaction,
  });

  return {
    swapProTokenTransactionList,
    isRefreshing,
    fetchTransactions,
  };
}

export function useSwapProSupportNetworksTokenList(
  networkList: IMarketBasicConfigNetwork[],
) {
  const { swapProLoadSupportNetworksTokenList } = useSwapActions().current;
  const [swapSelectToken] = useSwapProSelectTokenAtom();
  const [swapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { syncOrderTokenBalance } = useSwapProTokenInfoSync();
  const [swapProSupportNetworksTokenList, setSwapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const swapProSelectTokenRef = useRef(swapSelectToken);
  if (swapProSelectTokenRef.current !== swapSelectToken) {
    swapProSelectTokenRef.current = swapSelectToken;
  }
  const swapProUseSelectBuyTokenRef = useRef(swapProUseSelectBuyToken);
  if (swapProUseSelectBuyTokenRef.current !== swapProUseSelectBuyToken) {
    swapProUseSelectBuyTokenRef.current = swapProUseSelectBuyToken;
  }
  const swapProSupportNetworksTokenListRef = useRef(
    swapProSupportNetworksTokenList,
  );
  if (
    swapProSupportNetworksTokenListRef.current !==
    swapProSupportNetworksTokenList
  ) {
    swapProSupportNetworksTokenListRef.current = [
      ...swapProSupportNetworksTokenList,
    ];
  }
  const swapProLoadSupportNetworksTokenListRun = useCallback(async () => {
    if (networkList.length > 0 && activeAccount) {
      await swapProLoadSupportNetworksTokenList(
        networkList.map((item) => ({
          networkId: item.networkId,
          symbol: item.name,
          name: item.name,
        })),
        activeAccount.indexedAccount?.id,
        !activeAccount?.indexedAccount?.id
          ? activeAccount?.account?.id ?? activeAccount?.dbAccount?.id
          : undefined,
      );
    }
  }, [networkList, activeAccount, swapProLoadSupportNetworksTokenList]);
  useEffect(() => {
    void swapProLoadSupportNetworksTokenListRun();
  }, [swapProLoadSupportNetworksTokenListRun, activeAccount]);

  const checkSyncOrderTokenBalance = useCallback(
    async ({
      orderFromToken,
      orderToToken,
    }: {
      orderFromToken: ISwapTokenBase;
      orderToToken: ISwapTokenBase;
    }) => {
      if (
        swapProSelectTokenRef.current?.networkId &&
        swapProUseSelectBuyTokenRef.current?.networkId &&
        (equalTokenNoCaseSensitive({
          token1: swapProSelectTokenRef.current,
          token2: orderFromToken,
        }) ||
          equalTokenNoCaseSensitive({
            token1: swapProUseSelectBuyTokenRef.current,
            token2: orderFromToken,
          }) ||
          equalTokenNoCaseSensitive({
            token1: swapProSelectTokenRef.current,
            token2: orderToToken,
          }) ||
          equalTokenNoCaseSensitive({
            token1: swapProUseSelectBuyTokenRef.current,
            token2: orderToToken,
          }))
      ) {
        const balanceTokensInfoRes = await syncOrderTokenBalance();
        if (balanceTokensInfoRes) {
          const newSwapProSelectTokenDetail =
            balanceTokensInfoRes.swapProSelectTokenDetail;
          const newSwapProUseSelectBuyTokenDetail =
            balanceTokensInfoRes.swapProUseSelectBuyTokenDetail;

          // Update swapProSupportNetworksTokenList with the new token details
          const tokensToUpdate = [
            newSwapProSelectTokenDetail,
            newSwapProUseSelectBuyTokenDetail,
          ].filter(Boolean);

          if (tokensToUpdate.length > 0) {
            setSwapProSupportNetworksTokenList((prevList) => {
              let updatedList = [...prevList];

              for (const tokenDetail of tokensToUpdate) {
                if (tokenDetail) {
                  const existingIndex = updatedList.findIndex((token) =>
                    equalTokenNoCaseSensitive({
                      token1: token,
                      token2: tokenDetail,
                    }),
                  );

                  if (existingIndex !== -1) {
                    // Token exists, update balance, fiatValue and price
                    updatedList[existingIndex] = {
                      ...updatedList[existingIndex],
                      balanceParsed: tokenDetail.balanceParsed ?? '',
                      fiatValue: tokenDetail.fiatValue ?? '',
                      price: tokenDetail.price ?? '',
                    };
                  } else {
                    // Token doesn't exist, add it to the list
                    updatedList = [
                      ...updatedList,
                      {
                        ...tokenDetail,
                        balanceParsed: tokenDetail.balanceParsed ?? '',
                        fiatValue: tokenDetail.fiatValue ?? '',
                        price: tokenDetail.price ?? '',
                      } as ISwapToken,
                    ];
                  }
                }
              }

              return updatedList;
            });
          }
        }
      } else {
        void swapProLoadSupportNetworksTokenListRun();
      }
    },
    [
      syncOrderTokenBalance,
      setSwapProSupportNetworksTokenList,
      swapProLoadSupportNetworksTokenListRun,
    ],
  );

  useEffect(() => {
    appEventBus.off(
      EAppEventBusNames.SwapSpeedBalanceUpdate,
      checkSyncOrderTokenBalance,
    );
    appEventBus.on(
      EAppEventBusNames.SwapSpeedBalanceUpdate,
      checkSyncOrderTokenBalance,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapSpeedBalanceUpdate,
        checkSyncOrderTokenBalance,
      );
    };
  }, [checkSyncOrderTokenBalance]);

  return {
    swapProLoadSupportNetworksTokenListRun,
  };
}

export function useSwapProPositionsListFilter() {
  const [swapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const [swapProEnableCurrentSymbol] = useSwapProEnableCurrentSymbolAtom();
  const [swapProTokenSelect] = useSwapProSelectTokenAtom();
  const filterDefaultTokenList = useMemo(() => {
    const filterMinValueTokenList = swapProSupportNetworksTokenList.filter(
      (token) => {
        return new BigNumber(token.fiatValue || '0').gt(
          swapProPositionsListMinValue,
        );
      },
    );
    if (filterMinValueTokenList.length <= swapProPositionsListMaxCount) {
      return filterMinValueTokenList;
    }
    return filterMinValueTokenList.slice(0, swapProPositionsListMaxCount);
  }, [swapProSupportNetworksTokenList]);

  const finallyTokenList = useMemo(
    () =>
      swapProEnableCurrentSymbol
        ? swapProSupportNetworksTokenList.filter((token) =>
            equalTokenNoCaseSensitive({
              token1: token,
              token2: swapProTokenSelect,
            }),
          )
        : filterDefaultTokenList,
    [
      filterDefaultTokenList,
      swapProEnableCurrentSymbol,
      swapProSupportNetworksTokenList,
      swapProTokenSelect,
    ],
  );
  return {
    finallyTokenList,
  };
}

export function useSwapBuildTxInfo() {
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const swapProFromToken = useSwapProInputToken();
  const swapProToToken = useSwapProToToken();
  const [fromSelectTokenAtom] = useSwapSelectFromTokenAtom();
  const [toSelectTokenAtom] = useSwapSelectToTokenAtom();
  const [currentQuote] = useSwapQuoteCurrentSelectAtom();
  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  const currentQuoteRes = useMemo(() => {
    if (focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult;
    }
    return currentQuote;
  }, [focusSwapPro, swapProTradeType, currentQuote, swapProQuoteResult]);
  const fromSelectToken = useMemo(() => {
    if (focusSwapPro) {
      return swapProFromToken;
    }
    return fromSelectTokenAtom;
  }, [focusSwapPro, fromSelectTokenAtom, swapProFromToken]);
  const toSelectToken = useMemo(() => {
    if (focusSwapPro) {
      return swapProToToken;
    }
    return toSelectTokenAtom;
  }, [focusSwapPro, toSelectTokenAtom, swapProToToken]);

  const swapTypeFinal = useMemo(() => {
    if (focusSwapPro) {
      return swapProTradeType === ESwapProTradeType.LIMIT
        ? ESwapTabSwitchType.LIMIT
        : ESwapTabSwitchType.SWAP;
    }
    return swapTypeSwitch;
  }, [focusSwapPro, swapProTradeType, swapTypeSwitch]);
  return {
    currentQuoteRes,
    fromSelectToken,
    toSelectToken,
    swapTypeFinal,
  };
}

export function useSwapProActionsQuote() {
  const { quoteSpeedAction, cancelSpeedQuote, cleanSpeedQuote } =
    useSwapActions().current;
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();
  const [swapTradeType] = useSwapProTradeTypeAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const debounceInputAmount = useDebounce(swapProInputAmount, 300, {
    leading: true,
  });
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProUseSelectBuyTokenAtom] = useSwapProUseSelectBuyTokenAtom();
  const [swapProSellToTokenAtom] = useSwapProSellToTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const swapProAccount = useSwapProAccount();
  const slippageItemRef = useRef(slippageItem);
  if (slippageItemRef.current !== slippageItem) {
    slippageItemRef.current = slippageItem;
  }
  const enableSwapProMarketQuote = useMemo(
    () =>
      swapTabSwitchType === ESwapTabSwitchType.LIMIT &&
      swapTradeType === ESwapProTradeType.MARKET,
    [swapTabSwitchType, swapTradeType],
  );

  useEffect(() => {
    const debounceInputAmountBN = new BigNumber(debounceInputAmount ?? '0');
    if (
      enableSwapProMarketQuote &&
      swapProAccount.result?.addressDetail.address &&
      !debounceInputAmountBN.isNaN() &&
      debounceInputAmountBN.gt(0)
    ) {
      void quoteSpeedAction(
        slippageItemRef.current,
        swapProAccount.result?.addressDetail.address,
        swapProAccount.result?.id,
        swapProAccount.result?.addressDetail.address,
      );
    }
  }, [
    debounceInputAmount,
    quoteSpeedAction,
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProDirection,
    swapProUseSelectBuyTokenAtom?.contractAddress,
    swapProUseSelectBuyTokenAtom?.networkId,
    swapProSellToTokenAtom?.contractAddress,
    swapProSellToTokenAtom?.networkId,
    enableSwapProMarketQuote,
    swapProAccount.result?.addressDetail.address,
    swapProAccount.result?.id,
  ]);

  useEffect(() => {
    const debounceInputAmountBN = new BigNumber(debounceInputAmount || '0');
    if (debounceInputAmountBN.isNaN() || debounceInputAmountBN.lte(0)) {
      cancelSpeedQuote();
      void cleanSpeedQuote();
    }
  }, [cancelSpeedQuote, cleanSpeedQuote, debounceInputAmount]);

  useEffect(() => {
    if (
      !enableSwapProMarketQuote ||
      !swapProAccount.result?.addressDetail.address
    ) {
      setSwapProInputAmount('');
    }
  }, [
    cleanSpeedQuote,
    enableSwapProMarketQuote,
    setSwapProInputAmount,
    swapProAccount.result?.addressDetail.address,
  ]);

  return {
    quoteSpeedAction,
  };
}

export function useSwapProErrorAlert(networkNotSupported?: boolean) {
  const intl = useIntl();
  const [, setSwapProErrorAlert] = useSwapProErrorAlertAtom();
  const swapProAccount = useSwapProAccount();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const [swapCurrentQuote] = useSwapQuoteCurrentSelectAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const currentQuoteRes = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult;
    }
    return swapCurrentQuote;
  }, [swapProTradeType, swapProQuoteResult, swapCurrentQuote]);
  useEffect(() => {
    if (!swapProAccount.result?.addressDetail.address) {
      setSwapProErrorAlert({
        title: intl.formatMessage({
          id: ETranslations.swap_page_alert_account_does_not_support_swap,
        }),
      });
    } else if (networkNotSupported) {
      setSwapProErrorAlert({
        title: intl.formatMessage({
          id: ETranslations.dexmarket_swap_unsupported_title,
        }),
        message: intl.formatMessage({
          id: ETranslations.dexmarket_swap_unsupported_desc,
        }),
      });
    } else if (currentQuoteRes?.errorMessage) {
      setSwapProErrorAlert({
        title: currentQuoteRes?.errorMessage,
      });
    } else {
      setSwapProErrorAlert(undefined);
    }
  }, [
    currentQuoteRes,
    intl,
    networkNotSupported,
    setSwapProErrorAlert,
    swapProAccount.result?.addressDetail.address,
  ]);
}

export function useSwapLimitPriceCheck(
  fromToken?: ISwapToken,
  toToken?: ISwapToken,
) {
  const [swapLimitPriceFromAmount] = useSwapLimitPriceFromAmountAtom();
  const [swapLimitPriceToAmount] = useSwapLimitPriceToAmountAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapTypeSwitchValue] = useSwapTypeSwitchAtom();
  const [, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [, setToInputAmount] = useSwapToTokenAmountAtom();
  const swapProtoToToken = useSwapProToToken();
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  useEffect(() => {
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      swapLimitPriceFromAmount
    ) {
      setFromInputAmount({
        value: swapLimitPriceFromAmount,
        isInput: false,
      });
    }
  }, [setFromInputAmount, swapLimitPriceFromAmount, swapTypeSwitchValue]);

  useEffect(() => {
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      swapLimitPriceToAmount
    ) {
      setToInputAmount({
        value: swapLimitPriceToAmount,
        isInput: false,
      });
    }
  }, [
    setToInputAmount,
    swapLimitPriceToAmount,
    swapProTradeType,
    swapProtoToToken?.decimals,
    swapProtoToToken?.price,
    swapTypeSwitchValue,
  ]);

  useEffect(() => {
    if (
      swapTypeSwitchValue !== ESwapTabSwitchType.LIMIT ||
      checkWrappedTokenPair({
        fromToken,
        toToken,
      })
    ) {
      let toAmount = '';
      if (
        equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: swapQuoteCurrentSelect?.fromTokenInfo,
        }) &&
        equalTokenNoCaseSensitive({
          token1: toToken,
          token2: swapQuoteCurrentSelect?.toTokenInfo,
        })
      ) {
        toAmount = swapQuoteCurrentSelect?.toAmount ?? '';
      }
      if (
        checkWrappedTokenPair({
          fromToken,
          toToken,
        })
      ) {
        toAmount = swapQuoteCurrentSelect?.isWrapped
          ? swapQuoteCurrentSelect?.toAmount ?? ''
          : '';
      }
      setToInputAmount({
        value: toAmount,
        isInput: false,
      });
    }
  }, [
    swapQuoteCurrentSelect?.toAmount,
    swapQuoteCurrentSelect?.fromTokenInfo,
    swapQuoteCurrentSelect?.toTokenInfo,
    swapQuoteCurrentSelect?.isWrapped,
    setToInputAmount,
    setFromInputAmount,
    swapTypeSwitchValue,
    fromToken,
    toToken,
  ]);
}
