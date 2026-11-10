import BigNumber from 'bignumber.js';

import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import type {
  IEarnAvailableAsset,
  IEarnAvailableAssetBadge,
} from '@onekeyhq/shared/types/earn';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import { EStakeProtocolGroupEnum } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowHealthFactor,
  IBorrowMarketItem,
  IBorrowReserveItem,
  IEarnPortfolioInvestment,
  IStakeProtocolListItem,
} from '@onekeyhq/shared/types/staking';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { getBorrowMarketLabel } from '../../../Borrow/borrowMarketDisplayName';
import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { filterUnsupportedAaveNativeReserveAssets } from '../../../Borrow/components/borrowRepayPosition.utils';
import { isBorrowAssetVisible } from '../../../Borrow/components/collateralControls.utils';
import {
  parseAprPercentValue,
  parseFormattedLiquidityValue,
} from '../../utils/availableAssetsUtils';
import { resolveUniquePortfolioClaimSourceIdentity } from '../../utils/portfolioClaimUtils';

import type { IPortfolioClaimProtocolIdentity } from '../../utils/portfolioClaimUtils';

export type IEarnDesktopMarketReserves = {
  market: IBorrowMarketItem;
  reserves?: IBorrowReserveItem;
};

const toNumber = (value?: string | number) => {
  const parsed = new BigNumber(value ?? 0);
  return parsed.isFinite() ? parsed.toNumber() : 0;
};

// The reserves endpoint sends amounts such as "$4.18B" only as display text.
// Ranking by it is a demo stand-in until the server adds a number.
const COMPACT_SUFFIX: Record<string, number> = {
  K: 1e3,
  M: 1e6,
  B: 1e9,
  T: 1e12,
};
export function parseCompactFiatText(text?: string): number {
  const match = text?.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KMBT])?/i);
  if (!match) {
    return 0;
  }
  const suffix = match[2]?.toUpperCase();
  return Number(match[1]) * (suffix ? COMPACT_SUFFIX[suffix] : 1);
}

// ---------- Wallet holdings ----------

export type IEarnDesktopWalletHolding = {
  /** The token's balance added up over networks, in display units */
  amount: string;
  /** Its value in USD, the basis the token cache keeps; shown converted */
  fiatValueUsd: string;
};

/** One network's tokens for one account, with their balances and values */
export type IEarnDesktopWalletTokenGroup = {
  tokens: IAccountToken[];
  map: Record<string, ITokenFiat>;
};

// What the wallet holds of each token across networks, keyed by lowercased
// symbol as the Earn rows are. Risk tokens never come in; DeFi-marked tokens
// are positions, not idle balance; a shared-balance twin is the same balance
// read twice
export function sumWalletHoldings(
  groups: IEarnDesktopWalletTokenGroup[],
): Map<string, IEarnDesktopWalletHolding> {
  const totals = new Map<
    string,
    { amount: BigNumber; fiatValueUsd: BigNumber }
  >();
  groups.forEach(({ tokens, map }) => {
    tokens.forEach((token) => {
      const fiat = map[token.$key];
      if (!fiat || token.defiMarked || fiat.sharedBalanceExcludedFromTotal) {
        return;
      }
      const amount = new BigNumber(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: fiat.balanceParsed,
          balanceMultiplier: fiat.balanceMultiplier ?? token.balanceMultiplier,
        }),
      );
      if (!amount.isFinite() || amount.lte(0)) {
        return;
      }
      const key = token.symbol.toLowerCase();
      const total = totals.get(key) ?? {
        amount: new BigNumber(0),
        fiatValueUsd: new BigNumber(0),
      };
      total.amount = total.amount.plus(amount);
      // The cache and the fetch both keep USD; a value in another basis is
      // left out rather than added to dollars
      const value = new BigNumber(fiat.fiatValue);
      if (
        value.isFinite() &&
        (fiat.currency ?? USD_CURRENCY_ID) === USD_CURRENCY_ID
      ) {
        total.fiatValueUsd = total.fiatValueUsd.plus(value);
      }
      totals.set(key, total);
    });
  });
  return new Map(
    Array.from(totals, ([key, total]) => [
      key,
      {
        amount: total.amount.toFixed(),
        fiatValueUsd: total.fiatValueUsd.toFixed(),
      },
    ]),
  );
}

// ---------- Earn table ----------

// What a token's rate cell reads (AprText), as one number to sort by: a range
// by its top, otherwise the rate shown
export function getAssetSortApr(
  asset: Pick<IEarnAvailableAsset, 'aprWithoutFee' | 'aprInfo' | 'maxAprInfo'>,
): number {
  return parseAprPercentValue(
    asset.maxAprInfo?.normal?.text ??
      asset.aprInfo?.highlight?.text ??
      asset.aprInfo?.normal?.text ??
      asset.aprWithoutFee,
  );
}

// ---------- Hero split bar ----------

export type IEarnDesktopShareToken = {
  symbol: string;
  logoURI?: string;
};

export type IEarnDesktopShare = {
  key: string;
  name: string;
  logoURI?: string;
  value: number;
  percent: number;
  /** What it holds, the most valuable first: the bar's hover card names them */
  tokens?: IEarnDesktopShareToken[];
  /** Borrowed there: the value is what is supplied less this */
  debtValue?: number;
};

export type IEarnDesktopShares = {
  top: IEarnDesktopShare[];
  rest?: { count: number; percent: number; items: IEarnDesktopShare[] };
  total: number;
};

export type IEarnDesktopLendingSupply = {
  provider: string;
  name: string;
  logoURI?: string;
  fiatValue: number;
  // What the market adds to net worth: the supply less what is borrowed
  // there, its part of the split under Net Worth, as My portfolio's bar
  // counts it
  netValue: number;
  /** The tokens supplied, the most valuable first */
  tokens?: IEarnDesktopShareToken[];
  debtValue?: number;
};

const DAYS_PER_YEAR = 365;

// A share that rounds to 0% still holds money
export const formatSharePercent = (percent: number) =>
  percent < 1 ? '<1%' : `${percent}%`;

const positionKey = ({
  provider,
  networkId,
  symbol,
  vault,
}: {
  provider: string;
  networkId: string;
  symbol: string;
  vault?: string;
}) =>
  [provider, networkId, symbol, vault ?? '']
    .map((part) => part.toLowerCase())
    .join(':');

type IPortfolioAssetIdentity = {
  provider: string;
  networkId: string;
  symbol: string;
  vault?: string;
};

// The portfolio merges a provider's positions into one investment that keeps
// only its first token and network, so read each asset instead. Every asset
// carries its own request's total, and a request's assets count once.
function eachPortfolioPosition(
  investments: IEarnPortfolioInvestment[],
  visit: (position: IPortfolioAssetIdentity & { fiatValue: number }) => void,
) {
  const seen = new Set<string>();
  investments.forEach((investment) =>
    (investment.assets ?? []).forEach((asset) => {
      const protocol = asset.metadata?.protocol;
      const network = asset.metadata?.network;
      if (!protocol || !network) {
        return;
      }
      const position = {
        provider: protocol.providerDetail.code,
        networkId: network.networkId,
        symbol: asset.token.info.symbol,
        vault: protocol.vault,
      };
      const key = positionKey(position);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const fiatValue = toNumber(asset.metadata.fiatValue);
      if (fiatValue > 0) {
        visit({ ...position, fiatValue });
      }
    }),
  );
}

export type IEarnDesktopPortfolioDeposits = {
  /** By token symbol: the Earn table's "Deposited" */
  byToken: Map<string, number>;
  /** By provider, network, token and vault: the offer that holds it */
  byPosition: Map<string, number>;
  /** By provider, network and token, with the vaults it spans */
  byProtocolToken: Map<string, { fiatValue: number; vaults: Set<string> }>;
};

/** The portfolio's principal per token and per position. */
export function sumPortfolioDeposits(
  investments: IEarnPortfolioInvestment[],
): IEarnDesktopPortfolioDeposits {
  const byToken = new Map<string, number>();
  const byPosition = new Map<string, number>();
  const byProtocolToken = new Map<
    string,
    { fiatValue: number; vaults: Set<string> }
  >();
  eachPortfolioPosition(investments, (position) => {
    const tokenKey = position.symbol.toLowerCase();
    byToken.set(tokenKey, (byToken.get(tokenKey) ?? 0) + position.fiatValue);
    const key = positionKey(position);
    byPosition.set(key, (byPosition.get(key) ?? 0) + position.fiatValue);
    const protocolTokenKey = positionKey({ ...position, vault: undefined });
    const current = byProtocolToken.get(protocolTokenKey) ?? {
      fiatValue: 0,
      vaults: new Set<string>(),
    };
    current.fiatValue += position.fiatValue;
    current.vaults.add((position.vault ?? '').toLowerCase());
    byProtocolToken.set(protocolTokenKey, current);
  });
  return { byToken, byPosition, byProtocolToken };
}

