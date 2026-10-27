import BigNumber from 'bignumber.js';

import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { getBorrowMarketLabel } from '../../../Borrow/borrowMarketDisplayName';
import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { filterUnsupportedAaveNativeReserveAssets } from '../../../Borrow/components/borrowRepayPosition.utils';
import { isBorrowAssetVisible } from '../../../Borrow/components/collateralControls.utils';
import {
  EARN_DESKTOP_LOAN_LTV,
  dropWrappedTwins,
  getLoanAssetType,
  getLoanNetApy,
  isSameLoanAsset,
  toLtvFraction,
} from '../../components/desktopHome/earnDesktopHome.utils';

import type {
  IEarnDesktopLoanAssetType,
  IEarnDesktopMarketReserves,
} from '../../components/desktopHome/earnDesktopHome.utils';

// The Loans router: a collateral and a loan, and every market that takes the
// pair, each worked out for the amounts typed. One market is one candidate,
// filling the whole loan alone (the Borrow Router PRD's rule); a market that
// can't is listed last with the reason

const toNumber = (value?: string | number) => {
  const parsed = new BigNumber(value ?? 0);
  return parsed.isFinite() ? parsed.toNumber() : 0;
};

const isSameSymbol = (a: string, b: string) =>
  a.toUpperCase() === b.toUpperCase();

// A market's native token has no reserve address (Aave's ETH): it is the
// one of that symbol
export const isSameReserve = (
  a: { reserveAddress?: string; symbol: string },
  b: { reserveAddress?: string; symbol: string },
) =>
  a.reserveAddress || b.reserveAddress
    ? (a.reserveAddress ?? '').toLowerCase() ===
      (b.reserveAddress ?? '').toLowerCase()
    : isSameSymbol(a.symbol, b.symbol);

export type ILoanRouterToken = {
  symbol: string;
  name: string;
  logoURI: string;
  // Empty for the network's native token
  address: string;
  decimals: number;
  networkId: string;
  reserveAddress: string;
};

export type ILoanRoute = {
  // As the Loans list keys its pair rows, so a row opens on its market
  key: string;
  market: IBorrowMarketItem;
  marketLabel: string;
  collateral: ILoanRouterToken & {
    // In %
    supplyApy: number;
    // A fraction
    liquidationLtv: number;
  };
  borrow: ILoanRouterToken & {
    // In %
    borrowApy: number;
    // Kamino counts a loan at its borrow factor against the limit
    borrowFactor: number;
  };
};

export type ILoanRouterNetwork = {
  id: string;
  name: string;
  logoURI: string;
};

export type ILoanRouterOption = {
  symbol: string;
  logoURI: string;
  type: IEarnDesktopLoanAssetType;
  // Where the token is offered, in the markets' order: a pick can move the
  // pair to another network
  networks: ILoanRouterNetwork[];
};

// One option per symbol; a market on another network adds its network
function addOption({
  bySymbol,
  token,
  market,
  stableSymbols,
}: {
  bySymbol: Map<string, ILoanRouterOption>;
  token: { symbol: string; logoURI: string };
  market: IEarnDesktopMarketReserves['market'];
  stableSymbols: Set<string>;
}) {
  const key = token.symbol.toUpperCase();
  const network = {
    id: market.networkId,
    name: market.network.name,
    logoURI: market.network.logoURI,
  };
  const option = bySymbol.get(key);
  if (!option) {
    bySymbol.set(key, {
      symbol: token.symbol,
      logoURI: token.logoURI,
      type: getLoanAssetType(token.symbol, stableSymbols),
      networks: [network],
    });
    return;
  }
  if (!option.networks.some((item) => item.id === network.id)) {
    option.networks.push(network);
  }
}

// A market's collateral and what it lends, as the Loans list reads them
function getMarketAssets({ market, reserves }: IEarnDesktopMarketReserves) {
  if (!reserves) {
    return { collateral: [], borrow: [] };
  }
  const collateral = dropWrappedTwins(
    filterUnsupportedAaveNativeReserveAssets({
      assets: reserves.supply?.assets,
      networkId: market.networkId,
      providerName: market.provider,
    }).filter(
      (asset) =>
        asset.canBeCollateral && toLtvFraction(asset.liquidationLtv) > 0,
    ),
  );
  const borrow = dropWrappedTwins(
    filterUnsupportedAaveNativeReserveAssets({
      assets: reserves.borrow?.assets,
      networkId: market.networkId,
      providerName: market.provider,
    }).filter(isBorrowAssetVisible),
  );
  return { collateral, borrow };
}

