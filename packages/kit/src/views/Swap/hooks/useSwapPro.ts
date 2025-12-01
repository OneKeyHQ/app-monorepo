import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSwapProJumpTokenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useCurrency } from '../../../components/Currency';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { useMarketBasicConfig } from '../../Market/hooks';
import { useTransactionsWebSocket } from '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket';
import { useSpeedSwapInit } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapInit';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

export function useSwapProInit() {
  const [, setSwapSwitchType] = useSwapTypeSwitchAtom();
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
  const swapProSelectTokenRef = useRef<ISwapToken | undefined>(undefined);
  if (swapProSelectTokenRef.current !== swapProSelectToken) {
    swapProSelectTokenRef.current = swapProSelectToken;
  }
  const swapProJumpTokenRef = useRef<ISwapToken | undefined>(undefined);
  if (swapProJumpTokenRef.current !== swapProJumpToken.token) {
    swapProJumpTokenRef.current = swapProJumpToken.token;
  }
  useEffect(() => {
    if (swapProJumpToken.token) {
      swapSwitchProToken({ token: swapProJumpToken.token });
      setSwapProJumpToken({ token: undefined });
    }
  }, [swapProJumpToken, swapSwitchProToken, setSwapProJumpToken]);

  useListenTabFocusState(ETabRoutes.Swap, (isFocus: boolean) => {
    if (isFocus) {
      if (!swapProSelectTokenRef.current && !swapProJumpTokenRef.current) {
        setSwapProSelectToken(swapDefaultSetTokens['evm--1'].fromToken);
      }
    } else {
      swapProSelectTokenRef.current = undefined;
      swapProJumpTokenRef.current = undefined;
    }
  });
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

export function useSwapProAccount() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const inputToken = useSwapProInputToken();
  const netAccountRes = usePromiseResult(async () => {
    try {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: inputToken?.networkId ?? '',
        });
      const res = await backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: activeAccount?.indexedAccount?.id
          ? undefined
          : activeAccount?.account?.id,
        indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
        networkId: inputToken?.networkId ?? '',
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
  ]);
  return netAccountRes;
}

export function useSwapProTokenInit() {
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProSellToToken, setSwapProSellToToken] =
    useSwapProSellToTokenAtom();
  const [swapProUseSelectBuyTokenAtom, setSwapProUseSelectBuyTokenAtom] =
    useSwapProUseSelectBuyTokenAtom();
  const { defaultTokens, isLoading, speedConfig, swapMevNetConfig } =
    useSpeedSwapInit(swapProSelectToken?.networkId || '');
  const [balanceLoading, setBalanceLoading] = useState(false);
  useEffect(() => {
    if (!swapProUseSelectBuyTokenAtom && defaultTokens.length > 0) {
      setSwapProUseSelectBuyTokenAtom(defaultTokens[0]);
    }
  }, [
    swapProSelectToken,
    swapProUseSelectBuyTokenAtom,
    setSwapProUseSelectBuyTokenAtom,
    defaultTokens,
  ]);

  useEffect(() => {
    if (!swapProSellToToken && defaultTokens.length > 0) {
      const nativeToken = defaultTokens.find((item) => item.isNative);
      if (nativeToken) {
        setSwapProSellToToken(nativeToken);
      } else {
        setSwapProSellToToken(defaultTokens[0]);
      }
    }
  }, [defaultTokens, setSwapProSellToToken, swapProSellToToken]);
  const inputToken = useSwapProInputToken();

  const netAccountRes = useSwapProAccount();

  const syncInputTokenBalance = useCallback(async () => {
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
                }
              : undefined,
          );
        } else {
          setSwapProSellToToken((prev) =>
            prev
              ? {
                  ...prev,
                  balanceParsed: balanceTokenInfo[0].balanceParsed ?? '',
                  price: balanceTokenInfo[0].price ?? '',
                  fiatValue: balanceTokenInfo[0].fiatValue ?? '',
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
    setSwapProSellToToken,
    setSwapProUseSelectBuyTokenAtom,
    swapProDirection,
  ]);

  useEffect(() => {
    if (inputToken && !inputToken.balanceParsed) {
      void syncInputTokenBalance();
    }
  }, [inputToken, syncInputTokenBalance]);

  const isMEV = useMemo(() => {
    return swapMevNetConfig?.includes(swapProSelectToken?.networkId ?? '');
  }, [swapMevNetConfig, swapProSelectToken?.networkId]);

  return {
    defaultTokens,
    isLoading,
    balanceLoading,
    speedConfig,
    swapMevNetConfig,
    swapProSelectToken,
    isMEV,
  };
}

export function useSwapProTokenSearch(input: string) {
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTokenList, setSearchTokenList] = useState<
    (IMarketSearchV2Token & { networkLogoURI: string })[]
  >([]);
  useEffect(() => {
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
        const searchTokenParse = searchRes?.map((t) => {
          const networkInfo = networkUtils.getLocalNetworkInfo(t.network);
          return {
            ...t,
            networkLogoURI: networkInfo?.logoURI ?? '',
          };
        });
        setSearchTokenList(searchTokenParse ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setSearchLoading(false);
      }
    })();
  }, [input]);
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
  const transactionListPageSize = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      return 8;
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
  }, [transactionsData?.list]);

  const addNewTransaction = useCallback(
    (newTransaction: IMarketTokenTransaction) => {
      const prev = swapProTokenTransactionListRef.current;
      // Check if transaction already exists to avoid duplicates
      const existingIndex = prev.findIndex(
        (tx) => tx.hash === newTransaction.hash,
      );

      if (existingIndex !== -1) {
        return prev;
      }

      // Add new transaction at the beginning and sort by timestamp
      const updatedTransactions = [newTransaction, ...prev]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, transactionListPageSizeRef.current);
      setSwapProTokenTransactionList(updatedTransactions);
    },
    [],
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

export function useSwapProSupportNetworksTokenList() {
  const { swapProLoadSupportNetworksTokenList } = useSwapActions().current;
  const { networkList } = useMarketBasicConfig();
  const { activeAccount } = useActiveAccount({ num: 0 });
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
  }, [swapProLoadSupportNetworksTokenListRun]);
  return {
    swapProLoadSupportNetworksTokenListRun,
  };
}

export function useSwapProActions() {}