/**
 * What the portfolio holds at one offer. The protocol list and the portfolio
 * don't always both carry the vault: an offer without one takes every vault
 * of its provider, network and token, and a position without one matches an
 * offer that has one. Two different vaults never match.
 */
export function findPositionDeposit(
  deposits: IEarnDesktopPortfolioDeposits,
  identity: IPortfolioAssetIdentity,
) {
  if (identity.vault) {
    const exact = deposits.byPosition.get(positionKey(identity));
    if (exact !== undefined) {
      return exact;
    }
  }
  const protocolToken = deposits.byProtocolToken.get(
    positionKey({ ...identity, vault: undefined }),
  );
  if (!protocolToken) {
    return undefined;
  }
  return !identity.vault ||
    (protocolToken.vaults.size === 1 && protocolToken.vaults.has(''))
    ? protocolToken.fiatValue
    : undefined;
}

/** Every deposit, lending supply included, less what the loans owe. */
export function computeNetWorth({
  depositsFiatValue,
  lendingTotal,
  borrowedTotal,
}: {
  depositsFiatValue?: string;
  lendingTotal: number;
  borrowedTotal: BigNumber;
}) {
  return new BigNumber(toNumber(depositsFiatValue))
    .plus(lendingTotal)
    .minus(borrowedTotal)
    .toFixed();
}

/** What every loan owes, in fiat; net worth subtracts it. */
export function sumBorrowedFiat(entries: IEarnDesktopMarketReserves[]) {
  return entries.reduce(
    (sum, { reserves }) =>
      (reserves?.borrowed?.assets ?? []).reduce(
        (marketSum, asset) =>
          marketSum.plus(toNumber(asset.borrowedAmount.fiatValue)),
        sum,
      ),
    new BigNumber(0),
  );
}

/** An asset in a lending position: what backs its loans, or one of them */
export type IEarnDesktopLoanAsset = {
  symbol: string;
  logoURI?: string;
};

type IBorrowSuppliedAsset = NonNullable<
  IBorrowReserveItem['supplied']
>['assets'][number];

/**
 * Supplied and backing the market's loans. The collateral switch decides
 * where the market reports it: an asset switched on counts even where it
 * can't be switched on again (Aave's LTV-0 assets still count toward the
 * health factor at their liquidation LTV, as the server's figure does).
 * Where the market doesn't say (Kamino), whether it can back a loan at all
 */
export const countsAsLoanCollateral = (asset: IBorrowSuppliedAsset) =>
  asset.usageAsCollateral ?? asset.canBeCollateral !== false;

/**
 * A market position at face value: what backs its loans and what is
 * borrowed, with their assets. The Loans window and the cards of the
 * account's loans read a position alike
 */
export function summarizeLoanPosition(reserves?: IBorrowReserveItem) {
  let collateralValue = 0;
  const collateralAssets: IEarnDesktopLoanAsset[] = [];
  (reserves?.supplied?.assets ?? []).forEach((asset) => {
    const value = toNumber(asset.suppliedAmount?.fiatValue);
    if (!countsAsLoanCollateral(asset)) {
      return;
    }
    collateralValue += value;
    if (value > 0) {
      collateralAssets.push({
        symbol: asset.token.symbol,
        logoURI: asset.token.logoURI,
      });
    }
  });
  const borrowed = reserves?.borrowed?.assets ?? [];
  const debtValue = borrowed.reduce(
    (sum, asset) => sum + toNumber(asset.borrowedAmount?.fiatValue),
    0,
  );
  const debtAssets: IEarnDesktopLoanAsset[] = borrowed
    .filter((asset) => toNumber(asset.borrowedAmount?.fiatValue) > 0)
    .map((asset) => ({
      symbol: asset.token.symbol,
      logoURI: asset.token.logoURI,
    }));
  return { collateralValue, collateralAssets, debtValue, debtAssets };
}

/**
 * A market position's yield: every supply's interest less every loan's in a
 * year, and what is supplied less what is borrowed. Its Net APY is the one
 * over the other, the figure the market's page and the Loans window both
 * show (demo 10-29)
 */
export function summarizeLoanPositionYield(reserves?: IBorrowReserveItem) {
  let netValue = 0;
  let annualNet = 0;
  (reserves?.supplied?.assets ?? []).forEach((asset) => {
    const value = toNumber(asset.suppliedAmount?.fiatValue);
    netValue += value;
    annualNet += (value * toNumber(asset.apyDetail?.apy)) / 100;
  });
  (reserves?.borrowed?.assets ?? []).forEach((asset) => {
    const value = toNumber(asset.borrowedAmount?.fiatValue);
    netValue -= value;
    annualNet -= (value * toNumber(asset.apyDetail?.apy)) / 100;
  });
  return { netValue, annualNet };
}

/** A Net APY in %, where the position is worth more than it owes */
export const toLoanPositionNetApy = ({
  netValue,
  annualNet,
}: {
  netValue: number;
  annualNet: number;
}) => (netValue > 0 ? (annualNet / netValue) * 100 : undefined);

/**
 * A market position's health factor as the server reads it, the Borrow
 * page's: its risk detail (color and status), its figure, and the figure as
 * a number to order by
 */
export function readLoanHealth(healthFactor?: IBorrowHealthFactor) {
  const detail = healthFactor?.healthFactor?.button?.data?.healthFactorDetail;
  const text = detail?.value || healthFactor?.healthFactor?.text?.text;
  const value = text ? Number(text) : NaN;
  return {
    detail,
    text,
    value: Number.isFinite(value) ? value : undefined,
  };
}

/** The riskiest first: the lowest health factor; one without a figure last */
export function sortLoansByRisk<
  T extends { healthFactor?: IBorrowHealthFactor },
>(loans: T[]): T[] {
  const rank = (loan: T) =>
    readLoanHealth(loan.healthFactor).value ?? Number.MAX_VALUE;
  return loans.toSorted((a, b) => rank(a) - rank(b));
}

/** Interest the loans accrue in a day at today's borrow APYs, in fiat. */
export function estimateBorrowInterest24h(
  entries: IEarnDesktopMarketReserves[],
) {
  return entries.reduce(
    (sum, { reserves }) =>
      (reserves?.borrowed?.assets ?? []).reduce(
        (marketSum, asset) =>
          marketSum +
          (toNumber(asset.borrowedAmount.fiatValue) *
            parseAprPercentValue(asset.apyDetail.apy)) /
            100 /
            DAYS_PER_YEAR,
        sum,
      ),
    0,
  );
}

// The account's supply in the lending markets, which the Earn portfolio does
// not report. A token the portfolio already holds for that provider on that
// network (Kamino USDC has a staking config) is left out, so nothing counts
// twice; the market's other reserves still count, as its loans do.
export function deriveLendingSupply({
  entries,
  investments,
}: {
  entries: IEarnDesktopMarketReserves[];
  investments: IEarnPortfolioInvestment[];
}) {
  const reported = new Set<string>();
  eachPortfolioPosition(investments, (position) =>
    reported.add(positionKey({ ...position, vault: undefined })),
  );
  const supplied = new Map<string, number>();
  const lendingSupplies: IEarnDesktopLendingSupply[] = [];
  // What the counted supply earns in a day, for the ticking net worth and
  // the 24h earnings, which the portfolio reports without it
  let interest24h = 0;
  entries.forEach(({ market, reserves }) => {
    const marketKey = buildBorrowMarketKey(market);
    let marketTotal = 0;
    const marketTokens: (IEarnDesktopShareToken & { value: number })[] = [];
    reserves?.supplied?.assets?.forEach((asset) => {
      if (
        reported.has(
          positionKey({
            provider: market.provider,
            networkId: market.networkId,
            symbol: asset.token.symbol,
          }),
        )
      ) {
        return;
      }
      const fiatValue = toNumber(asset.suppliedAmount.fiatValue);
      marketTotal += fiatValue;
      marketTokens.push({
        symbol: asset.token.symbol,
        logoURI: asset.token.logoURI,
        value: fiatValue,
      });
      interest24h +=
        (fiatValue * parseAprPercentValue(asset.apyDetail?.apy)) /
        100 /
        DAYS_PER_YEAR;
      supplied.set(
        `${marketKey}:${asset.reserveAddress.toLowerCase()}`,
        fiatValue,
      );
    });
    if (marketTotal > 0) {
      const marketDebt = (reserves?.borrowed?.assets ?? []).reduce(
        (sum, asset) => sum + toNumber(asset.borrowedAmount?.fiatValue),
        0,
      );
      lendingSupplies.push({
        provider: market.provider,
        name:
          market.provider.charAt(0).toUpperCase() + market.provider.slice(1),
        logoURI: market.logoURI,
        fiatValue: marketTotal,
        netValue: Math.max(0, marketTotal - marketDebt),
        tokens: marketTokens
          .toSorted((a, b) => b.value - a.value)
          .map(({ symbol, logoURI }) => ({ symbol, logoURI })),
        debtValue: marketDebt,
      });
    }
  });
  const lendingTotal = lendingSupplies.reduce(
    (sum, item) => sum + item.fiatValue,
    0,
  );
  return { supplied, lendingSupplies, lendingTotal, interest24h };
}