const toRouterToken = (
  token: {
    symbol: string;
    name: string;
    logoURI: string;
    address: string;
    decimals: number;
  },
  reserveAddress: string,
  networkId: string,
): ILoanRouterToken => ({
  symbol: token.symbol,
  name: token.name,
  logoURI: token.logoURI,
  address: token.address,
  decimals: token.decimals,
  networkId,
  reserveAddress,
});

/** Every market that takes the collateral and lends the loan */
export function buildLoanRoutes({
  markets,
  collateralSymbol,
  borrowSymbol,
}: {
  markets: IEarnDesktopMarketReserves[];
  collateralSymbol: string;
  borrowSymbol: string;
}): ILoanRoute[] {
  if (isSameLoanAsset(collateralSymbol, borrowSymbol)) {
    return [];
  }
  const routes: ILoanRoute[] = [];
  markets.forEach((entry) => {
    const { market } = entry;
    const { collateral, borrow } = getMarketAssets(entry);
    const supplied = collateral.find((asset) =>
      isSameSymbol(asset.token.symbol, collateralSymbol),
    );
    const lent = borrow.find((asset) =>
      isSameSymbol(asset.token.symbol, borrowSymbol),
    );
    if (!supplied || !lent) {
      return;
    }
    routes.push({
      key: `${buildBorrowMarketKey(market)}|${
        supplied.reserveAddress || supplied.token.symbol
      }|${lent.reserveAddress || lent.token.symbol}`,
      market,
      marketLabel: getBorrowMarketLabel(market),
      collateral: {
        ...toRouterToken(
          supplied.token,
          supplied.reserveAddress,
          market.networkId,
        ),
        supplyApy: toNumber(supplied.apyDetail?.apy),
        liquidationLtv: toLtvFraction(supplied.liquidationLtv),
      },
      borrow: {
        ...toRouterToken(lent.token, lent.reserveAddress, market.networkId),
        borrowApy: toNumber(lent.apyDetail?.apy),
        borrowFactor: toNumber(lent.borrowFactor) || 1,
      },
    });
  });
  return routes;
}

const ASSET_TYPE_ORDER: IEarnDesktopLoanAssetType[] = [
  'stable',
  'eth',
  'btc',
  'sol',
  'other',
];

// Held first, then by kind as the Loans filters order them, then by name
const sortOptions = (
  options: ILoanRouterOption[],
  isHeld: (symbol: string) => boolean,
) =>
  options.toSorted(
    (a, b) =>
      Number(isHeld(b.symbol)) - Number(isHeld(a.symbol)) ||
      ASSET_TYPE_ORDER.indexOf(a.type) - ASSET_TYPE_ORDER.indexOf(b.type) ||
      a.symbol.localeCompare(b.symbol),
  );

/** What any market takes as collateral, once per symbol */
export function getLoanCollateralOptions({
  markets,
  stableSymbols,
  isHeld,
}: {
  markets: IEarnDesktopMarketReserves[];
  stableSymbols: Set<string>;
  isHeld: (symbol: string) => boolean;
}): ILoanRouterOption[] {
  const bySymbol = new Map<string, ILoanRouterOption>();
  markets.forEach((entry) => {
    const { collateral, borrow } = getMarketAssets(entry);
    collateral.forEach((asset) => {
      // Only a collateral the market lends something else against
      const lendsAgainst = borrow.some(
        (lent) => !isSameLoanAsset(lent.token.symbol, asset.token.symbol),
      );
      if (!lendsAgainst) {
        return;
      }
      addOption({
        bySymbol,
        token: asset.token,
        market: entry.market,
        stableSymbols,
      });
    });
  });
  return sortOptions([...bySymbol.values()], isHeld);
}

/** What a market lends against the collateral, once per symbol */
export function getLoanBorrowOptions({
  markets,
  collateralSymbol,
  stableSymbols,
}: {
  markets: IEarnDesktopMarketReserves[];
  collateralSymbol: string;
  stableSymbols: Set<string>;
}): ILoanRouterOption[] {
  const bySymbol = new Map<string, ILoanRouterOption>();
  markets.forEach((entry) => {
    const { collateral, borrow } = getMarketAssets(entry);
    if (
      !collateral.some((asset) =>
        isSameSymbol(asset.token.symbol, collateralSymbol),
      )
    ) {
      return;
    }
    borrow.forEach((asset) => {
      if (isSameLoanAsset(asset.token.symbol, collateralSymbol)) {
        return;
      }
      addOption({
        bySymbol,
        token: asset.token,
        market: entry.market,
        stableSymbols,
      });
    });
  });
  return sortOptions([...bySymbol.values()], () => false);
}

