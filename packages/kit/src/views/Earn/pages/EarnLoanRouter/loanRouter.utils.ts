import BigNumber from 'bignumber.js';

import type { ColorTokens } from '@onekeyhq/components';
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
  toLoanPositionNetApy,
  toLtvFraction,
} from '../../components/desktopHome/earnDesktopHome.utils';
import {
  EARN_ASSET_CLASS_ORDER,
  isInAssetPick,
} from '../EarnAssetSelect/earnAssetSelect.utils';

import type { ILoanLtvTone } from './loanLtvBar.types';
import type { IHealthFactorDetail } from '../../../Borrow/components/healthFactorValueColor';
import type {
  IEarnDesktopLoanAsset,
  IEarnDesktopLoanAssetType,
  IEarnDesktopMarketReserves,
} from '../../components/desktopHome/earnDesktopHome.utils';
import type {
  IEarnAssetPick,
  IEarnAssetSelectToken,
} from '../EarnAssetSelect/earnAssetSelect.utils';

// The Loans router: a collateral and a loan, and every market that takes the
// pair, each worked out for the amounts typed. One market is one candidate,
// filling the whole loan alone (the Borrow Router PRD's rule); a market that
// can't is listed last with the reason

// A health factor's tier, where the server puts it on the Borrow page and in
// its quotes (read off them 10-28): 1.50 and up, 1.10 to 1.49, under 1.10.
// The Loans window, My portfolio and the Earn forms read every health factor
// the same way
export const getLoanHealthTone = (value?: number): ILoanLtvTone => {
  if (value === undefined || value >= 1.5) {
    return 'success';
  }
  return value >= 1.1 ? 'caution' : 'critical';
};

// A health factor's figure in its tier's color, the Borrow page's own
export const LOAN_HEALTH_TEXT_COLOR: Record<ILoanLtvTone, ColorTokens> = {
  success: '$textSuccess',
  caution: '$textCaution',
  critical: '$textCritical',
};

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

type ISupplyAsset = ReturnType<typeof getMarketAssets>['collateral'][number];
type ILentAsset = ReturnType<typeof getMarketAssets>['borrow'][number];
type IMarketAsset = ISupplyAsset | ILentAsset;

const toRoute = (
  market: IEarnDesktopMarketReserves['market'],
  supplied: ISupplyAsset,
  lent: ILentAsset,
): ILoanRoute => ({
  key: `${buildBorrowMarketKey(market)}|${
    supplied.reserveAddress || supplied.token.symbol
  }|${lent.reserveAddress || lent.token.symbol}`,
  market,
  marketLabel: getBorrowMarketLabel(market),
  collateral: {
    ...toRouterToken(supplied.token, supplied.reserveAddress, market.networkId),
    supplyApy: toNumber(supplied.apyDetail?.apy),
    liquidationLtv: toLtvFraction(supplied.liquidationLtv),
  },
  borrow: {
    ...toRouterToken(lent.token, lent.reserveAddress, market.networkId),
    borrowApy: toNumber(lent.apyDetail?.apy),
    borrowFactor: toNumber(lent.borrowFactor) || 1,
  },
});

/**
 * Every market and pair the two picks take in: a token on a side, or any
 * token of a kind there. Never a token against itself (ETH and WETH)
 */
export function buildLoanRoutesForPicks({
  markets,
  collateral,
  borrow,
  stableSymbols,
}: {
  markets: IEarnDesktopMarketReserves[];
  collateral: IEarnAssetPick;
  borrow: IEarnAssetPick;
  stableSymbols: Set<string>;
}): ILoanRoute[] {
  const routes: ILoanRoute[] = [];
  markets.forEach((entry) => {
    const assets = getMarketAssets(entry);
    const supplied = assets.collateral.filter((asset) =>
      isInAssetPick({
        symbol: asset.token.symbol,
        pick: collateral,
        stableSymbols,
      }),
    );
    const lent = assets.borrow.filter((asset) =>
      isInAssetPick({
        symbol: asset.token.symbol,
        pick: borrow,
        stableSymbols,
      }),
    );
    supplied.forEach((supply) => {
      lent.forEach((loan) => {
        if (
          isSameLoanAsset(supply.token.symbol, loan.token.symbol) ||
          (Boolean(loan.reserveAddress) &&
            loan.reserveAddress === supply.reserveAddress)
        ) {
          return;
        }
        routes.push(toRoute(entry.market, supply, loan));
      });
    });
  });
  return routes;
}

