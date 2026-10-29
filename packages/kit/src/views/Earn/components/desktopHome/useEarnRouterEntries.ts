import { useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { EarnNavigation } from '../../earnUtils';
import { isEarnAssetClass } from '../../pages/EarnAssetSelect/earnAssetSelect.utils';
import { buildLoanSelectTokens } from '../../pages/EarnLoanRouter/loanRouter.utils';
import { listPayTokens } from '../../pages/EarnRouter/earnRouter.utils';

import { getLoanAssetType, isSameLoanAsset } from './earnDesktopHome.utils';

import type {
  IEarnDesktopHoldRow,
  IEarnDesktopMarketReserves,
  IEarnDesktopWalletTokenGroup,
} from './earnDesktopHome.utils';

// The built-in list and "USD" in the name: enough to tell a stable token
// before the server's list is read
const NO_STABLE_SYMBOLS = new Set<string>();

/**
 * The two routers' quick entries (the phone home's Earn and Loans tiles, the
 * wide home's buttons beside Net Worth). Earn opens the deposit window on
 * what the wallet holds most of, comparing its whole kind there, paid with
 * the token itself. Loans opens the Loans window on the most valuable token
 * a market takes as collateral, against stable tokens (against ETH when the
 * collateral is stable itself). With nothing to start from, each opens its
 * list instead
 */
export function useEarnRouterEntries({
  holdRows,
  walletGroups,
  markets,
}: {
  // The wallet's tokens Earn pays on, the most valuable first
  holdRows: IEarnDesktopHoldRow[];
  walletGroups: IEarnDesktopWalletTokenGroup[];
  markets: IEarnDesktopMarketReserves[];
}) {
  const navigation = useAppNavigation();
  const { gtLg } = useMedia();
  // Read at the press, so the home doesn't redraw for them
  const dataRef = useRef({ holdRows, walletGroups, markets });
  dataRef.current = { holdRows, walletGroups, markets };

  const openEarnRouter = useCallback(() => {
    const [top] = dataRef.current.holdRows;
    if (!top) {
      EarnNavigation.pushToEarnTokens(navigation);
      return;
    }
    const type = getLoanAssetType(top.asset.symbol, NO_STABLE_SYMBOLS);
    EarnNavigation.pushToEarnOffersDeposit(navigation, {
      symbol: top.asset.symbol,
      networkId: top.networkId,
      logoURI: top.asset.logoURI || top.token.logoURI,
      // A kind lists its offers beside the form
      wide: isEarnAssetClass(type) || top.offers.length > 1,
      assetClass: isEarnAssetClass(type) ? type : undefined,
    });
  }, [navigation]);

  const openLoansRouter = useCallback(() => {
    const { walletGroups: groups, markets: allMarkets } = dataRef.current;
    const collateral = buildLoanSelectTokens({
      markets: allMarkets,
      side: 'supply',
      stableSymbols: NO_STABLE_SYMBOLS,
    });
    const held = groups
      .flatMap((group) => listPayTokens({ group, depositSymbol: '' }))
      .toSorted(
        (a, b) => new BigNumber(b.fiatValueUsd).comparedTo(a.fiatValueUsd) ?? 0,
      );
    let pick: string | undefined;
    held.some((item) => {
      const taken = collateral.find((token) =>
        isSameLoanAsset(token.symbol, item.token.symbol),
      );
      pick = taken?.symbol;
      return Boolean(pick);
    });
    if (!pick) {
      EarnNavigation.pushToEarnLoans(navigation);
      return;
    }
    const isStable = getLoanAssetType(pick, NO_STABLE_SYMBOLS) === 'stable';
    EarnNavigation.pushToEarnLoanRouter(navigation, {
      collateral: pick,
      borrow: '',
      borrowClass: isStable ? 'eth' : 'stable',
      wide: gtLg,
    });
  }, [gtLg, navigation]);

  return { openEarnRouter, openLoansRouter };
}
