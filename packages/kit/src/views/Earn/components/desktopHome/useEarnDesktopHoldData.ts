import { useCallback, useMemo } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';

import { EarnNavigation } from '../../earnUtils';

import {
  collectLendingOffers,
  deriveLendingSupply,
  getHoldRowTarget,
} from './earnDesktopHome.utils';
import { useEarnDesktopHoldRows } from './useEarnDesktopHoldRows';
import {
  useEarnDesktopAccountMarkets,
  useEarnDesktopMarkets,
  useEarnDesktopWalletHoldings,
} from './useEarnDesktopHomeData';

import type { IEarnDesktopHoldRow } from './earnDesktopHome.utils';
import type { IUseEarnPortfolioReturn } from '../../hooks/useEarnPortfolio';

/**
 * What Earns on your holding is built from: the lending markets and the
 * account's supply in them, the wallet's balances on the networks Earn offers
 * on, and the rows themselves. The DeFi home and the page that lists every
 * row read the same
 */
export function useEarnDesktopHoldData({
  isActive,
  investments,
  trendingAssets,
  fixedRateAssets,
  isAssetsLoading,
}: {
  isActive: boolean;
  investments: IUseEarnPortfolioReturn['investments'];
  trendingAssets: IEarnAvailableAsset[];
  fixedRateAssets: IEarnAvailableAsset[];
  /** Until both Earn lists are in */
  isAssetsLoading: boolean;
}) {
  const {
    marketList,
    isListReady,
    markets,
    isLoaded: isMarketsLoaded,
  } = useEarnDesktopMarkets({ isActive });
  // Asked from the market list itself, not after the public reserves
  const accountMarkets = useEarnDesktopAccountMarkets({
    markets: marketList,
    isListReady,
    isActive,
  });
  // The networks Earn offers on, where the wallet's balances are fetched
  // fresh rather than read from the wallet home's cache alone
  const earnNetworkIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...[...trendingAssets, ...fixedRateAssets].flatMap((asset) =>
            asset.protocols.map((protocol) => protocol.networkId),
          ),
          ...marketList.map((market) => market.networkId),
        ]),
      ).toSorted(),
    [fixedRateAssets, marketList, trendingAssets],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive,
    refreshNetworkIds: earnNetworkIds,
  });
  const lending = useMemo(
    () => deriveLendingSupply({ entries: accountMarkets.entries, investments }),
    [accountMarkets.entries, investments],
  );
  const lendingOffers = useMemo(
    () => collectLendingOffers({ markets, supplied: lending.supplied }),
    [lending.supplied, markets],
  );
  const hold = useEarnDesktopHoldRows({
    networkGroups: wallet.networkGroups,
    accountNetworkIds: wallet.accountNetworkIds,
    trendingAssets,
    fixedRateAssets,
    lendingOffers,
    isActive,
    isReady: wallet.isLoaded && !isAssetsLoading && isMarketsLoaded,
  });
  return {
    marketList,
    markets,
    isMarketsLoaded,
    accountMarkets,
    wallet,
    lending,
    lendingOffers,
    hold,
  };
}

/**
 * A held token opens the deposit modal on the token on all networks, with
 * every way to earn on it there, and the offer whose rate the row showed
 * chosen, on its network
 */
export function useEarnDesktopOpenHoldRow() {
  const navigation = useAppNavigation();
  return useCallback(
    (row: IEarnDesktopHoldRow) => {
      const { networkId, provider, offerKey } = getHoldRowTarget(row);
      EarnNavigation.pushToEarnOffersDeposit(navigation, {
        symbol: row.asset.symbol,
        networkId,
        provider,
        logoURI: row.asset.logoURI || row.token.logoURI,
        offerKey,
        wide: row.offers.length > 1,
        allNetworks: true,
      });
    },
    [navigation],
  );
}