// What an investment holds, the most valuable first
function listInvestmentTokens(
  investment: IEarnPortfolioInvestment,
): IEarnDesktopShareToken[] {
  return investment.assets
    .map((asset) => ({
      symbol: asset.token.info.symbol,
      logoURI: asset.token.info.logoURI,
      value: toNumber(asset.metadata?.fiatValue),
    }))
    .toSorted((a, b) => b.value - a.value)
    .map(({ symbol, logoURI }) => ({ symbol, logoURI }));
}

export function buildProtocolShares({
  investments,
  lendingSupplies = [],
  topCount = 3,
}: {
  investments: IEarnPortfolioInvestment[];
  lendingSupplies?: IEarnDesktopLendingSupply[];
  topCount?: number;
}): IEarnDesktopShares {
  return buildValueShares({
    items: [
      ...investments.map((investment) => {
        const detail = investment.protocol.providerDetail;
        return {
          key: detail.code.toLowerCase(),
          name: detail.name,
          logoURI: detail.logoURI,
          value: toNumber(investment.totalFiatValue),
          tokens: listInvestmentTokens(investment),
        };
      }),
      ...lendingSupplies.map((supply) => ({
        key: supply.provider.toLowerCase(),
        name: supply.name,
        logoURI: supply.logoURI,
        value: supply.netValue,
        tokens: supply.tokens,
        debtValue: supply.debtValue || undefined,
      })),
    ],
    topCount,
  });
}

// One list of the tokens two items hold, each symbol once, in their order
function mergeShareTokens(
  first?: IEarnDesktopShareToken[],
  second?: IEarnDesktopShareToken[],
) {
  if (!first?.length || !second?.length) {
    return first?.length ? first : second;
  }
  const seen = new Set(first.map((token) => token.symbol.toUpperCase()));
  return [
    ...first,
    ...second.filter((token) => !seen.has(token.symbol.toUpperCase())),
  ];
}

// The same bar over any list: items with one key add up, the first one's
// name and logo kept
export function buildValueShares({
  items,
  topCount = 3,
}: {
  items: Omit<IEarnDesktopShare, 'percent'>[];
  topCount?: number;
}): IEarnDesktopShares {
  const byKey = new Map<string, Omit<IEarnDesktopShare, 'percent'>>();
  items.forEach((item) => {
    if (item.value <= 0) {
      return;
    }
    const current = byKey.get(item.key);
    if (!current) {
      byKey.set(item.key, item);
      return;
    }
    const debtValue = (current.debtValue ?? 0) + (item.debtValue ?? 0);
    byKey.set(item.key, {
      ...current,
      value: current.value + item.value,
      tokens: mergeShareTokens(current.tokens, item.tokens),
      debtValue: debtValue || undefined,
    });
  });
  return rankShares(byKey.values(), topCount);
}

