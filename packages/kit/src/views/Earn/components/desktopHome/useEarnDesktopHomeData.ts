import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBorrowHealthFactor,
  IBorrowMarketItem,
  IBorrowReserveItem,
  IRecommendAsset,
} from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { hasPositiveBorrowBalance } from '../../../Borrow/components/borrowRepayPosition.utils';
import { useBorrowMarkets } from '../../../Borrow/hooks/useBorrowMarkets';

import type { IEarnDesktopMarketReserves } from './earnDesktopHome.utils';

const MARKET_POLLING_INTERVAL = timerUtils.getTimeDurationMs({ minute: 3 });
const ACCOUNT_POLLING_INTERVAL = timerUtils.getTimeDurationMs({ minute: 1 });
const EMPTY_MARKETS: IEarnDesktopMarketReserves[] = [];

/** Every lending market with its public reserves (no account). */
export function useEarnDesktopMarkets({ isActive }: { isActive: boolean }) {
  const { markets } = useBorrowMarkets({ isActive });
  const marketList = useMemo(() => markets ?? [], [markets]);

  const { result = EMPTY_MARKETS, isLoading } = usePromiseResult(
    async () => {
      if (!marketList.length) {
        return EMPTY_MARKETS;
      }
      return Promise.all(
        marketList.map(async (market) => {
          try {
            const reserves =
              await backgroundApiProxy.serviceStaking.getBorrowReserves({
                provider: market.provider,
                networkId: market.networkId,
                marketAddress: market.marketAddress,
              });
            return { market, reserves };
          } catch {
            return { market };
          }
        }),
      );
    },
    [marketList],
    {
      initResult: EMPTY_MARKETS,
      watchLoading: true,
      pollingInterval: isActive ? MARKET_POLLING_INTERVAL : undefined,
    },
  );

  return { markets: result, isLoading: Boolean(isLoading) };
}

export type IEarnDesktopAccountMarket = {
  market: IBorrowMarketItem;
  accountId?: string;
  reserves?: IBorrowReserveItem;
  healthFactor?: IBorrowHealthFactor;
};

const EMPTY_ACCOUNT_MARKETS: IEarnDesktopAccountMarket[] = [];

/**
 * The account's position in each market. No endpoint spans markets yet, so
 * this asks each market for the account on that market's network.
 */
export function useEarnDesktopAccountMarkets({
  markets,
  isActive,
}: {
  markets: IBorrowMarketItem[];
  isActive: boolean;
}) {
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const {
    activeAccount: { indexedAccount },
  } = useActiveAccount({ num: 0 });
  const accountId = selectedAccount.othersWalletAccountId || '';
  const indexedAccountId =
    selectedAccount.indexedAccountId || indexedAccount?.id;
  const marketsKey = markets
    .map((item) => buildBorrowMarketKey(item))
    .join('|');

  const {
    result = EMPTY_ACCOUNT_MARKETS,
    isLoading,
    run: refresh,
  } = usePromiseResult(
    async () => {
      if (!markets.length || (!accountId && !indexedAccountId)) {
        return EMPTY_ACCOUNT_MARKETS;
      }
      return Promise.all(
        markets.map(async (market): Promise<IEarnDesktopAccountMarket> => {
          const earnAccount = await backgroundApiProxy.serviceStaking
            .getEarnAccount({
              accountId,
              networkId: market.networkId,
              indexedAccountId,
            })
            .catch(() => null);
          if (!earnAccount?.accountId) {
            return { market };
          }
          const marketParams = {
            provider: market.provider,
            networkId: market.networkId,
            marketAddress: market.marketAddress,
            accountId: earnAccount.accountId,
          };
          const reserves = await backgroundApiProxy.serviceStaking
            .getBorrowReserves(marketParams)
            .catch(() => undefined);
          const healthFactor = reserves?.borrowed?.assets?.length
            ? await backgroundApiProxy.serviceStaking
                .getBorrowHealthFactor(marketParams)
                .catch(() => undefined)
            : undefined;
          return {
            market,
            accountId: earnAccount.accountId,
            reserves,
            healthFactor,
          };
        }),
      );
    },
    // marketsKey stands in for the markets array, which is rebuilt on every poll
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, indexedAccountId, marketsKey],
    {
      initResult: EMPTY_ACCOUNT_MARKETS,
      watchLoading: true,
      pollingInterval: isActive ? ACCOUNT_POLLING_INTERVAL : undefined,
    },
  );

  const loans = useMemo(
    () =>
      result.filter((entry) =>
        (entry.reserves?.borrowed?.assets ?? []).some((asset) =>
          hasPositiveBorrowBalance(asset.borrowedAmount),
        ),
      ),
    [result],
  );

  return {
    entries: result,
    loans,
    isLoading: Boolean(isLoading),
    refresh,
  };
}

const EMPTY_TOKENS: IRecommendAsset[] = [];

/** Held tokens Earn supports, with their balance text and best rate. */
export function useEarnDesktopWalletTokens({
  isActive,
}: {
  isActive: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount?.account?.id;
  const indexedAccountId = activeAccount?.indexedAccount?.id;
  const { result = EMPTY_TOKENS, isLoading } = usePromiseResult(
    async () => {
      if (!isActive || (!accountId && !indexedAccountId)) {
        return EMPTY_TOKENS;
      }
      const response =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
          accountId: accountId ?? '',
          networkId: getNetworkIdsMap().onekeyall,
          indexedAccountId,
        });
      return response?.tokens ?? EMPTY_TOKENS;
    },
    [accountId, indexedAccountId, isActive],
    {
      initResult: EMPTY_TOKENS,
      watchLoading: true,
      revalidateOnFocus: true,
    },
  );
  return { tokens: result, isLoading: Boolean(isLoading) };
}

// The server builds available.text as a label followed by the amount ("Active
// 220.09"); the amount itself always uses '.' and ',' (see RecommendedSection)
const AVAILABLE_NUMBER_PATTERN = /\d[\d,]*(?:\.\d+)?/;
export function extractAvailableAmount(text?: string) {
  const raw = text?.match(AVAILABLE_NUMBER_PATTERN)?.[0];
  return raw ? raw.replace(/,/g, '') : undefined;
}
