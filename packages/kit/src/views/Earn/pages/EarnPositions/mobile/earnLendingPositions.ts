import BigNumber from 'bignumber.js';

import { getBorrowMarketLabel } from '@onekeyhq/kit/src/views/Borrow/borrowMarketDisplayName';
import { buildBorrowMarketKey } from '@onekeyhq/kit/src/views/Borrow/borrowMarketKey';
import { hasPositiveBorrowBalance } from '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils';
import {
  readLoanHealth,
  summarizeLoanPositionYield,
  toLoanPositionNetApy,
} from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHome.utils';
import type { IEarnDesktopAccountMarket } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/useEarnDesktopHomeData';
import type { IStakePendingTx } from '@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs';
import { parseBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
} from '@onekeyhq/shared/types/earn/portfolioPositions';
import type {
  IBorrowAlert,
  IBorrowBalance,
  IBorrowHealthFactor,
  IBorrowMarketItem,
  IBorrowReserveItem,
  IBorrowRewards,
  IBorrowToken,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

/**
 * Where a position the client reads from a lending market itself comes
 * from: such a card carries the market's own controls and figures
 */
export const EARN_LENDING_MARKET_SOURCE = 'onekey-lending-markets';

export type IEarnLendingSuppliedReserve =
  IBorrowReserveItem['supplied']['assets'][number];
export type IEarnLendingBorrowedReserve =
  IBorrowReserveItem['borrowed']['assets'][number];

/**
 * What the market's own page showed over its tables, which the card shows
 * now that the page is retired on web (demo 11-10)
 */
export type IEarnLendingMarketSummary = {
  /** The position's Net APY in %, the Loans window's figure, as "3.06%" */
  netApyText?: string;
  /** The market's warnings and the health factor's, in that order */
  alerts: IBorrowAlert[];
  /** OneKey's bonus on the market, while it runs one */
  platformBonus?: IBorrowReserveItem['overview']['platformBonus'];
  /** Whether the account has transactions listed in the market */
  hasHistory: boolean;
};

/** The market a lending card was read from, and the account it was read for */
export type IEarnLendingMarketRef = {
  market: IBorrowMarketItem;
  /** The account's own account on the market's network */
  accountId: string;
  indexedAccountId?: string;
  summary?: IEarnLendingMarketSummary;
};

/**
 * A lending row's reserve as its market reads it (demo 11-03): what the
 * row's Withdraw or Repay and its collateral switch act on, the market
 * page's own row
 */
export type IEarnLendingReserveRef =
  | {
      side: 'supplied';
      reserve: IEarnLendingSuppliedReserve;
      market: IEarnLendingMarketRef;
    }
  | {
      side: 'borrowed';
      reserve: IEarnLendingBorrowedReserve;
      market: IEarnLendingMarketRef;
    };

/** A position's token, with its reserve where the row was read from a market */
export type IEarnLendingDeFiAsset = IDeFiAsset & {
  lending?: IEarnLendingReserveRef;
};

const toBigNumber = (value?: string) => {
  const parsed = new BigNumber(value ?? 0);
  return parsed.isFinite() ? parsed : new BigNumber(0);
};

function toDeFiAsset({
  token,
  balance,
  lending,
}: {
  token: IBorrowToken;
  balance: IBorrowBalance;
  lending?: IEarnLendingReserveRef;
}): IEarnLendingDeFiAsset {
  // The raw amount where the server sends it; the title is display text
  const amount = toBigNumber(balance.number ?? balance.amount);
  const value = toBigNumber(balance.fiatValue);
  return {
    symbol: token.symbol,
    address: token.address,
    amount: amount.toFixed(),
    value: value.toNumber(),
    price: amount.gt(0) ? value.div(amount).toNumber() : 0,
    category: 'deposit',
    meta: {
      decimals: token.decimals,
      logoUrl: token.logoURI,
      isVerified: true,
    },
    ...(lending ? { lending } : {}),
  };
}

/**
 * A market's summary for its card: the Net APY worked out as the Loans
 * window and the market page do (the server's own where the position is
 * worth nothing), the warnings of the market and of its health factor, the
 * bonus, and whether History has anything to list
 */
export function buildLendingMarketSummary({
  reserves,
  healthFactor,
}: {
  reserves: IBorrowReserveItem;
  healthFactor?: IBorrowHealthFactor;
}): IEarnLendingMarketSummary {
  const netApy = toLoanPositionNetApy(summarizeLoanPositionYield(reserves));
  const serverNetApy = reserves.overview?.netApy?.text?.trim();
  const hasServerNetApy = Boolean(serverNetApy && /\d/.test(serverNetApy));
  let netApyText: string | undefined;
  if (netApy !== undefined) {
    netApyText = `${new BigNumber(netApy).toFixed(2)}%`;
  } else if (hasServerNetApy) {
    netApyText = serverNetApy;
  }
  return {
    netApyText,
    alerts: [...(reserves.alerts ?? []), ...(healthFactor?.alerts ?? [])],
    platformBonus: reserves.overview?.platformBonus,
    // Listed unless the server says there is nothing, as the market page read it
    hasHistory: !reserves.overview?.history?.disabled,
  };
}

const sumValues = (assets: IDeFiAsset[]) =>
  assets.reduce((sum, asset) => sum.plus(asset.value), new BigNumber(0));

const isSameProvider = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

/**
 * One market's position as My portfolio and the supply page read it: the
 * market's name and logo, the account's rows, the health factor where a loan
 * rides on them
 */
function buildLendingPosition({
  market,
  groupId,
  symbol,
  assets,
  debts,
  health,
  earnings24hFiatValue,
}: {
  market: IBorrowMarketItem;
  groupId: string;
  symbol: string;
  assets: IDeFiAsset[];
  debts: IDeFiAsset[];
  health: ReturnType<typeof readLoanHealth> | undefined;
  earnings24hFiatValue: string;
}): IEarnPortfolioPosition {
  const name = getBorrowMarketLabel(market);
  const netValue = sumValues(assets).minus(sumValues(debts));
  return {
    networkId: market.networkId,
    owner: '',
    protocol: market.provider.toLowerCase(),
    // As the home's split names the protocol
    protocolName:
      market.provider.charAt(0).toUpperCase() + market.provider.slice(1),
    protocolLogo: market.logoURI,
    chain: market.networkId.split('--')[0] ?? '',
    category: 'lending',
    assets,
    debts,
    rewards: [],
    metrics: { healthFactor: health?.value ?? null },
    source: {
      provider: EARN_LENDING_MARKET_SOURCE,
      fetchedAt: '',
      ttl: 0,
      cached: false,
    },
    groupId,
    name,
    earn: {
      manage: {
        networkId: market.networkId,
        provider: market.provider,
        symbol,
        vault: market.marketAddress,
      },
      action: 'manage',
      symbol,
      vault: market.marketAddress,
      vaultName: name,
      providerLogoURI: market.logoURI,
      network: {
        networkId: market.networkId,
        name: market.network.name,
        logoURI: market.network.logoURI,
      },
      investment: {
        totalFiatValue: netValue.toFixed(),
        earnings24hFiatValue,
      },
      healthFactorDetail: health?.detail,
    },
  };
}

/**
 * The account's positions in the lending markets that the positions API
 * leaves out, one per market, as the DeFi home's Net Worth counts them: what
 * the account supplies there that no position reports, and what it borrows,
 * with the market's health factor as the Borrow page reads it. Merged into
 * the response, they total, group and filter as the API's own (demo 10-29).
 * Each row carries its reserve and the account it was read for, so the card
 * withdraws, repays and switches collateral as the market page does (demo
 * 11-03)
 */
export function withLendingMarketPositions({
  response,
  entries,
  indexedAccountId,
}: {
  response: IEarnPortfolioPositionsResponse;
  entries: IEarnDesktopAccountMarket[];
  /** The account the markets were read for, for the windows the rows open */
  indexedAccountId?: string;
}): IEarnPortfolioPositionsResponse {
  const reported = Object.values(response.positions).flat();
  const added: IEarnPortfolioPosition[] = [];
  entries.forEach(({ market, accountId, reserves, healthFactor }) => {
    if (!reserves) {
      return;
    }
    const marketRef: IEarnLendingMarketRef | undefined = accountId
      ? {
          market,
          accountId,
          indexedAccountId,
          summary: buildLendingMarketSummary({ reserves, healthFactor }),
        }
      : undefined;
    const own = reported.filter(
      (position) =>
        position.networkId === market.networkId &&
        isSameProvider(
          position.earn.manage.provider || position.protocol,
          market.provider,
        ),
    );
    // What the API reports already stays its own: the home leaves it out of
    // the supply it adds, and a loan the API sends keeps its card
    const reportedSymbols = new Set(
      own.flatMap((position) =>
        position.assets.map((asset) => asset.symbol.toUpperCase()),
      ),
    );
    const isLoanReported = own.some(
      (position) =>
        position.category === 'lending' && position.debts.length > 0,
    );
    const assets = (reserves.supplied?.assets ?? [])
      .filter(
        (asset) =>
          toBigNumber(asset.suppliedAmount?.fiatValue).gt(0) &&
          !reportedSymbols.has(asset.token.symbol.toUpperCase()),
      )
      .map((asset) =>
        toDeFiAsset({
          token: asset.token,
          balance: asset.suppliedAmount,
          lending: marketRef
            ? { side: 'supplied', reserve: asset, market: marketRef }
            : undefined,
        }),
      );
    const debts = isLoanReported
      ? []
      : (reserves.borrowed?.assets ?? [])
          .filter((asset) => toBigNumber(asset.borrowedAmount?.fiatValue).gt(0))
          .map((asset) =>
            toDeFiAsset({
              token: asset.token,
              balance: asset.borrowedAmount,
              lending: marketRef
                ? { side: 'borrowed', reserve: asset, market: marketRef }
                : undefined,
            }),
          );
    if (!assets.length && !debts.length) {
      return;
    }
    const health = debts.length ? readLoanHealth(healthFactor) : undefined;
    added.push(
      buildLendingPosition({
        market,
        groupId: buildBorrowMarketKey(market),
        symbol: assets[0]?.symbol ?? debts[0]?.symbol ?? '',
        assets,
        debts,
        health,
        earnings24hFiatValue: '0',
      }),
    );
  });
  if (!added.length) {
    return response;
  }
  const positions = { ...response.positions };
  added.forEach((position) => {
    positions[position.networkId] = [
      ...(positions[position.networkId] ?? []),
      position,
    ];
  });
  return { ...response, positions };
}

/** The account's supplied row of one reserve in the market, if it has one */
export function findSuppliedReserve({
  entry,
  reserveAddress,
}: {
  entry: IEarnDesktopAccountMarket;
  reserveAddress: string;
}) {
  // A network's own coin is the empty address (Aave's ETH)
  return entry.reserves?.supplied?.assets?.find(
    (asset) =>
      asset.reserveAddress.toLowerCase() === reserveAddress.toLowerCase(),
  );
}

/**
 * The account's supply of one reserve, as that reserve's supply page shows it
 * (demo 10-29): its row alone, the borrowing staying with Loans. The market's
 * health factor comes with it where a loan rides on the supply, that is where
 * the market has a loan and counts this supply as collateral (Kamino doesn't
 * say, and counts every deposit). Its day's earnings are its value at the
 * reserve's supply rate. Undefined while there is nothing supplied
 */
export function lendingSupplyPositionOf({
  entry,
  reserveAddress,
}: {
  entry: IEarnDesktopAccountMarket;
  reserveAddress: string;
}): IEarnPortfolioPosition | undefined {
  const { market, reserves, healthFactor } = entry;
  const supplied = findSuppliedReserve({ entry, reserveAddress });
  if (!supplied) {
    return undefined;
  }
  const asset = toDeFiAsset({
    token: supplied.token,
    balance: supplied.suppliedAmount,
  });
  // Dust worth less than a cent is still the account's: the amount decides
  if (!new BigNumber(asset.amount).gt(0)) {
    return undefined;
  }
  const hasLoan = (reserves?.borrowed?.assets ?? []).some((loan) =>
    hasPositiveBorrowBalance(loan.borrowedAmount),
  );
  const backsLoan = hasLoan && supplied.usageAsCollateral !== false;
  const value = toBigNumber(supplied.suppliedAmount.fiatValue);
  const apy = toBigNumber(supplied.apyDetail?.apy);
  return buildLendingPosition({
    market,
    groupId: `${buildBorrowMarketKey(market)}:${supplied.reserveAddress}`,
    symbol: supplied.token.symbol,
    assets: [asset],
    debts: [],
    health: backsLoan ? readLoanHealth(healthFactor) : undefined,
    earnings24hFiatValue: value.times(apy).div(100).div(365).toFixed(),
  });
}

/**
 * The account's Borrow transactions still out in one market, which its
 * card counts beside its name. A market is told by its network and its
 * provider: the transactions' tags name no market
 */
export function lendingPendingTxsOf({
  pendingTxs,
  market,
}: {
  pendingTxs: readonly IStakePendingTx[];
  market: IEarnLendingMarketRef;
}): IStakePendingTx[] {
  const provider = market.market.provider.toLowerCase();
  return pendingTxs.filter((tx) => {
    if (
      tx.decodedTx.networkId !== market.market.networkId ||
      tx.decodedTx.accountId !== market.accountId
    ) {
      return false;
    }
    const providers = (tx.stakingInfo.tags ?? [])
      .map((tag) => parseBorrowTag(tag)?.provider.toLowerCase())
      .filter(Boolean);
    // One tagged with the bare Borrow label is the network's market's
    return providers.length === 0 || providers.includes(provider);
  });
}

/** One reward of a lending market, as the market's rewards window lists it */
export type IEarnLendingRewardRow = {
  /** Its own among the card's rows */
  key: string;
  /** The server's claim: rewards that go out together share one */
  claimId: string;
  symbol: string;
  logoURI: string;
  amount: IEarnText;
  value?: IEarnText;
  /** Claimed on the protocol's own site, which the window links to */
  isElsewhere: boolean;
};

/** A lending card's Rewards section: a line per reward, as its other panels */
export type IEarnLendingRewards = {
  /** The section's name, the server's ("Rewards") */
  title?: string;
  /** The button's word, the server's ("Claim") */
  buttonText?: string;
  rows: IEarnLendingRewardRow[];
};

/**
 * What the account can claim in a lending market, a line per reward as the
 * market's rewards window lists them. Nothing while the server has the
 * claim off or lists no reward
 */
export function lendingRewardsOf(
  borrowRewards: IBorrowRewards | null | undefined,
): IEarnLendingRewards | undefined {
  if (!borrowRewards?.button || borrowRewards.button.disabled) {
    return undefined;
  }
  const detail = borrowRewards.button.data?.rewardsDetail;
  const rows: IEarnLendingRewardRow[] = [];
  (detail?.claimable ?? []).forEach((group) =>
    group.items.forEach((item) => {
      rows.push({
        key: `claim:${rows.length}:${item.id}`,
        claimId: item.id,
        symbol: item.token.symbol,
        logoURI: item.token.logoURI,
        amount: item.title,
        value: item.description,
        isElsewhere: false,
      });
    }),
  );
  (detail?.unclaimable ?? []).forEach((group) =>
    group.items.forEach((item) => {
      rows.push({
        key: `elsewhere:${rows.length}:${item.id}`,
        claimId: item.id,
        symbol: item.token.symbol,
        logoURI: item.token.logoURI,
        amount: item.title,
        value: item.description,
        isElsewhere: true,
      });
    }),
  );
  if (!rows.length) {
    return undefined;
  }
  return {
    title: borrowRewards.title?.text || undefined,
    buttonText: borrowRewards.button.text?.text || undefined,
    rows,
  };
}