type ISelectTokenDraft = IEarnAssetSelectToken & { networkIds: Set<string> };

// A token the selector lists once, gathering each network it is offered on
function gatherSelectToken({
  bySymbol,
  asset,
  market,
  stableSymbols,
}: {
  bySymbol: Map<string, ISelectTokenDraft>;
  asset: IMarketAsset;
  market: IEarnDesktopMarketReserves['market'];
  stableSymbols: Set<string>;
}) {
  const key = asset.token.symbol.toUpperCase();
  let draft = bySymbol.get(key);
  if (!draft) {
    draft = {
      symbol: asset.token.symbol,
      name: asset.token.name || asset.token.symbol,
      logoURI: asset.token.logoURI,
      type: getLoanAssetType(asset.token.symbol, stableSymbols),
      networks: [],
      addresses: [],
      networkIds: new Set(),
    };
    bySymbol.set(key, draft);
  }
  if (!draft.networkIds.has(market.networkId)) {
    draft.networkIds.add(market.networkId);
    draft.networks.push({
      id: market.networkId,
      name: market.network.name,
      logoURI: market.network.logoURI,
    });
  }
  const address = asset.token.address?.toLowerCase();
  if (
    address &&
    !draft.addresses.some(
      (item) => item.networkId === market.networkId && item.address === address,
    )
  ) {
    draft.addresses.push({ networkId: market.networkId, address });
  }
  return draft;
}

const toSelectTokens = (bySymbol: Map<string, ISelectTokenDraft>) =>
  [...bySymbol.values()].map(
    ({ networkIds: _networkIds, ...token }): IEarnAssetSelectToken => token,
  );

/**
 * The Loans window's two lists for the selector: every collateral a market
 * lends something else against, with what the wallet holds of it there; and
 * what the markets lend against the collateral picked, at its lowest rate
 */
export function buildLoanSelectTokens({
  markets,
  side,
  collateral,
  stableSymbols,
  holdings,
}: {
  markets: IEarnDesktopMarketReserves[];
  side: 'supply' | 'borrow';
  // The borrow side lists what is lent against it
  collateral?: IEarnAssetPick;
  stableSymbols: Set<string>;
  // What the wallet holds, by symbol (in upper case) and network
  holdings?: Map<string, Map<string, { amount: string; fiatValueUsd: string }>>;
}): IEarnAssetSelectToken[] {
  const bySymbol = new Map<string, ISelectTokenDraft>();
  markets.forEach((entry) => {
    const assets = getMarketAssets(entry);
    if (side === 'supply') {
      assets.collateral.forEach((asset) => {
        const lendsAgainst = assets.borrow.some(
          (lent) => !isSameLoanAsset(lent.token.symbol, asset.token.symbol),
        );
        if (lendsAgainst) {
          gatherSelectToken({
            bySymbol,
            asset,
            market: entry.market,
            stableSymbols,
          });
        }
      });
      return;
    }
    const takes = collateral
      ? assets.collateral.filter((asset) =>
          isInAssetPick({
            symbol: asset.token.symbol,
            pick: collateral,
            stableSymbols,
          }),
        )
      : assets.collateral;
    if (!takes.length) {
      return;
    }
    assets.borrow.forEach((asset) => {
      if (
        takes.every((supply) =>
          isSameLoanAsset(supply.token.symbol, asset.token.symbol),
        )
      ) {
        return;
      }
      const draft = gatherSelectToken({
        bySymbol,
        asset,
        market: entry.market,
        stableSymbols,
      });
      const apy = toNumber(asset.apyDetail?.apy);
      if (apy > 0 && (draft.rate === undefined || apy < draft.rate)) {
        draft.rate = apy;
      }
    });
  });
  if (side === 'supply' && holdings) {
    bySymbol.forEach((draft, key) => {
      const byNetwork = holdings.get(key);
      if (!byNetwork) {
        return;
      }
      let amount = new BigNumber(0);
      let fiat = new BigNumber(0);
      draft.networkIds.forEach((networkId) => {
        const held = byNetwork.get(networkId);
        if (held) {
          amount = amount.plus(held.amount);
          fiat = fiat.plus(held.fiatValueUsd);
        }
      });
      if (amount.gt(0)) {
        draft.balance = amount.toFixed();
        draft.fiatValue = fiat.toNumber();
      }
    });
  }
  return toSelectTokens(bySymbol);
}

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