/** The loan to pick for a collateral: the one the most markets lend, stable first */
export function pickLoanBorrowSymbol({
  options,
  current,
}: {
  options: ILoanRouterOption[];
  current?: string;
}) {
  if (current && options.some((item) => isSameSymbol(item.symbol, current))) {
    return current;
  }
  return options[0]?.symbol;
}

// ---------- One market for the amounts ----------

// An asset in the account's position: what backs its loans, or one of them
export type ILoanPositionAsset = {
  symbol: string;
  logoURI?: string;
};

export type ILoanRouteFacts = {
  // No account on the market's network: nothing can be sent there
  hasAccount: boolean;
  // The account the market's transactions go out from
  networkAccountId?: string;
  // In the currency the server answers in
  collateralPrice?: number;
  borrowPrice?: number;
  // The collateral's, as a fraction
  maxLtv?: number;
  // What the market has left to lend of the loan's token, in the currency
  liquidity?: number;
  // The collateral the wallet holds on the network
  walletBalance?: string;
  // The account's position in the market: what counts as collateral, each
  // at its liquidation LTV, and the debt, each at its borrow factor
  weightedCollateral: number;
  debt: number;
  // The same at face value
  collateralValue: number;
  debtValue: number;
  // This collateral's part: what is supplied already, and its weight
  collateralSupplied: number;
  collateralWeighted: number;
  // What the account can borrow of the loan's token now, in the currency
  borrowableNow: number;
  // What counts as collateral there, and what is borrowed
  collateralAssets: ILoanPositionAsset[];
  debtAssets: ILoanPositionAsset[];
  // The market lends the token to this account (Aave's E-Mode narrows it)
  canBorrowHere: boolean;
  eModeLabel?: string;
};

export type ILoanRouteBlock =
  | { kind: 'account' }
  | { kind: 'borrowable'; eModeLabel?: string }
  | { kind: 'liquidity'; liquidity: number }
  | { kind: 'maxLtv'; maxLtv: number };

export type ILoanRouteMetrics = {
  // In %; for the amounts once they are typed, at the chosen LTV before.
  // The plan's own, over what it puts in net of the loan, and only while its
  // collateral could carry the loan alone (within the pair's Max LTV). Past
  // that the market's position carries the rest and the plan's net value is
  // small or below zero, so no rate holds: annualNet says what it makes
  netApy?: number;
  // What the collateral earns less what the loan costs in a year, in the
  // currency
  annualNet?: number;
  // Over the market's whole position: before and after
  healthFactorBefore?: number;
  healthFactor?: number;
  // The collateral's price at which the health factor reaches 1
  liquidationPrice?: number;
  // The loan over the collateral's value, a fraction. With a position in
  // the market already, the whole position's: before and after
  ltvBefore?: number;
  ltv?: number;
  // The most the loan may be over the collateral's value, a fraction: what
  // the block below checks, so the two always agree
  maxLtv?: number;
  // The most the market lends of the token after this supply, in its units
  maxBorrow?: number;
  block?: ILoanRouteBlock;
};

