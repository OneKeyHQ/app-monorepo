import BigNumber from 'bignumber.js';

import { getBorrowMarketLabel } from '@onekeyhq/kit/src/views/Borrow/borrowMarketDisplayName';
import { buildBorrowMarketKey } from '@onekeyhq/kit/src/views/Borrow/borrowMarketKey';
import { hasPositiveBorrowBalance } from '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils';
import { readLoanHealth } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHome.utils';
import type { IEarnDesktopAccountMarket } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/useEarnDesktopHomeData';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';
import type {
  IEarnPortfolioPosition,
  IEarnPortfolioPositionsResponse,
} from '@onekeyhq/shared/types/earn/portfolioPositions';
import type {
  IBorrowBalance,
  IBorrowMarketItem,
  IBorrowToken,
} from '@onekeyhq/shared/types/staking';

/**
 * Where a position the client reads from a lending market itself comes
 * from: such a card opens the market's own page, the Borrow page
 */
export const EARN_LENDING_MARKET_SOURCE = 'onekey-lending-markets';

const toBigNumber = (value?: string) => {
  const parsed = new BigNumber(value ?? 0);
  return parsed.isFinite() ? parsed : new BigNumber(0);
};

function toDeFiAsset({
  token,
  balance,
}: {
  token: IBorrowToken;
  balance: IBorrowBalance;
}): IDeFiAsset {
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
  };
}

const sumValues = (assets: IDeFiAsset[]) =>
  assets.reduce((sum, asset) => sum.plus(asset.value), new BigNumber(0));

const isSameProvider = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

/**
 * One market's position as My portfolio and the supply page read it: the
 * market's name and logo, the account's rows, the health factor where a loan
 * rides on them, opening the market's own page
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
 * the response, they total, group and filter as the API's own (demo 10-29)
 */
export function withLendingMarketPositions({
  response,
  entries,
}: {
  response: IEarnPortfolioPositionsResponse;
  entries: IEarnDesktopAccountMarket[];
}): IEarnPortfolioPositionsResponse {
  const reported = Object.values(response.positions).flat();
  const added: IEarnPortfolioPosition[] = [];
  entries.forEach(({ market, reserves, healthFactor }) => {
    if (!reserves) {
      return;
    }
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
        toDeFiAsset({ token: asset.token, balance: asset.suppliedAmount }),
      );
    const debts = isLoanReported
      ? []
      : (reserves.borrowed?.assets ?? [])
          .filter((asset) => toBigNumber(asset.borrowedAmount?.fiatValue).gt(0))
          .map((asset) =>
            toDeFiAsset({ token: asset.token, balance: asset.borrowedAmount }),
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