// The order the Earn tab, the Loans filters and the pickers share
const ASSET_TYPE_ORDER = EARN_ASSET_CLASS_ORDER;

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

/**
 * The loan once the collateral is picked again: the one picked while the
 * markets still lend it (a kind of token while they lend any of it), else the
 * one the most networks lend, a stable token first
 */
export function pickLoanBorrowPick({
  markets,
  collateral,
  current,
  stableSymbols,
}: {
  markets: IEarnDesktopMarketReserves[];
  collateral: IEarnAssetPick;
  current: IEarnAssetPick;
  stableSymbols: Set<string>;
}): IEarnAssetPick | undefined {
  const lent = buildLoanSelectTokens({
    markets,
    side: 'borrow',
    collateral,
    stableSymbols,
  });
  const keeps =
    current.kind === 'token'
      ? lent.some((token) => isSameSymbol(token.symbol, current.symbol))
      : lent.some((token) => token.type === current.assetClass);
  if (keeps) {
    return current;
  }
  const [first] = lent.toSorted(
    (a, b) =>
      Number(b.type === 'stable') - Number(a.type === 'stable') ||
      b.networks.length - a.networks.length ||
      a.symbol.localeCompare(b.symbol),
  );
  return first ? { kind: 'token', symbol: first.symbol } : undefined;
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
export type ILoanPositionAsset = IEarnDesktopLoanAsset;

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
  // The whole position's yield: every supply's interest less every loan's
  // in a year, over what is supplied less what is borrowed
  positionNetValue: number;
  positionAnnualNet: number;
  // The market lends the token to this account (Aave's E-Mode narrows it)
  canBorrowHere: boolean;
  eModeLabel?: string;
  // With a loan there, the server's reading of the position: the Borrow
  // page's figure, color and status
  healthFactorDetail?: IHealthFactorDetail;
};

export type ILoanRouteBlock =
  | { kind: 'account' }
  | { kind: 'borrowable'; eModeLabel?: string }
  | { kind: 'liquidity'; liquidity: number }
  // ltv: what the position's LTV there would be, so the reason says why
  | { kind: 'maxLtv'; maxLtv: number; ltv?: number };