// The bar's legend: the biggest shares by name and the rest together, the
// percents adding up to 100
function rankShares(
  items: Iterable<Omit<IEarnDesktopShare, 'percent'>>,
  topCount: number,
): IEarnDesktopShares {
  const sorted = [...items].toSorted((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return { top: [], total: 0 };
  }
  const top = sorted.slice(0, topCount).map((item) => ({
    ...item,
    percent: Math.round((item.value / total) * 100),
  }));
  const restItems = sorted.slice(topCount);
  if (!restItems.length) {
    return { top, total };
  }
  const restPercent = Math.max(
    0,
    100 - top.reduce((sum, item) => sum + item.percent, 0),
  );
  return {
    top,
    rest: {
      count: restItems.length,
      percent: restPercent,
      items: restItems.map((item) => ({
        ...item,
        percent: Math.round((item.value / total) * 100),
      })),
    },
    total,
  };
}

// The hero's bar without positions: the tokens that can earn here, by token
// across networks, by what they are worth
export function buildHoldingShares({
  rows,
  topCount = 3,
}: {
  rows: IEarnDesktopHoldRow[];
  topCount?: number;
}): IEarnDesktopShares {
  const byToken = new Map<string, Omit<IEarnDesktopShare, 'percent'>>();
  rows.forEach((row) => {
    const value = toNumber(row.fiatValueUsd);
    if (value <= 0) {
      return;
    }
    const key = row.token.symbol.toUpperCase();
    const current = byToken.get(key);
    byToken.set(key, {
      key,
      name: current?.name ?? row.token.symbol,
      logoURI: current?.logoURI ?? (row.token.logoURI || row.asset.logoURI),
      value: (current?.value ?? 0) + value,
    });
  });
  return rankShares(byToken.values(), topCount);
}

// What the same rows are worth, and about what they would earn in a year,
// each at the rate its row shows, in USD
export function sumHoldRows(rows: IEarnDesktopHoldRow[]) {
  return rows.reduce(
    (sum, row) => {
      const value = toNumber(row.fiatValueUsd);
      const apr = row.offers[0] ? toNumber(row.offers[0].apr) : 0;
      return {
        valueUsd: sum.valueUsd + value,
        yearlyUsd: sum.yearlyUsd + (value * apr) / 100,
      };
    },
    { valueUsd: 0, yearlyUsd: 0 },
  );
}

// ---------- Tiles ----------

type IPortfolioAsset = IEarnPortfolioInvestment['assets'][number];
type IPortfolioRewardRow = IPortfolioAsset['rewardAssets'][number];
type IPortfolioStatusRow = IPortfolioAsset['assetsStatus'][number];
type IPortfolioAirdropAsset = IEarnPortfolioInvestment['airdropAssets'][number];
type IPortfolioAirdropRow = IPortfolioAirdropAsset['airdropAssets'][number];
type IPortfolioRow =
  | IPortfolioRewardRow
  | IPortfolioStatusRow
  | IPortfolioAirdropRow;

/** What a row's button claims, in the shape the positions table's claim button takes */
export type IEarnDesktopRowAction =
  | {
      source: 'asset';
      asset: IPortfolioAsset;
      reward:
        | IPortfolioRewardRow
        | (IPortfolioStatusRow & {
            button: NonNullable<IPortfolioStatusRow['button']>;
          });
      rewardSymbol?: string;
    }
  | {
      source: 'airdrop';
      asset: IPortfolioAirdropAsset;
      reward: IPortfolioAirdropRow;
      rewardSymbol: string;
      claimSourceIdentity: IPortfolioClaimProtocolIdentity | null;
    };

export type IEarnDesktopTileRow = {
  key: string;
  kind?: IPortfolioRow['kind'];
  amount?: string;
  symbol: string;
  logoURI?: string;
  networkId: string;
  fiatValue: number;
  unlockAt?: number;
  /** server text, shown when the row carries no amount */
  title: IPortfolioRow['title'];
  description?: IPortfolioRow['description'];
  /** a reward that cannot be claimed yet */
  isPending: boolean;
  action?: IEarnDesktopRowAction;
};

export type IEarnDesktopTileRows = {
  rows: IEarnDesktopTileRow[];
  totalFiatValue: number;
};

const hasEnabledButton = (button?: { disabled?: boolean } | object) =>
  Boolean(button) && !(button && 'disabled' in button && button.disabled);

// The token a claim button pays out, when its data names one
const getButtonTokenInfo = (button?: object) => {
  if (!button || !('data' in button) || !button.data) {
    return undefined;
  }
  const { data } = button as {
    data: { token?: { info?: { symbol?: string; logoURI?: string } } };
  };
  return data.token?.info;
};

const REWARD_KINDS = new Set<IPortfolioRow['kind']>([
  'reward',
  'pendingReward',
]);
const WITHDRAWAL_KINDS = new Set<IPortfolioRow['kind']>([
  'claimablePrincipal',
  'unstaking',
]);

// The server files rows by meaning (`kind`), not by list: a principal ready to
// claim can sit under rewardAssets, a pending reward under assetsStatus, and an
// airdrop carries both. Rows without a kind come from older servers.
export function collectTileRows(investments: IEarnPortfolioInvestment[]): {
  rewards: IEarnDesktopTileRows;
  withdrawals: IEarnDesktopTileRows;
} {
  const rewards: IEarnDesktopTileRow[] = [];
  const withdrawals: IEarnDesktopTileRow[] = [];

  const place = ({
    row,
    key,
    symbol,
    logoURI,
    networkId,
    action,
    isLegacyReward,
  }: {
    row: IPortfolioRow;
    key: string;
    symbol: string;
    logoURI?: string;
    networkId: string;
    action?: IEarnDesktopRowAction;
    isLegacyReward: boolean;
  }) => {
    const isReward =
      REWARD_KINDS.has(row.kind) || (!row.kind && isLegacyReward);
    const isWithdrawal = WITHDRAWAL_KINDS.has(row.kind);
    if (!isReward && !isWithdrawal) {
      return;
    }
    const button = action?.reward.button;
    const isPending =
      isReward && (row.kind === 'pendingReward' || !hasEnabledButton(button));
    // A pending reward of nothing is not worth a row
    if (isPending && row.amount !== undefined && toNumber(row.amount) === 0) {
      return;
    }
    const item: IEarnDesktopTileRow = {
      key,
      kind: row.kind,
      amount: row.amount,
      symbol,
      logoURI,
      networkId,
      fiatValue: toNumber(row.fiatValue),
      unlockAt: 'unlockAt' in row ? (row.unlockAt ?? undefined) : undefined,
      title: row.title,
      description: row.description,
      isPending,
      action: hasEnabledButton(button) || isWithdrawal ? action : undefined,
    };
    (isReward ? rewards : withdrawals).push(item);
  };

  // Keys name the position, not its place: investments re-sort by value on
  // every fetch, and a key that moved would hand a row's claim state to another
  const identityOf = (asset: {
    token: { info: { symbol: string } };
    metadata: {
      protocol: { providerDetail: { code: string }; vault?: string };
      network: { networkId: string };
    };
  }) =>
    positionKey({
      provider: asset.metadata.protocol.providerDetail.code,
      networkId: asset.metadata.network.networkId,
      symbol: asset.token.info.symbol,
      vault: asset.metadata.protocol.vault,
    });
  investments.forEach((investment) => {
    (investment.assets ?? []).forEach((asset) => {
      const networkId = asset.metadata.network.networkId;
      const keyPrefix = identityOf(asset);
      // The server omits empty row lists, whatever the type says
      (asset.rewardAssets ?? []).forEach((row, rowIndex) => {
        const token = getButtonTokenInfo(row.button);
        place({
          row,
          key: `reward-${keyPrefix}-${rowIndex}`,
          symbol: token?.symbol || asset.token.info.symbol,
          logoURI: token?.logoURI || asset.token.info.logoURI,
          networkId,
          action: {
            source: 'asset',
            asset,
            reward: row,
            rewardSymbol: token?.symbol,
          },
          isLegacyReward: Boolean(row.button),
        });
      });
      (asset.assetsStatus ?? []).forEach((row, rowIndex) => {
        const { button } = row;
        place({
          row,
          key: `status-${keyPrefix}-${rowIndex}`,
          symbol: asset.token.info.symbol,
          logoURI: asset.token.info.logoURI,
          networkId,
          action: button
            ? {
                source: 'asset',
                asset,
                reward: { ...row, button },
                rewardSymbol: getButtonTokenInfo(button)?.symbol,
              }
            : undefined,
          isLegacyReward: false,
        });
      });
    });

    const claimSourceCandidates = (investment.assets ?? []).map((asset) => ({
      networkId: asset.metadata.network.networkId,
      providerName: asset.metadata.protocol.providerDetail.code,
      symbol: asset.token.info.symbol,
      vault: asset.metadata.protocol.vault,
    }));
    (investment.airdropAssets ?? []).forEach((asset) => {
      const items = asset.airdropAssets ?? [];
      const claimSourceIdentity = resolveUniquePortfolioClaimSourceIdentity({
        networkId: asset.metadata.network.networkId,
        providerName: asset.metadata.protocol.providerDetail.code,
        candidates: claimSourceCandidates,
      });
      // An unclassified row next to a classified one with the same key (Lista's
      // "Check" beside its accruing amount) only repeats it
      const classifiedKeys = new Set(
        items.filter((row) => row.kind && row.key).map((row) => row.key),
      );
      items.forEach((row, rowIndex) => {
        if (!row.kind && row.key && classifiedKeys.has(row.key)) {
          return;
        }
        place({
          row,
          key: `airdrop-${identityOf(asset)}-${rowIndex}`,
          symbol: asset.token.info.symbol,
          logoURI: asset.token.info.logoURI,
          networkId: asset.metadata.network.networkId,
          action: {
            source: 'airdrop',
            asset,
            reward: row,
            rewardSymbol: asset.token.info.symbol,
            claimSourceIdentity,
          },
          isLegacyReward: Boolean(row.button),
        });
      });
    });
  });

  const total = (rows: IEarnDesktopTileRow[]) =>
    rows.reduce((sum, row) => sum + row.fiatValue, 0);
  return {
    // Claimable first, then by value
    rewards: {
      rows: rewards.toSorted((a, b) => {
        if (a.isPending !== b.isPending) {
          return a.isPending ? 1 : -1;
        }
        return b.fiatValue - a.fiatValue;
      }),
      totalFiatValue: total(rewards),
    },
    // Ready to claim first, by value; then the soonest unlock
    withdrawals: {
      rows: withdrawals.toSorted((a, b) => {
        const readyA = a.kind === 'claimablePrincipal';
        const readyB = b.kind === 'claimablePrincipal';
        if (readyA !== readyB) {
          return readyA ? -1 : 1;
        }
        if (!readyA && a.unlockAt !== b.unlockAt) {
          return (
            (a.unlockAt ?? Number.MAX_SAFE_INTEGER) -
            (b.unlockAt ?? Number.MAX_SAFE_INTEGER)
          );
        }
        return b.fiatValue - a.fiatValue;
      }),
      totalFiatValue: total(withdrawals),
    },
  };
}

export type IEarnDesktopOfferKind =
  | 'trending'
  | 'fixedIncome'
  | 'borrow'
  | 'pools';

// Each empty tile shows its own offer; the wallet tile's Pools offer waits for
// Pools, so it takes the first offer no other tile is showing.
export function pickTileOffers({
  rewardsEmpty,
  withdrawalsEmpty,
  loansEmpty,
  walletEmpty,
  poolsAvailable,
}: {
  rewardsEmpty: boolean;
  withdrawalsEmpty: boolean;
  loansEmpty: boolean;
  walletEmpty: boolean;
  poolsAvailable: boolean;
}) {
  const rewards: IEarnDesktopOfferKind | undefined = rewardsEmpty
    ? 'trending'
    : undefined;
  const withdrawals: IEarnDesktopOfferKind | undefined = withdrawalsEmpty
    ? 'fixedIncome'
    : undefined;
  const loans: IEarnDesktopOfferKind | undefined = loansEmpty
    ? 'borrow'
    : undefined;
  let wallet: IEarnDesktopOfferKind | undefined;
  if (walletEmpty) {
    if (poolsAvailable) {
      wallet = 'pools';
    } else {
      const used = new Set([rewards, withdrawals, loans]);
      wallet = (['trending', 'fixedIncome', 'borrow'] as const).find(
        (kind) => !used.has(kind),
      );
    }
  }
  return { rewards, withdrawals, loans, wallet };
}

// ---------- Borrow markets ----------

export type IEarnDesktopBorrowRow = {
  reserveAddress: string;
  symbol: string;
  logoURI: string;
  apy: string;
  totalBorrowed: number;
};

export type IEarnDesktopMarketCard = {
  key: string;
  market: IBorrowMarketItem;
  label: string;
  topBorrow: IEarnDesktopBorrowRow[];
  moreCount: number;
  collateral: { symbol: string; logoURI: string }[];
};

export function buildMarketCard(
  { market, reserves }: IEarnDesktopMarketReserves,
  topCount = 3,
): IEarnDesktopMarketCard {
  const borrowAssets = filterUnsupportedAaveNativeReserveAssets({
    assets: reserves?.borrow?.assets,
    networkId: market.networkId,
    providerName: market.provider,
  }).filter(isBorrowAssetVisible);
  const ranked = borrowAssets
    .map((asset) => ({
      reserveAddress: asset.reserveAddress,
      symbol: asset.token.symbol,
      logoURI: asset.token.logoURI,
      apy: asset.apyDetail.apy,
      totalBorrowed: parseCompactFiatText(asset.totalBorrowed?.text),
    }))
    .toSorted((a, b) => b.totalBorrowed - a.totalBorrowed);

  const seen = new Set<string>();
  const collateral = filterUnsupportedAaveNativeReserveAssets({
    assets: reserves?.supply?.assets,
    networkId: market.networkId,
    providerName: market.provider,
  })
    .filter(
      (asset) => asset.canBeCollateral && toNumber(asset.liquidationLtv) > 0,
    )
    .map((asset) => ({
      symbol: asset.token.symbol,
      logoURI: asset.token.logoURI,
    }))
    .filter((token) => {
      const key = token.symbol.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return {
    key: buildBorrowMarketKey(market),
    market,
    label: getBorrowMarketLabel(market),
    topBorrow: ranked.slice(0, topCount),
    moreCount: Math.max(0, ranked.length - topCount),
    collateral,
  };
}

export type IEarnDesktopLoanOffer = {
  reserveAddress: string;
  symbol: string;
  logoURI: string;
  /** The supply rate */
  apy: string;
  market: IBorrowMarketItem;
  marketLabel: string;
};

// The empty Loans card: the most borrowed assets across markets, since
// borrowing is what pays the lenders, each at the market that pays the most
// to supply it
export function buildLoanOffers(
  markets: IEarnDesktopMarketReserves[],
  count = 3,
): IEarnDesktopLoanOffer[] {
  const bySymbol = new Map<
    string,
    { total: number; best?: IEarnDesktopLoanOffer }
  >();
  markets.forEach((entry) => {
    const card = buildMarketCard(entry, Number.MAX_SAFE_INTEGER);
    const supplyBySymbol = new Map(
      filterUnsupportedAaveNativeReserveAssets({
        assets: entry.reserves?.supply?.assets,
        networkId: entry.market.networkId,
        providerName: entry.market.provider,
      }).map((asset) => [asset.token.symbol.toLowerCase(), asset]),
    );
    card.topBorrow.forEach((row) => {
      const key = row.symbol.toLowerCase();
      const current = bySymbol.get(key) ?? { total: 0 };
      current.total += row.totalBorrowed;
      const supply = supplyBySymbol.get(key);
      const apy = supply?.apyDetail?.apy;
      if (supply && apy && toNumber(apy) > toNumber(current.best?.apy)) {
        current.best = {
          reserveAddress: supply.reserveAddress,
          symbol: supply.token.symbol,
          logoURI: supply.token.logoURI,
          apy,
          market: entry.market,
          marketLabel: card.label,
        };
      }
      bySymbol.set(key, current);
    });
  });
  return [...bySymbol.values()]
    .toSorted((a, b) => b.total - a.total)
    .flatMap((item) => (item.best ? [item.best] : []))
    .slice(0, count);
}

// ---------- Loans as collateral to borrow pairs ----------
// Production expects the backend to group tokens and list the pairs; this
// demo builds them from the Borrow data, as the Earn rows above.

export type IEarnDesktopLoanAssetType =
  | 'btc'
  | 'eth'
  | 'sol'
  | 'stable'
  | 'other';

// Stable tokens the server's list may not name
const STABLE_SYMBOLS = new Set(['DAI', 'GHO', 'EURC', 'FRAX', 'LUSD']);

// The demo groups tokens by symbol, every variant in its group: wrapped,
// bridged and staked. Stable tokens come from the server's list, as the Earn
// tab's Stable Tokens filter; any USD token counts too
export function getLoanAssetType(
  symbol: string,
  stableSymbols: Set<string>,
): IEarnDesktopLoanAssetType {
  const upper = symbol.toUpperCase();
  if (
    stableSymbols.has(upper) ||
    STABLE_SYMBOLS.has(upper) ||
    upper.includes('USD')
  ) {
    return 'stable';
  }
  if (upper.includes('BTC')) {
    return 'btc';
  }
  if (upper.includes('ETH')) {
    return 'eth';
  }
  if (upper.endsWith('SOL')) {
    return 'sol';
  }
  return 'other';
}

export type IEarnDesktopLoanPairToken = {
  symbol: string;
  logoURI: string;
  reserveAddress: string;
  type: IEarnDesktopLoanAssetType;
  /** Supply APY for the collateral, borrow APY for the loan, in % */
  apy: number;
};

export type IEarnDesktopLoanPair = {
  key: string;
  market: IBorrowMarketItem;
  marketLabel: string;
  collateral: IEarnDesktopLoanPairToken;
  /**
   * Other forms of the same asset the market rates alike, such as cbBTC and
   * tBTC beside WBTC, which the row stands for too
   */
  moreCollateral: IEarnDesktopLoanPairToken[];
  borrow: IEarnDesktopLoanPairToken;
  /** At the assumed loan, in %; see getLoanNetApy */
  netApy: number;
};

/**
 * The loan every pair's Net APY assumes: half of what the collateral is worth.
 * One loan size for every row, so the rows compare the same loan
 */
export const EARN_DESKTOP_LOAN_LTV = 0.5;

// The data has the liquidation LTV, not the Max LTV a market lends to, which
// sits a few points under it. A loan that keeps the health factor at 1.1
// stands for one the market takes
const MIN_HEALTH_FACTOR = 1.1;

/**
 * What the collateral earns less what the loan costs, a year, over what the
 * position is worth after the loan: (S - B x LTV) / (1 - LTV), as Aave's app
 * works out a position's Net APY. The Borrow page's Net APY comes from the
 * server, whose formula the client doesn't see
 */
export function getLoanNetApy({
  supplyApy,
  borrowApy,
  ltv = EARN_DESKTOP_LOAN_LTV,
}: {
  supplyApy: number;
  borrowApy: number;
  ltv?: number;
}) {
  return (supplyApy - borrowApy * ltv) / (1 - ltv);
}

// Aave writes the liquidation LTV as a percent, Kamino as a fraction
/** A token's breadcrumb on its pages: its row on the home opens */
export type IEarnDesktopOpenRequest = { symbol: string; at: number };

export const toLtvFraction = (value?: string) => {
  const ltv = toNumber(value);
  return ltv > 1 ? ltv / 100 : ltv;
};

// ETH and WETH, BTC and WBTC: one asset, so never a pair
export const isSameLoanAsset = (a: string, b: string) => {
  const upperA = a.toUpperCase();
  const upperB = b.toUpperCase();
  return (
    upperA === upperB || upperA === `W${upperB}` || upperB === `W${upperA}`
  );
};

// Aave lists ETH beside WETH, one reserve twice; the wallet holds ETH, so it
// stands for both
export const dropWrappedTwins = <T extends { token: { symbol: string } }>(
  assets: T[],
) => {
  const symbols = new Set(
    assets.map((asset) => asset.token.symbol.toUpperCase()),
  );
  return assets.filter((asset) => {
    const upper = asset.token.symbol.toUpperCase();
    return !(upper.startsWith('W') && symbols.has(upper.slice(1)));
  });
};

/**
 * Every collateral of a market against every asset it lends, other than
 * itself, where the market takes the assumed loan. Forms of one asset at the
 * same supply rate (Aave's BTC tokens all earn 0%) read the same on every
 * column, so they share a row, led by the first the market lists
 */
export function buildLoanPairs({
  markets,
  stableSymbols,
}: {
  markets: IEarnDesktopMarketReserves[];
  stableSymbols: Set<string>;
}): IEarnDesktopLoanPair[] {
  const pairs: IEarnDesktopLoanPair[] = [];
  markets.forEach(({ market, reserves }) => {
    if (!reserves) {
      return;
    }
    const marketKey = buildBorrowMarketKey(market);
    const marketLabel = getBorrowMarketLabel(market);
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
    borrow.forEach((lent) => {
      // Kamino counts a loan at its borrow factor against the limit
      const borrowFactor = toNumber(lent.borrowFactor) || 1;
      const borrowApy = toNumber(lent.apyDetail.apy);
      const borrowToken: IEarnDesktopLoanPairToken = {
        symbol: lent.token.symbol,
        logoURI: lent.token.logoURI,
        reserveAddress: lent.reserveAddress,
        type: getLoanAssetType(lent.token.symbol, stableSymbols),
        apy: borrowApy,
      };
      const rows = new Map<string, IEarnDesktopLoanPair>();
      collateral.forEach((supplied) => {
        if (
          isSameLoanAsset(lent.token.symbol, supplied.token.symbol) ||
          (Boolean(lent.reserveAddress) &&
            lent.reserveAddress === supplied.reserveAddress)
        ) {
          return;
        }
        if (
          EARN_DESKTOP_LOAN_LTV * borrowFactor * MIN_HEALTH_FACTOR >
          toLtvFraction(supplied.liquidationLtv)
        ) {
          return;
        }
        const supplyApy = toNumber(supplied.apyDetail.apy);
        const token: IEarnDesktopLoanPairToken = {
          symbol: supplied.token.symbol,
          logoURI: supplied.token.logoURI,
          reserveAddress: supplied.reserveAddress,
          type: getLoanAssetType(supplied.token.symbol, stableSymbols),
          apy: supplyApy,
        };
        // Tokens of no common asset never share a row
        const rowKey =
          token.type === 'other'
            ? `other|${token.symbol}`
            : `${token.type}|${supplyApy.toFixed(2)}`;
        const row = rows.get(rowKey);
        if (row) {
          row.moreCollateral.push(token);
          return;
        }
        rows.set(rowKey, {
          key: `${marketKey}|${token.reserveAddress || token.symbol}|${
            borrowToken.reserveAddress || borrowToken.symbol
          }`,
          market,
          marketLabel,
          collateral: token,
          moreCollateral: [],
          borrow: borrowToken,
          netApy: getLoanNetApy({ supplyApy, borrowApy }),
        });
      });
      pairs.push(...rows.values());
    });
  });
  return pairs;
}

/** Each token the wallet holds, as `networkId|SYMBOL` */
export function collectWalletTokenKeys(
  groups: IEarnDesktopWalletNetworkGroup[],
): Set<string> {
  const keys = new Set<string>();
  groups.forEach(({ networkId, tokens, map }) => {
    tokens.forEach((token) => {
      const fiat = map[token.$key];
      if (!fiat || token.defiMarked || fiat.sharedBalanceExcludedFromTotal) {
        return;
      }
      if (new BigNumber(fiat.balanceParsed).gt(0)) {
        keys.add(`${networkId}|${token.symbol.toUpperCase()}`);
      }
    });
  });
  return keys;
}

/**
 * The pairs whose collateral the wallet holds on the market's network. A row
 * that stands for several forms of an asset is led by the one held
 */
export function pickWalletLoanPairs(
  pairs: IEarnDesktopLoanPair[],
  walletTokenKeys: Set<string>,
): IEarnDesktopLoanPair[] {
  return pairs.flatMap((pair) => {
    const forms = [pair.collateral, ...pair.moreCollateral];
    const held = forms.find((form) =>
      walletTokenKeys.has(
        `${pair.market.networkId}|${form.symbol.toUpperCase()}`,
      ),
    );
    if (!held) {
      return [];
    }
    return [
      {
        ...pair,
        collateral: held,
        moreCollateral: forms.filter((form) => form !== held),
      },
    ];
  });
}

export type IEarnDesktopLoanSort = 'net' | 'supply' | 'borrow';

/** Each rate's better end first: the most earned, the cheapest loan */
export const LOAN_SORT_BEST_FIRST: Record<
  IEarnDesktopLoanSort,
  'asc' | 'desc'
> = {
  net: 'desc',
  supply: 'desc',
  borrow: 'asc',
};

// Ties keep the better Net APY first, then the pair's name
export function sortLoanPairs(
  pairs: IEarnDesktopLoanPair[],
  sort: IEarnDesktopLoanSort,
  direction: 'asc' | 'desc' = LOAN_SORT_BEST_FIRST[sort],
): IEarnDesktopLoanPair[] {
  const value = (pair: IEarnDesktopLoanPair) => {
    if (sort === 'supply') {
      return pair.collateral.apy;
    }
    if (sort === 'borrow') {
      return pair.borrow.apy;
    }
    return pair.netApy;
  };
  const sign = direction === 'asc' ? 1 : -1;
  return pairs.toSorted(
    (a, b) =>
      sign * (value(a) - value(b)) ||
      b.netApy - a.netApy ||
      (a.key < b.key ? -1 : 1),
  );
}

/**
 * The phone home's Loans section: the pairs the Loans list starts on (any
 * collateral, a stable token to borrow, the best net APY first), the first
 * few
 */
export function pickLoanPreviewPairs(
  pairs: IEarnDesktopLoanPair[],
  count: number,
): IEarnDesktopLoanPair[] {
  return sortLoanPairs(
    pairs.filter((pair) => pair.borrow.type === 'stable'),
    'net',
  ).slice(0, count);
}

// ---------- Lending supply as Earn offers ----------
// Production expects the backend to add Aave and Kamino supply to the Earn
// lists; this demo builds the rows from the Borrow data instead.

export type IEarnDesktopLendingOffer = {
  key: string;
  market: IBorrowMarketItem;
  marketLabel: string;
  reserveAddress: string;
  symbol: string;
  logoURI: string;
  // The token's own name and contract, for the routers' selector
  tokenName?: string;
  tokenAddress?: string;
  apy: string;
  tvlText?: string;
  depositedFiatValue?: number;
};

export function collectLendingOffers({
  markets,
  supplied,
}: {
  markets: IEarnDesktopMarketReserves[];
  /** account-scoped supplied amounts, keyed by market key + reserve address */
  supplied?: Map<string, number>;
}): Map<string, IEarnDesktopLendingOffer[]> {
  const bySymbol = new Map<string, IEarnDesktopLendingOffer[]>();
  markets.forEach(({ market, reserves }) => {
    const marketKey = buildBorrowMarketKey(market);
    filterUnsupportedAaveNativeReserveAssets({
      assets: reserves?.supply?.assets,
      networkId: market.networkId,
      providerName: market.provider,
    }).forEach((asset) => {
      const symbolKey = asset.token.symbol.toLowerCase();
      const list = bySymbol.get(symbolKey) ?? [];
      list.push({
        key: `${marketKey}:${asset.reserveAddress}`,
        market,
        marketLabel: getBorrowMarketLabel(market),
        reserveAddress: asset.reserveAddress,
        symbol: asset.token.symbol,
        logoURI: asset.token.logoURI,
        tokenName: asset.token.name,
        tokenAddress: asset.token.address,
        apy: asset.apyDetail.apy,
        tvlText: asset.reserveSize?.text,
        depositedFiatValue: supplied?.get(
          `${marketKey}:${asset.reserveAddress.toLowerCase()}`,
        ),
      });
      bySymbol.set(symbolKey, list);
    });
  });
  return bySymbol;
}

// ---------- Earns on your holding ----------

// The protocols page's rule: the server category, else Pendle means fixed rate
export const isFixedRateProtocol = (item: IStakeProtocolListItem) => {
  const category = item.provider.category?.trim();
  if (category === 'fixedRate' || category === 'simpleEarn') {
    return category === 'fixedRate';
  }
  return earnUtils.isPendleProvider({ providerName: item.provider.name });
};

/** One account's tokens on one network */
export type IEarnDesktopWalletNetworkGroup = IEarnDesktopWalletTokenGroup & {
  accountId: string;
  networkId: string;
};

export type IEarnDesktopHoldOffer =
  | {
      kind: 'protocol';
      key: string;
      apr: number;
      isFixedRate: boolean;
      item: IStakeProtocolListItem;
    }
  | {
      kind: 'lending';
      key: string;
      apr: number;
      isFixedRate: false;
      offer: IEarnDesktopLendingOffer;
    };

export type IEarnDesktopHoldRow = {
  key: string;
  /** The token as the wallet lists it where it holds the most of it */
  token: IAccountToken;
  /** The balance added up over networks, in display units */
  amount: string;
  /** Its value in USD, the basis the token cache keeps; shown converted */
  fiatValueUsd: string;
  /** The networks the wallet holds it on, the most valuable first */
  networkIds: string[];
  asset: IEarnAvailableAsset;
  /**
   * What the token can earn on any network the wallet uses, the best rate
   * first: Earn bridges it from where it sits
   */
  offers: IEarnDesktopHoldOffer[];
};

// What Earn offers for one token on one network, the best rate first: the
// protocol list's offers there (redeem-only and zero-rate ones left out) and
// the lending markets' supply the list doesn't already offer
export function collectNetworkOffers({
  networkId,
  protocols,
  lendingOffers,
}: {
  networkId: string;
  protocols: IStakeProtocolListItem[];
  lendingOffers: IEarnDesktopLendingOffer[];
}): IEarnDesktopHoldOffer[] {
  const protocolOffers = protocols
    .filter(
      (item) =>
        item.network.networkId === networkId &&
        item.aprInfo?.button?.type !== 'redeem',
    )
    .map((item) => ({
      kind: 'protocol' as const,
      key: `${networkId}-${item.provider.name}-${item.provider.vault ?? ''}`,
      apr: parseAprPercentValue(item.provider.aprWithoutFee),
      isFixedRate: isFixedRateProtocol(item),
      item,
    }))
    .filter((offer) => offer.apr > 0);
  // A market the protocol list already offers must not count twice; an
  // entry left out above doesn't hide it
  const listed = new Set(
    protocolOffers.map((offer) =>
      (
        normalizeToEarnProvider(offer.item.provider.name) ??
        offer.item.provider.name
      ).toLowerCase(),
    ),
  );
  const lendingRows = lendingOffers
    .filter(
      (offer) =>
        offer.market.networkId === networkId &&
        !listed.has(offer.market.provider.toLowerCase()),
    )
    .map((offer) => ({
      kind: 'lending' as const,
      key: offer.key,
      apr: parseAprPercentValue(offer.apy),
      isFixedRate: false as const,
      offer,
    }))
    .filter((offer) => offer.apr > 0);
  return [...protocolOffers, ...lendingRows].toSorted((a, b) => b.apr - a.apr);
}

const getHoldOfferNetworkId = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'protocol'
    ? offer.item.network.networkId
    : offer.offer.market.networkId;

// What Earn offers for one token on every network, the best rate first: each
// network's offers as collectNetworkOffers counts them there. With networks
// given, the offers on those alone
export function collectTokenOffers({
  protocols,
  lendingOffers,
  networkIds,
}: {
  protocols: IStakeProtocolListItem[];
  lendingOffers: IEarnDesktopLendingOffer[];
  networkIds?: Set<string>;
}): IEarnDesktopHoldOffer[] {
  const offerNetworkIds = new Set([
    ...protocols.map((item) => item.network.networkId),
    ...lendingOffers.map((offer) => offer.market.networkId),
  ]);
  return Array.from(offerNetworkIds)
    .filter((networkId) => !networkIds || networkIds.has(networkId))
    .flatMap((networkId) =>
      collectNetworkOffers({ networkId, protocols, lendingOffers }),
    )
    .toSorted((a, b) => b.apr - a.apr);
}

type IHeldToken = {
  token: IAccountToken;
  amount: BigNumber;
  fiatValueUsd: BigNumber;
  /** What it is worth on each network it sits on */
  byNetwork: Map<string, BigNumber>;
  /** What it is worth on the network the token above is listed on */
  tokenValueUsd: BigNumber;
};

/**
 * What a token must be worth on one network, in USD, to come into Earns on
 * your holding (user, 11-10). Smaller balances on several networks don't add
 * up to an entry: a deposit starts from one network
 */
export const EARN_HOLD_MIN_NETWORK_VALUE_USD = 10;

// Each token the wallet holds, one row over every network it sits on (since
// 11-05), with what Earn offers for it on any network the wallet can take it
// to: Earn bridges it there. The most valuable first. A token Earn offers
// nowhere is left out, and so is one worth less than the minimum on every
// network it sits on; one that comes in still counts its balance everywhere
export function buildHoldRows({
  groups,
  assets,
  protocolsBySymbol,
  lendingOffers,
  accountNetworkIds,
}: {
  groups: IEarnDesktopWalletNetworkGroup[];
  assets: IEarnAvailableAsset[];
  /** The protocol lists, keyed by lowercased symbol */
  protocolsBySymbol: Map<string, IStakeProtocolListItem[]>;
  lendingOffers: Map<string, IEarnDesktopLendingOffer[]>;
  /**
   * The networks the wallet has an account on, as All Networks lists them:
   * an offer elsewhere is one it can't deposit in. Unset, every network
   */
  accountNetworkIds?: string[];
}): IEarnDesktopHoldRow[] {
  const assetBySymbol = new Map<string, IEarnAvailableAsset>();
  assets.forEach((asset) => {
    const key = asset.symbol.toLowerCase();
    if (!assetBySymbol.has(key)) {
      assetBySymbol.set(key, asset);
    }
  });
  const held = new Map<string, IHeldToken>();
  groups.forEach(({ networkId, tokens, map }) => {
    tokens.forEach((token) => {
      const fiat = map[token.$key];
      // Risk tokens never come in; DeFi-marked tokens are positions, not
      // idle balance; a shared-balance twin is the same balance read twice
      if (!fiat || token.defiMarked || fiat.sharedBalanceExcludedFromTotal) {
        return;
      }
      const symbolKey = token.symbol.toLowerCase();
      if (!assetBySymbol.has(symbolKey)) {
        return;
      }
      const amount = new BigNumber(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: fiat.balanceParsed,
          balanceMultiplier: fiat.balanceMultiplier ?? token.balanceMultiplier,
        }),
      );
      if (!amount.isFinite() || amount.lte(0)) {
        return;
      }
      // A value in another basis than USD counts as none rather than being
      // added to dollars
      const fiatValue = new BigNumber(fiat.fiatValue);
      const value =
        fiatValue.isFinite() &&
        (fiat.currency ?? USD_CURRENCY_ID) === USD_CURRENCY_ID
          ? fiatValue
          : new BigNumber(0);
      const kept = held.get(symbolKey);
      if (!kept) {
        held.set(symbolKey, {
          token,
          amount,
          fiatValueUsd: value,
          byNetwork: new Map([[networkId, value]]),
          tokenValueUsd: value,
        });
        return;
      }
      kept.amount = kept.amount.plus(amount);
      kept.fiatValueUsd = kept.fiatValueUsd.plus(value);
      kept.byNetwork.set(
        networkId,
        (kept.byNetwork.get(networkId) ?? new BigNumber(0)).plus(value),
      );
      if (value.gt(kept.tokenValueUsd)) {
        kept.token = token;
        kept.tokenValueUsd = value;
      }
    });
  });
  const usable = accountNetworkIds ? new Set(accountNetworkIds) : undefined;
  const rows: IEarnDesktopHoldRow[] = [];
  held.forEach((item, symbolKey) => {
    const hasEnoughOnOneNetwork = Array.from(item.byNetwork.values()).some(
      (value) => value.gte(EARN_HOLD_MIN_NETWORK_VALUE_USD),
    );
    if (!hasEnoughOnOneNetwork) {
      return;
    }
    const asset = assetBySymbol.get(symbolKey);
    const offers = collectTokenOffers({
      protocols: protocolsBySymbol.get(symbolKey) ?? [],
      lendingOffers: lendingOffers.get(symbolKey) ?? [],
      networkIds: usable,
    });
    if (!asset || !offers.length) {
      return;
    }
    const networkIds = Array.from(item.byNetwork)
      .toSorted((a, b) => b[1].comparedTo(a[1]) ?? 0)
      .map(([networkId]) => networkId);
    // Two offers paying the same: the one on a network the wallet holds the
    // token on needs no bridge, so it leads
    const heldRank = (offer: IEarnDesktopHoldOffer) => {
      const rank = networkIds.indexOf(getHoldOfferNetworkId(offer));
      return rank === -1 ? networkIds.length : rank;
    };
    rows.push({
      key: symbolKey,
      token: item.token,
      amount: item.amount.toFixed(),
      fiatValueUsd: item.fiatValueUsd.toFixed(),
      networkIds,
      asset,
      offers: offers.toSorted(
        (a, b) => b.apr - a.apr || heldRank(a) - heldRank(b),
      ),
    });
  });
  return rows.toSorted(
    (a, b) => Number(b.fiatValueUsd) - Number(a.fiatValueUsd),
  );
}

/**
 * Where a held token's Earn opens: on the offer whose rate the row shows,
 * its network and protocol, with the token's offers on every network listed
 */
export function getHoldRowTarget(row: IEarnDesktopHoldRow): {
  networkId: string;
  provider: string;
  offerKey?: string;
} {
  const [best] = row.offers;
  if (!best) {
    return { networkId: row.networkIds[0] ?? '', provider: '' };
  }
  return {
    networkId: getHoldOfferNetworkId(best),
    provider:
      best.kind === 'protocol'
        ? best.item.provider.name
        : best.offer.market.provider,
    offerKey: best.key,
  };
}

// ---------- Offer cards ----------

/** A listed token on one network, with what Earn offers for it there */
export type IEarnDesktopOfferRow = {
  key: string;
  asset: IEarnAvailableAsset;
  networkId: string;
  /** The best rate first */
  offers: IEarnDesktopHoldOffer[];
  /** USD in the protocol list's offers there */
  tvl: number;
};

// TVL the way the Protocols page totals it
const getProtocolTvl = (item: IStakeProtocolListItem) =>
  parseFormattedLiquidityValue(
    item.provider.totalFiatValue || item.provider.tvl || item.tvl?.text,
  );

// The offer cards' rows: a listed token once per network it earns on, with
// the offers of the card's kind there. Withdraw-only protocols take no
// deposits, so they count for neither the rate nor the TVL. The TVL is the
// protocol list's alone: a lending market's reserve holds collateral too, and
// ETH and WETH share one
export function buildOfferRows({
  assets,
  protocolsBySymbol,
  lendingOffers,
  isFixedRate,
}: {
  assets: IEarnAvailableAsset[];
  /** Every protocol row, keyed by lowercased symbol */
  protocolsBySymbol: Map<string, IStakeProtocolListItem[]>;
  lendingOffers: Map<string, IEarnDesktopLendingOffer[]>;
  /** Fixed Income's rows keep the fixed-rate offers, the others the rest */
  isFixedRate: boolean;
}): IEarnDesktopOfferRow[] {
  const rows = new Map<string, IEarnDesktopOfferRow>();
  assets.forEach((asset) => {
    const symbolKey = asset.symbol.toLowerCase();
    const protocols = (protocolsBySymbol.get(symbolKey) ?? []).filter(
      (item) => item.provider.group !== EStakeProtocolGroupEnum.WithdrawOnly,
    );
    asset.protocols.forEach(({ networkId }) => {
      const key = `${symbolKey}|${networkId}`;
      if (rows.has(key)) {
        return;
      }
      const offers = collectNetworkOffers({
        networkId,
        protocols,
        lendingOffers: isFixedRate ? [] : (lendingOffers.get(symbolKey) ?? []),
      }).filter((offer) => offer.isFixedRate === isFixedRate);
      if (!offers.length) {
        return;
      }
      rows.set(key, {
        key,
        asset,
        networkId,
        offers,
        tvl: offers.reduce(
          (sum, offer) =>
            offer.kind === 'protocol' ? sum + getProtocolTvl(offer.item) : sum,
          0,
        ),
      });
    });
  });
  return Array.from(rows.values());
}

// ---------- Earn table: an open token ----------

/** One offer in an open token's list */
export type IEarnDesktopTokenOffer =
  | {
      kind: 'protocol';
      key: string;
      apr: number;
      tvl: number;
      item: IStakeProtocolListItem;
    }
  | {
      kind: 'lending';
      key: string;
      apr: number;
      tvl: number;
      offer: IEarnDesktopLendingOffer;
    };

// What an open token lists: the protocols of its kind (fixed rate or not)
// and the lending markets the protocol list doesn't already carry. With
// networks picked in the filter, the offers on those alone
export function buildTokenOffers({
  protocols,
  lendingOffers,
  isFixedRate,
  networkIds,
}: {
  protocols: IStakeProtocolListItem[];
  lendingOffers: IEarnDesktopLendingOffer[];
  isFixedRate: boolean;
  /** The networks picked in the filter; none keeps every network */
  networkIds?: string[];
}): IEarnDesktopTokenOffer[] {
  const isShown = (networkId: string) =>
    !networkIds?.length || networkIds.includes(networkId);
  const protocolRows = protocols
    .filter(
      (item) =>
        isFixedRateProtocol(item) === isFixedRate &&
        isShown(item.network.networkId),
    )
    .map((item) => ({
      kind: 'protocol' as const,
      key: `${item.network.networkId}-${item.provider.name}-${item.provider.vault ?? ''}`,
      apr: parseAprPercentValue(item.provider.aprWithoutFee),
      tvl: getProtocolTvl(item),
      item,
    }));
  // A market the protocol list already carries (Kamino USDC has a staking
  // config) must not be listed twice
  const listed = new Set(
    protocols.map(
      (item) =>
        `${(normalizeToEarnProvider(item.provider.name) ?? item.provider.name).toLowerCase()}:${item.network.networkId}`,
    ),
  );
  const lendingRows = isFixedRate
    ? []
    : lendingOffers
        .filter(
          (offer) =>
            isShown(offer.market.networkId) &&
            !listed.has(
              `${offer.market.provider.toLowerCase()}:${offer.market.networkId}`,
            ),
        )
        .map((offer) => ({
          kind: 'lending' as const,
          key: offer.key,
          apr: parseAprPercentValue(offer.apy),
          tvl: parseFormattedLiquidityValue(offer.tvlText),
          offer,
        }));
  return [...protocolRows, ...lendingRows];
}

/** A token's row while networks are picked in the filter */
type IEarnRateColor = NonNullable<
  NonNullable<IEarnAvailableAsset['aprInfo']>['normal']
>['color'];

export type IEarnDesktopNetworkView = {
  /** The networks of its offers among the picked ones */
  networkIds: string[];
  /** Its lowest and highest rate there; none when nothing there pays */
  aprRange?: { min: number; max: number };
  /** The color an offer there gives its own rate (a bonus's green) */
  aprColor?: IEarnRateColor;
  /** Its badges an offer there carries, and those no offer carries */
  badges?: IEarnAvailableAssetBadge[];
};

// A token's row with networks picked: the networks and rates of its offers
// on those alone, counted as the offer cards count them (withdraw-only,
// redeem-only and zero-rate offers left out). Without such an offer there,
// the picked networks the token is listed on still show, so the row says
// why it's in the list
export function buildNetworkView({
  protocols,
  lendingOffers,
  isFixedRate,
  rowNetworkIds,
  pickedNetworkIds,
  badges,
}: {
  protocols: IStakeProtocolListItem[];
  lendingOffers: IEarnDesktopLendingOffer[];
  isFixedRate: boolean;
  /** Every network the row is listed on */
  rowNetworkIds: string[];
  pickedNetworkIds: string[];
  /** The token's own badges */
  badges?: IEarnAvailableAssetBadge[];
}): IEarnDesktopNetworkView {
  const open = protocols.filter(
    (item) => item.provider.group !== EStakeProtocolGroupEnum.WithdrawOnly,
  );
  const offers = pickedNetworkIds.flatMap((networkId) =>
    collectNetworkOffers({
      networkId,
      protocols: open,
      lendingOffers: isFixedRate ? [] : lendingOffers,
    }).filter((offer) => offer.isFixedRate === isFixedRate),
  );
  const offerNetworkIds = new Set(
    offers.map((offer) =>
      offer.kind === 'protocol'
        ? offer.item.network.networkId
        : offer.offer.market.networkId,
    ),
  );
  // A badge an offer carries (Spark's Bonus) is that offer's: it stays only
  // with an offer here carrying it. One no offer carries is the token's own
  const offerTags = new Set(
    protocols.flatMap(
      (item) => item.provider.badges?.map((badge) => badge.tag) ?? [],
    ),
  );
  const tagsHere = new Set(
    offers.flatMap((offer) =>
      offer.kind === 'protocol'
        ? (offer.item.provider.badges?.map((badge) => badge.tag) ?? [])
        : [],
    ),
  );
  const shownBadges = badges?.filter(
    (badge) => !offerTags.has(badge.tag) || tagsHere.has(badge.tag),
  );
  // In the row's own order, then any network only the offers name
  const ordered = Array.from(
    new Set([...rowNetworkIds, ...offerNetworkIds]),
  ).filter((networkId) => offerNetworkIds.has(networkId));
  if (!offers.length) {
    return {
      networkIds: rowNetworkIds.filter((networkId) =>
        pickedNetworkIds.includes(networkId),
      ),
      ...(shownBadges ? { badges: shownBadges } : undefined),
    };
  }
  const rates = offers.map((offer) => offer.apr);
  // The token's own rate color comes from any of its offers (Spark's bonus
  // green); here it comes from the offers here only, as their rows show it
  const aprColor = offers
    .map((offer) =>
      offer.kind === 'protocol' ? offer.item.aprInfo?.normal?.color : undefined,
    )
    .find(Boolean);
  return {
    networkIds: ordered,
    aprRange: { min: Math.min(...rates), max: Math.max(...rates) },
    ...(aprColor ? { aprColor } : undefined),
    ...(shownBadges ? { badges: shownBadges } : undefined),
  };
}
