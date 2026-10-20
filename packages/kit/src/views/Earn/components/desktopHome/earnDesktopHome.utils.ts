import BigNumber from 'bignumber.js';

import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { getBorrowMarketLabel } from '../../../Borrow/borrowMarketDisplayName';
import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { filterUnsupportedAaveNativeReserveAssets } from '../../../Borrow/components/borrowRepayPosition.utils';
import { isBorrowAssetVisible } from '../../../Borrow/components/collateralControls.utils';
import { parseAprPercentValue } from '../../utils/availableAssetsUtils';
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

// ---------- Hero split bar ----------

export type IEarnDesktopShare = {
  key: string;
  name: string;
  logoURI?: string;
  value: number;
  percent: number;
};

export type IEarnDesktopShares = {
  top: IEarnDesktopShare[];
  rest?: { count: number; percent: number };
  total: number;
};

export type IEarnDesktopLendingSupply = {
  provider: string;
  name: string;
  logoURI?: string;
  fiatValue: number;
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
      lendingSupplies.push({
        provider: market.provider,
        name:
          market.provider.charAt(0).toUpperCase() + market.provider.slice(1),
        logoURI: market.logoURI,
        fiatValue: marketTotal,
      });
    }
  });
  const lendingTotal = lendingSupplies.reduce(
    (sum, item) => sum + item.fiatValue,
    0,
  );
  return { supplied, lendingSupplies, lendingTotal, interest24h };
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
  const byProvider = new Map<string, Omit<IEarnDesktopShare, 'percent'>>();
  const add = (item: Omit<IEarnDesktopShare, 'percent'>) => {
    if (item.value <= 0) {
      return;
    }
    const current = byProvider.get(item.key);
    byProvider.set(item.key, {
      ...(current ?? item),
      value: (current?.value ?? 0) + item.value,
    });
  };
  investments.forEach((investment) => {
    const detail = investment.protocol.providerDetail;
    add({
      key: detail.code.toLowerCase(),
      name: detail.name,
      logoURI: detail.logoURI,
      value: toNumber(investment.totalFiatValue),
    });
  });
  lendingSupplies.forEach((supply) => {
    add({
      key: supply.provider.toLowerCase(),
      name: supply.name,
      logoURI: supply.logoURI,
      value: supply.fiatValue,
    });
  });

  const sorted = [...byProvider.values()].toSorted((a, b) => b.value - a.value);
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
  // The legend's numbers add up to 100
  const restPercent = Math.max(
    0,
    100 - top.reduce((sum, item) => sum + item.percent, 0),
  );
  return {
    top,
    rest: { count: restItems.length, percent: restPercent },
    total,
  };
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

export type IEarnDesktopBorrowOffer = IEarnDesktopBorrowRow & {
  market: IBorrowMarketItem;
  marketLabel: string;
};

// The empty Loans tile: the most borrowed assets across markets, each at the
// market that lends it cheapest.
export function buildBorrowOffers(
  markets: IEarnDesktopMarketReserves[],
  count = 3,
): IEarnDesktopBorrowOffer[] {
  const bySymbol = new Map<
    string,
    { total: number; cheapest: IEarnDesktopBorrowOffer }
  >();
  markets.forEach((entry) => {
    const card = buildMarketCard(entry, Number.MAX_SAFE_INTEGER);
    card.topBorrow.forEach((row) => {
      const key = row.symbol.toLowerCase();
      const offer: IEarnDesktopBorrowOffer = {
        ...row,
        market: entry.market,
        marketLabel: card.label,
      };
      const current = bySymbol.get(key);
      if (!current) {
        bySymbol.set(key, { total: row.totalBorrowed, cheapest: offer });
        return;
      }
      current.total += row.totalBorrowed;
      if (toNumber(row.apy) < toNumber(current.cheapest.apy)) {
        current.cheapest = offer;
      }
    });
  });
  return [...bySymbol.values()]
    .toSorted((a, b) => b.total - a.total)
    .slice(0, count)
    .map((item) => item.cheapest);
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