export type ILoanRouteMetrics = {
  // In %; for the amounts once they are typed, at the chosen LTV before.
  // With a position in the market, the whole position's after the plan, as
  // the market's page reads it (demo 10-29); a fresh market's is the plan's
  // own. None where the position would owe more than it holds
  netApy?: number;
  // The position's Net APY now, where the market has one
  netApyBefore?: number;
  // What the collateral earns less what the loan costs in a year, in the
  // currency: the plan's own, which ranks the markets
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
  // A position in the market: its Net APY now, and after the plan joins it
  const hasPositionYield =
    Boolean(facts) &&
    ((facts?.positionNetValue ?? 0) !== 0 ||
      (facts?.positionAnnualNet ?? 0) !== 0);
  if (hasPositionYield && facts) {
    metrics.netApyBefore = toLoanPositionNetApy({
      netValue: facts.positionNetValue,
      annualNet: facts.positionAnnualNet,
    });
  }
  if (collateralValue > 0 || loanValue > 0) {
    const annualNet =
      (collateralValue * supplyApy - loanValue * borrowApy) / 100;
    const netValue = collateralValue - loanValue;
    metrics.annualNet = annualNet;
    metrics.netApy =
      hasPositionYield && facts
        ? toLoanPositionNetApy({
            netValue: facts.positionNetValue + netValue,
            annualNet: facts.positionAnnualNet + annualNet,
          })
        : toLoanPositionNetApy({ netValue, annualNet });
    if (collateralValue > 0) {
      metrics.ltv = loanValue / collateralValue;
    }
  } else if (hasPositionYield) {
    // Nothing typed: the position as it is
    metrics.netApy = metrics.netApyBefore;
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
          ltv: metrics.ltv,
        };
      }
    } else if (
      collateral <= 0 &&
      !hasPosition &&
      (ltvStage ?? 0) > pairMaxLtv
    ) {
      // Before amounts are typed only a fresh pair is held to its limit: a
      // position's spare room may take more
      metrics.block = { kind: 'maxLtv', maxLtv: pairMaxLtv, ltv: ltvStage };
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

// The LTV bar moves in whole percents, ten at a time with Shift; what is
// borrowed already and Max LTV are stops of their own
export const LOAN_LTV_STEP = 0.01;
export const LOAN_LTV_STEP_LARGE = 0.1;

type ILoanLtvBounds = { lower: number; upper: number };

const clampLtv = (value: number, { lower, upper }: ILoanLtvBounds) =>
  Math.max(lower, Math.min(upper, value));

/** Where a press or a drag on the bar lands: the nearest whole percent */
export function snapLoanLtv(value: number, bounds: ILoanLtvBounds) {
  return clampLtv(Math.round(value / LOAN_LTV_STEP) * LOAN_LTV_STEP, bounds);
}

/**
 * A key's move: to the next step up or down, so 51.90% goes to 52% or 51%,
 * not to 52.90%
 */
export function stepLoanLtv(
  value: number,
  {
    step,
    direction,
    ...bounds
  }: ILoanLtvBounds & { step: number; direction: 1 | -1 },
) {
  const next =
    direction > 0
      ? (Math.floor(value / step + 1e-6) + 1) * step
      : (Math.ceil(value / step - 1e-6) - 1) * step;
  return clampLtv(next, bounds);
}

// Half the last place an LTV shows (two)
const LOAN_LTV_TOLERANCE = 5e-5;

/**
 * The fewest places a loan the bar sets can round down to while the LTV it
 * gives still reads as the one set: 3.7016 USDT on $7 of collateral, 4,999.5
 * on $10,000, whole tokens past that. Never more than the token's own (8 at
 * most)
 */
export function getLoanPlaces({
  collateralValue,
  borrowPrice,
  decimals,
}: {
  // All the collateral the loan is measured against, in the currency
  collateralValue: number;
  borrowPrice: number;
  decimals: number;
}) {
  const most = Math.min(decimals, 8);
  const unit = (LOAN_LTV_TOLERANCE * collateralValue) / borrowPrice;
  if (!Number.isFinite(unit) || unit <= 0) {
    return most;
  }
  return Math.max(0, Math.min(most, -Math.floor(Math.log10(unit))));
}

const roundLoan = (amount: BigNumber, places: number) => {
  const rounded = amount.decimalPlaces(places, BigNumber.ROUND_DOWN);
  return rounded.gt(0) ? rounded.toFixed() : '';
};

/**
 * The loan that brings the market's whole position to an LTV: what all its
 * collateral after the supply allows at that LTV, less the debt already
 * there, in the loan's units, as round as the LTV allows. None at or below
 * the debt already there
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
  const allCollateral = collateralValue + newCollateralValue;
  const loanValue = ltv * allCollateral - debtValue;
  if (!borrowPrice || !Number.isFinite(loanValue) || loanValue <= 0) {
    return '';
  }
  return roundLoan(
    new BigNumber(loanValue).div(borrowPrice),
    getLoanPlaces({ collateralValue: allCollateral, borrowPrice, decimals }),
  );
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

/**
 * The loan for a share of the collateral's value, in the loan's units, as
 * round as the LTV allows
 */
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
  const collateralValue = collateral.times(collateralPrice);
  return roundLoan(
    collateralValue.times(ltv).div(borrowPrice),
    getLoanPlaces({
      collateralValue: collateralValue.toNumber(),
      borrowPrice,
      decimals,
    }),
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
