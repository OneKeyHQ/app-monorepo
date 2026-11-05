import { useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { EarnNavigation } from '../../earnUtils';
import { isEarnAssetClass } from '../../pages/EarnAssetSelect/earnAssetSelect.utils';
import { buildLoanSelectTokens } from '../../pages/EarnLoanRouter/loanRouter.utils';
import { listPayTokens } from '../../pages/EarnRouter/earnRouter.utils';

import {
  getHoldRowTarget,
  getLoanAssetType,
  isSameLoanAsset,
} from './earnDesktopHome.utils';
import { EARN_GUIDE_SYMBOL, getEarnGuideNetworkId } from './earnGuide.utils';

import type {
  IEarnDesktopHoldRow,
  IEarnDesktopMarketReserves,
  IEarnDesktopWalletTokenGroup,
} from './earnDesktopHome.utils';

// The built-in list and "USD" in the name: enough to tell a stable token
// before the server's list is read
const NO_STABLE_SYMBOLS = new Set<string>();

/**
 * The two routers' quick entries (the phone home's Earn and Loans tiles; the
 * wide home has none, its rows open the routers). Earn opens the deposit
 * window on what the wallet holds most of over every network, comparing its
 * whole kind on all networks, paid with the token itself. Loans opens the
 * Loans window on the most valuable token a market takes as collateral,
 * against stable tokens (against ETH when the collateral is stable
 * itself). With nothing to start from (no wallet, or
 * nothing it holds earns or backs a loan), each still opens its window: Earn
 * on USDC on Base, the guide's example, and Loans on ETH against stable
 * tokens; their rates show, and without a wallet the button connects one
 * (demo 10-29)
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
      EarnNavigation.pushToEarnOffersDeposit(navigation, {
        symbol: EARN_GUIDE_SYMBOL,
        networkId: getEarnGuideNetworkId(),
        wide: true,
        assetClass: 'stable',
      });
      return;
    }
    const type = getLoanAssetType(top.asset.symbol, NO_STABLE_SYMBOLS);
    // The holding is the token on every network: the window compares on all
    // of them too, from the network of its best rate
    const { networkId, provider } = getHoldRowTarget(top);
    EarnNavigation.pushToEarnOffersDeposit(navigation, {
      symbol: top.asset.symbol,
      networkId,
      provider,
      logoURI: top.asset.logoURI || top.token.logoURI,
      // A kind lists its offers beside the form
      wide: isEarnAssetClass(type) || top.offers.length > 1,
      assetClass: isEarnAssetClass(type) ? type : undefined,
      allNetworks: true,
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
      EarnNavigation.pushToEarnLoanRouter(navigation, {
        collateral: '',
        borrow: '',
        collateralClass: 'eth',
        borrowClass: 'stable',
        wide: gtLg,
      });
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