export function getLoanRouteMetrics({
  route,
  facts,
  collateralAmount,
  borrowAmount,
  ltvStage,
}: {
  route: ILoanRoute;
  facts?: ILoanRouteFacts;
  collateralAmount: string;
  borrowAmount: string;
  // The chosen LTV, a fraction; none once the loan is typed by hand
  ltvStage?: number;
}): ILoanRouteMetrics {
  const collateral = toNumber(collateralAmount);
  const loan = toNumber(borrowAmount);
  const { supplyApy, liquidationLtv } = route.collateral;
  const { borrowApy, borrowFactor } = route.borrow;
  const collateralPrice = facts?.collateralPrice;
  const borrowPrice = facts?.borrowPrice;
  const hasPrices = Boolean(collateralPrice && borrowPrice);
  const collateralValue = hasPrices ? collateral * (collateralPrice ?? 0) : 0;
  const loanValue = hasPrices ? loan * (borrowPrice ?? 0) : 0;

  const metrics: ILoanRouteMetrics = {};
  const pairMaxLtv =
    facts?.maxLtv !== undefined ? facts.maxLtv / borrowFactor : undefined;
  if (collateralValue > 0 || loanValue > 0) {
    const annualNet =
      (collateralValue * supplyApy - loanValue * borrowApy) / 100;
    const netValue = collateralValue - loanValue;
    metrics.annualNet = annualNet;
    const standsAlone =
      netValue > 0 &&
      (pairMaxLtv === undefined ||
        loanValue <= collateralValue * pairMaxLtv * (1 + 1e-9));
    if (standsAlone) {
      metrics.netApy = (annualNet / netValue) * 100;
    }
    if (collateralValue > 0) {
      metrics.ltv = loanValue / collateralValue;
    }
  } else {
    const ltv = ltvStage ?? EARN_DESKTOP_LOAN_LTV;
    metrics.netApy = getLoanNetApy({ supplyApy, borrowApy, ltv });
    metrics.ltv = ltv;
  }

  if (facts && hasPrices) {
    if (facts.debt > 0) {
      metrics.healthFactorBefore = facts.weightedCollateral / facts.debt;
    }
    const weighted =
      facts.weightedCollateral + collateralValue * liquidationLtv;
    const debt = facts.debt + loanValue * borrowFactor;
    if (debt > 0) {
      metrics.healthFactor = weighted / debt;
      const units = facts.collateralSupplied + collateral;
      const otherWeighted = facts.weightedCollateral - facts.collateralWeighted;
      if (units > 0 && liquidationLtv > 0) {
        const price = (debt - otherWeighted) / (units * liquidationLtv);
        metrics.liquidationPrice = price > 0 ? price : undefined;
      }
    }
    if (facts.maxLtv !== undefined && borrowPrice) {
      metrics.maxBorrow =
        (facts.borrowableNow +
          (collateralValue * facts.maxLtv) / borrowFactor) /
        borrowPrice;
    }
    // The market pools the account's collateral and debt: the new loan's
    // LTV is the whole position's. Its limit is what the account can borrow
    // now plus what the new collateral adds
    if (facts.collateralValue > 0 || facts.debtValue > 0) {
      const value = facts.collateralValue + collateralValue;
      if (facts.collateralValue > 0) {
        metrics.ltvBefore = facts.debtValue / facts.collateralValue;
      }
      metrics.ltv =
        value > 0 ? (facts.debtValue + loanValue) / value : undefined;
      if (facts.maxLtv !== undefined && value > 0) {
        metrics.maxLtv =
          (facts.debtValue +
            facts.borrowableNow +
            (collateralValue * facts.maxLtv) / borrowFactor) /
          value;
      }
    } else if (facts.maxLtv !== undefined) {
      metrics.maxLtv = facts.maxLtv / borrowFactor;
    }
  }

  if (facts && !facts.hasAccount) {
    metrics.block = { kind: 'account' };
  } else if (facts && !facts.canBorrowHere) {
    metrics.block = { kind: 'borrowable', eModeLabel: facts.eModeLabel };
  } else if (
    loan > 0 &&
    facts?.liquidity !== undefined &&
    loanValue > facts.liquidity
  ) {
    metrics.block = { kind: 'liquidity', liquidity: facts.liquidity };
  } else if (facts && pairMaxLtv !== undefined) {
    const hasPosition = facts.collateralValue > 0 || facts.debtValue > 0;
    if (loan > 0 && metrics.maxBorrow !== undefined) {
      if (loan > metrics.maxBorrow * (1 + 1e-9)) {
        metrics.block = {
          kind: 'maxLtv',
          maxLtv: metrics.maxLtv ?? pairMaxLtv,
        };
      }
    } else if (
      collateral <= 0 &&
      !hasPosition &&
      (ltvStage ?? 0) > pairMaxLtv
    ) {
      // Before amounts are typed only a fresh pair is held to its limit: a
      // position's spare room may take more
      metrics.block = { kind: 'maxLtv', maxLtv: pairMaxLtv };
    }
  }
  return metrics;
}

/**
 * The markets that can take the loan first, by what the plan earns a year
 * (the PRD's ranking; at one LTV it orders as Net APY does), then those that
 * can't, in the same order
 */
export function rankLoanRoutes<
  T extends { route: ILoanRoute; metrics: ILoanRouteMetrics },
