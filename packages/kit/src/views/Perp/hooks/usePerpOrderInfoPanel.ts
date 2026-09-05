import { useCallback, useEffect, useRef, useState } from 'react';

import { noop } from 'lodash';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsTradesHistoryDataAtom,
  usePerpsTradesHistoryRefreshHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  PERPS_HISTORY_FILLS_URL,
  PERPS_TWAP_HISTORY_URL,
} from '@onekeyhq/shared/src/consts/perp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IFill, IUserFunding } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  getPerpsAccountScopedListData,
  isPerpsAccountAddressMatched,
} from '../utils/accountScopedData';

type IUserFundingHistoryResult = {
  accountAddress: string | undefined;
  records: IUserFunding[];
  isError?: boolean;
};

export function usePerpTradesHistory() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [perpsTradesData] = usePerpsTradesHistoryDataAtom();
  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();

  const [currentListPage, setCurrentListPage] = useState(1);
  const prevAccountRef = useRef<string | null | undefined>(undefined);

  const refreshTradesHistory = useCallback(async () => {
    const accountAddress = currentAccount?.accountAddress;
    if (!accountAddress) {
      await backgroundApiProxy.serviceHyperliquid.resetTradesHistory();
      return;
    }

    await backgroundApiProxy.serviceHyperliquid.loadTradesHistory(
      accountAddress,
      { force: true },
    );
    await backgroundApiProxy.serviceHyperliquidSubscription.refreshSubscriptionForUserFills();
  }, [currentAccount?.accountAddress]);
  const refreshTradesHistoryRef = useRef(refreshTradesHistory);
  refreshTradesHistoryRef.current = refreshTradesHistory;

  useEffect(() => {
    const accountAddress = currentAccount?.accountAddress;

    if (prevAccountRef.current !== accountAddress) {
      setCurrentListPage(1);
      prevAccountRef.current = accountAddress;
    }

    if (!accountAddress) {
      void backgroundApiProxy.serviceHyperliquid.resetTradesHistory();
      return;
    }

    void backgroundApiProxy.serviceHyperliquid.loadTradesHistory(
      accountAddress,
    );
  }, [currentAccount?.accountAddress]);

  const isFocusedRef = useRef(true);

  useListenTabFocusState(
    ETabRoutes.Perp,
    useCallback((isFocus: boolean) => {
      isFocusedRef.current = isFocus;
    }, []),
  );

  useEffect(() => {
    noop(refreshHook);
    const timer = setTimeout(() => {
      if (isFocusedRef.current) {
        void refreshTradesHistoryRef.current();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshHook]);

  // Spot and perps fills both come from the same USER_FILLS WS subscription
  const tradesData = perpsTradesData;
  const isCurrentAccountHistory =
    !!currentAccount?.accountAddress &&
    tradesData?.accountAddress?.toLowerCase() ===
      currentAccount.accountAddress.toLowerCase();
  const fills: IFill[] = isCurrentAccountHistory
    ? (tradesData?.fills ?? [])
    : [];
  const isLoaded: boolean =
    (tradesData?.isLoaded ?? false) && isCurrentAccountHistory;
  const hasAccountAddress = Boolean(currentAccount?.accountAddress);

  return {
    trades: fills,
    currentListPage,
    setCurrentListPage,
    mode: activeTradeInstrument.mode,
    refreshTradesHistory,
    // If current account has no Perp address (unsupported or not created yet),
    // show empty state instead of skeleton loading.
    isLoading: hasAccountAddress ? !isLoaded : false,
  };
}

export function usePerpUserFundingHistory({
  isActive = true,
}: {
  isActive?: boolean;
} = {}) {
  const [currentAccount] = usePerpsActiveAccountAtom();
  const accountAddress = currentAccount?.accountAddress ?? undefined;
  const lastSuccessfulResultRef = useRef<IUserFundingHistoryResult | undefined>(
    undefined,
  );
  const query = usePromiseResult<IUserFundingHistoryResult>(
    async () => {
      if (!accountAddress) {
        return {
          accountAddress: undefined,
          records: [],
        };
      }

      const normalizedRequestAddress = accountAddress.toLowerCase();
      const previousResult = lastSuccessfulResultRef.current;
      try {
        const records =
          await backgroundApiProxy.serviceHyperliquid.getUserFundingHistory({
            accountAddress,
          });
        return {
          accountAddress: normalizedRequestAddress,
          records,
          isError: false,
        };
      } catch {
        // Keep same-account history visible when a refresh fails.
        if (previousResult?.accountAddress === normalizedRequestAddress) {
          return previousResult;
        }
        return {
          accountAddress: normalizedRequestAddress,
          records: [],
          isError: true,
        };
      }
    },
    [accountAddress],
    {
      watchLoading: true,
      undefinedResultIfError: true,
      revalidateOnFocus: true,
      // Gate requests by the visible info-panel tab without making tab
      // activity part of the query scope, so same-account results stay cached.
      overrideIsFocused: (isFocused) => isFocused && isActive,
    },
  );
  const normalizedAccountAddress = accountAddress?.toLowerCase();
  const isCurrentAccountResult = isPerpsAccountAddressMatched({
    activeAccountAddress: normalizedAccountAddress,
    dataAccountAddress: query.result?.accountAddress,
  });
  useEffect(() => {
    lastSuccessfulResultRef.current =
      isCurrentAccountResult && query.result?.isError === false
        ? query.result
        : undefined;
  }, [isCurrentAccountResult, normalizedAccountAddress, query.result]);
  const { run: refreshFundingHistory } = query;
  useEffect(() => {
    if (!isActive || !isCurrentAccountResult || query.isLoading) return;

    // History is fetched in full. Refresh long-lived views hourly, resetting
    // the timer after focus/manual requests so refreshes do not accumulate.
    const timer = setTimeout(
      () => {
        void refreshFundingHistory();
      },
      60 * 60 * 1000,
    );
    return () => clearTimeout(timer);
  }, [
    isActive,
    isCurrentAccountResult,
    query.isLoading,
    query.result,
    refreshFundingHistory,
  ]);
  const records = getPerpsAccountScopedListData({
    activeAccountAddress: normalizedAccountAddress,
    dataAccountAddress: query.result?.accountAddress,
    data: query.result?.records ?? [],
  });
  const isError = Boolean(
    isCurrentAccountResult && query.result?.isError === true,
  );
  const isLoading = Boolean(
    accountAddress && !isError && !isCurrentAccountResult,
  );

  return {
    accountAddress: normalizedAccountAddress,
    records,
    isError,
    isLoading,
    refresh: query.run,
  };
}

function usePerpViewAllUrl(baseUrl: string) {
  const [currentAccount] = usePerpsActiveAccountAtom();
  const onViewAllUrl = useCallback(() => {
    if (currentAccount?.accountAddress) {
      const url = `${baseUrl}${currentAccount.accountAddress}`;
      // Native: in-app browser; desktop/web keep the original WebView
      // modal / new-tab behavior.
      if (platformEnv.isNative) {
        openUrlExternal(url);
      } else {
        openUrlInApp(url);
      }
    }
  }, [baseUrl, currentAccount?.accountAddress]);
  return {
    onViewAllUrl,
  };
}

export function usePerpTradesHistoryViewAllUrl() {
  return usePerpViewAllUrl(PERPS_HISTORY_FILLS_URL);
}

export function usePerpTwapHistoryViewAllUrl() {
  return usePerpViewAllUrl(PERPS_TWAP_HISTORY_URL);
}