>(items: T[]): T[] {
  const score = (item: T) =>
    item.metrics.annualNet ?? item.metrics.netApy ?? Number.NEGATIVE_INFINITY;
  return items.toSorted(
    (a, b) =>
      Number(Boolean(a.metrics.block)) - Number(Boolean(b.metrics.block)) ||
      score(b) - score(a) ||
      a.route.marketLabel.localeCompare(b.route.marketLabel),
  );
}

/**
 * The loan that brings the market's whole position to an LTV: what all its
 * collateral after the supply allows at that LTV, less the debt already
 * there, in the loan's units. None at or below the debt already there
 */
export function getLoanForPositionLtv({
  ltv,
  collateralValue,
  debtValue,
  newCollateralValue,
  borrowPrice,
  decimals,
}: {
  ltv: number;
  // The position's, in the currency
  collateralValue: number;
  debtValue: number;
  newCollateralValue: number;
  borrowPrice?: number;
  decimals: number;
}) {
  const loanValue = ltv * (collateralValue + newCollateralValue) - debtValue;
  if (!borrowPrice || !Number.isFinite(loanValue) || loanValue <= 0) {
    return '';
  }
  return new BigNumber(loanValue)
    .div(borrowPrice)
    .decimalPlaces(Math.min(decimals, 8), BigNumber.ROUND_DOWN)
    .toFixed();
}

// The LTV bar, as fractions of the collateral after the supply
export type ILoanLtvBar = {
  // The debt already in the market: the bar starts there
  used: number;
  // With this loan
  value: number;
  // The most the position may borrow to
  cap?: number;
  // Where the market starts selling collateral
  liquidation?: number;
  // Nothing backs a loan yet: a fresh pair's plan at the LTV chosen
  isPreview: boolean;
};

export function getLoanLtvBar({
  route,
  facts,
  maxLtv,
  newCollateralValue,
  loanValue,
  previewLtv,
}: {
  route: ILoanRoute;
  facts?: ILoanRouteFacts;
  maxLtv?: number;
  newCollateralValue: number;
  loanValue: number;
  previewLtv: number;
}): ILoanLtvBar {
  const { liquidationLtv } = route.collateral;
  const { borrowFactor } = route.borrow;
  const collateral = (facts?.collateralValue ?? 0) + newCollateralValue;
  if (collateral <= 0) {
    return {
      used: 0,
      value: previewLtv,
      cap: maxLtv,
      liquidation:
        liquidationLtv > 0 ? liquidationLtv / borrowFactor : undefined,
      isPreview: true,
    };
  }
  const debt = facts?.debtValue ?? 0;
  const debtAfter = debt + loanValue;
  // The health factor reaches 1 where the weighted collateral meets the
  // debt at its borrow factors: at face value, this LTV
  const weighted =
    (facts?.weightedCollateral ?? 0) + newCollateralValue * liquidationLtv;
  const adjustedDebt = (facts?.debt ?? 0) + loanValue * borrowFactor;
  const liquidation =
    adjustedDebt > 0
      ? (weighted / collateral) * (debtAfter / adjustedDebt)
      : weighted / collateral / borrowFactor;
  return {
    used: debt / collateral,
    value: debtAfter / collateral,
    cap: maxLtv,
    liquidation: liquidation > 0 ? liquidation : undefined,
    isPreview: false,
  };
}

/** The loan for a share of the collateral's value, in the loan's units */
export function getLoanForLtv({
  collateralAmount,
  ltv,
  collateralPrice,
  borrowPrice,
  decimals,
}: {
  collateralAmount: string;
  ltv: number;
  collateralPrice?: number;
  borrowPrice?: number;
  decimals: number;
}) {
  const collateral = new BigNumber(collateralAmount);
  if (
    !collateral.isFinite() ||
    collateral.lte(0) ||
    !collateralPrice ||
    !borrowPrice
  ) {
    return '';
  }
  return (
    collateral
      .times(collateralPrice)
      .times(ltv)
      .div(borrowPrice)
      // Eight places keep a small ETH loan at the LTV chosen
      .decimalPlaces(Math.min(decimals, 8), BigNumber.ROUND_DOWN)
      .toFixed()
  );
}

/** A server figure such as "79,594.7677" or "73.00%" as a number */
export function parseLoanFigure(text?: string) {
  if (!text) {
    return undefined;
  }
  const parsed = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}
