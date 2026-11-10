import { useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EBorrowProviderEnum } from '@onekeyhq/shared/types/staking';

import {
  countsAsLoanCollateral,
  readLoanHealth,
  summarizeLoanPosition,
  summarizeLoanPositionYield,
  toLtvFraction,
} from '../../components/desktopHome/earnDesktopHome.utils';
import { parseFormattedLiquidityValue } from '../../utils/availableAssetsUtils';

import { isSameReserve, parseLoanFigure } from './loanRouter.utils';

import type { ILoanRoute, ILoanRouteFacts } from './loanRouter.utils';

// A market's figures move slowly; the position after a supply or a loan is
// read again by the run itself
const FACTS_POLLING_INTERVAL = 30_000;

const toNumber = (value?: string | number) => {
  const parsed = new BigNumber(value ?? 0);
  return parsed.isFinite() ? parsed.toNumber() : 0;
};

export type ILoanRouterAccount = {
  accountId: string;
  indexedAccountId?: string;
};

/** The account the app shows, as the DeFi home reads it for the Loans list */
export function useLoanRouterAccount(): ILoanRouterAccount {
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const {
    activeAccount: { indexedAccount },
  } = useActiveAccount({ num: 0 });
  const accountId = selectedAccount.othersWalletAccountId || '';
  const indexedAccountId =
    selectedAccount.indexedAccountId || indexedAccount?.id;
  return useMemo(
    () => ({ accountId, indexedAccountId }),
    [accountId, indexedAccountId],
  );
}

/** The account to send from on a network, if the wallet has one there */
export async function getLoanNetworkAccountId({
  account,
  networkId,
}: {
  account: ILoanRouterAccount;
  networkId: string;
}) {
  if (!account.accountId && !account.indexedAccountId) {
    return undefined;
  }
  const earnAccount = await backgroundApiProxy.serviceStaking
    .getEarnAccount({
      accountId: account.accountId,
      networkId,
      indexedAccountId: account.indexedAccountId,
    })
    .catch(() => undefined);
  return earnAccount?.accountId || undefined;
}

export type ILoanRoutePosition = Pick<
  ILoanRouteFacts,
  | 'weightedCollateral'
  | 'debt'
  | 'collateralValue'
  | 'debtValue'
  | 'collateralSupplied'
  | 'collateralWeighted'
  | 'borrowableNow'
  | 'collateralAssets'
  | 'debtAssets'
  | 'positionNetValue'
  | 'positionAnnualNet'
  | 'canBorrowHere'
  | 'walletBalance'
  | 'healthFactorDetail'
  | 'hasHistory'
>;

type IMarketParams = {
  provider: string;
  networkId: string;
  marketAddress: string;
};

const readMarketPosition = (params: IMarketParams & { accountId: string }) =>
  // The health factor alongside, so a position's figure is the server's
  Promise.all([
    backgroundApiProxy.serviceStaking
      .getBorrowReserves(params)
      .catch(() => undefined),
    backgroundApiProxy.serviceStaking
      .getBorrowHealthFactor(params)
      .catch(() => undefined),
  ]);

/**
 * One read of every route's figures asks each thing once: a kind of token
 * on either side lists many pairs in the same markets, which share the
 * account's position there, their reserves and the network's account
 */
export function createLoanReads() {
  const kept = new Map<string, Promise<unknown>>();
  const once = <T>(key: string, read: () => Promise<T>): Promise<T> => {
    let promise = kept.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = read();
      kept.set(key, promise);
    }
    return promise;
  };
  const marketKey = (params: IMarketParams) =>
    `${params.provider}|${params.networkId}|${params.marketAddress}`;
  return {
    networkAccountId: (account: ILoanRouterAccount, networkId: string) =>
      once(`account|${networkId}`, () =>
        getLoanNetworkAccountId({ account, networkId }),
      ),
    reserveDetails: (params: IMarketParams & { reserveAddress: string }) =>
      once(`reserve|${marketKey(params)}|${params.reserveAddress}`, () =>
        backgroundApiProxy.serviceStaking
          .getBorrowReserveDetails(params)
          .catch(() => undefined),
      ),
    position: (params: IMarketParams & { accountId: string }) =>
      once(`position|${marketKey(params)}|${params.accountId}`, () =>
        readMarketPosition(params),
      ),
    eModeStatus: (params: IMarketParams & { accountId: string }) =>
      once(`eMode|${marketKey(params)}|${params.accountId}`, () =>
        backgroundApiProxy.serviceStaking
          .getBorrowEModeStatus(params)
          .catch(() => undefined),
      ),
  };
}

export type ILoanReads = ReturnType<typeof createLoanReads>;

/** The account's position in the route's market, from its reserve lists */
export async function readLoanRoutePosition({
  route,
  networkAccountId,
  reads,
}: {
  route: ILoanRoute;
  networkAccountId: string;
  // Shared with the other routes read at the same time
  reads?: ILoanReads;
}): Promise<ILoanRoutePosition | undefined> {
  const { market } = route;
  const marketParams = {
    provider: market.provider,
    networkId: market.networkId,
    marketAddress: market.marketAddress,
    accountId: networkAccountId,
  };
  const [reserves, healthFactor] = reads
    ? await reads.position(marketParams)
    : await readMarketPosition(marketParams);
  if (!reserves) {
    return undefined;
  }
  const collateralKey = {
    reserveAddress: route.collateral.reserveAddress,
    symbol: route.collateral.symbol,
  };
  const borrowKey = {
    reserveAddress: route.borrow.reserveAddress,
    symbol: route.borrow.symbol,
  };
  let weightedCollateral = 0;
  let collateralSupplied = 0;
  let collateralWeighted = 0;
  (reserves.supplied?.assets ?? []).forEach((asset) => {
    const value = toNumber(asset.suppliedAmount?.fiatValue);
    // Off as collateral (a switch, or an asset that never counts)
    const weighted = countsAsLoanCollateral(asset)
      ? value * toLtvFraction(asset.liquidationLtv)
      : 0;
    weightedCollateral += weighted;
    if (
      isSameReserve(
        { reserveAddress: asset.reserveAddress, symbol: asset.token.symbol },
        collateralKey,
      )
    ) {
      collateralSupplied += toNumber(
        asset.suppliedAmount?.amount ?? asset.suppliedAmount?.number,
      );
      collateralWeighted += weighted;
    }
  });
  const borrowed = reserves.borrowed?.assets ?? [];
  const debt = borrowed.reduce(
    (sum, asset) =>
      sum +
      toNumber(asset.borrowedAmount?.fiatValue) *
        (toNumber(asset.borrowFactor) || 1),
    0,
  );
  const { collateralValue, collateralAssets, debtValue, debtAssets } =
    summarizeLoanPosition(reserves);
  const { netValue: positionNetValue, annualNet: positionAnnualNet } =
    summarizeLoanPositionYield(reserves);
  // With an account the list holds only what it can borrow here: Aave's
  // E-Mode leaves out the assets outside its category
  const lent = (reserves.borrow?.assets ?? []).find((asset) =>
    isSameReserve(
      { reserveAddress: asset.reserveAddress, symbol: asset.token.symbol },
      borrowKey,
    ),
  );
  const held = (reserves.supply?.assets ?? []).find((asset) =>
    isSameReserve(
      { reserveAddress: asset.reserveAddress, symbol: asset.token.symbol },
      collateralKey,
    ),
  );
  return {
    weightedCollateral,
    debt,
    collateralValue,
    debtValue,
    collateralSupplied,
    collateralWeighted,
    borrowableNow: toNumber(lent?.available?.fiatValue),
    collateralAssets,
    debtAssets,
    positionNetValue,
    positionAnnualNet,
    canBorrowHere: Boolean(lent),
    walletBalance: held?.walletBalance?.amount ?? held?.walletBalance?.number,
    healthFactorDetail:
      debtValue > 0 ? readLoanHealth(healthFactor).detail : undefined,
    // Listed unless the server says there is nothing, as the market's own
    // page read it
    hasHistory: !reserves.overview?.history?.disabled,
  };
}

async function readRouteFacts({
  route,
  account,
  reads,
}: {
  route: ILoanRoute;
  account: ILoanRouterAccount;
  reads: ILoanReads;
}): Promise<ILoanRouteFacts> {
  const { market } = route;
  const marketParams = {
    provider: market.provider,
    networkId: market.networkId,
    marketAddress: market.marketAddress,
  };
  const networkAccountId = await reads.networkAccountId(
    account,
    market.networkId,
  );
  const [collateralDetail, borrowDetail, position] = await Promise.all([
    reads.reserveDetails({
      ...marketParams,
      reserveAddress: route.collateral.reserveAddress,
    }),
    reads.reserveDetails({
      ...marketParams,
      reserveAddress: route.borrow.reserveAddress,
    }),
    networkAccountId
      ? readLoanRoutePosition({ route, networkAccountId, reads })
      : undefined,
  ]);
  const maxLtvPercent = parseLoanFigure(
    collateralDetail?.supply?.maxLtv?.text?.text,
  );
  // Kamino answers "0.00" for reserves that do lend: a zero is no answer,
  // and the server's own check stands then
  const liquidity = parseFormattedLiquidityValue(borrowDetail?.liquidity);
  // Aave names the E-Mode that keeps the loan out
  let eModeLabel: string | undefined;
  if (
    networkAccountId &&
    position &&
    !position.canBorrowHere &&
    market.provider.toLowerCase() === EBorrowProviderEnum.Aave
  ) {
    const status = await reads.eModeStatus({
      ...marketParams,
      accountId: networkAccountId,
    });
    if (status?.eModeId) {
      eModeLabel = status.categories.find(
        (category) => category.eModeId === status.eModeId,
      )?.label;
    }
  }
  return {
    // With no wallet at all every market shows its rates, and the window's
    // button connects one (demo 10-29)
    hasAccount:
      Boolean(networkAccountId) ||
      (!account.accountId && !account.indexedAccountId),
    networkAccountId,
    collateralPrice:
      parseLoanFigure(collateralDetail?.oraclePrice) || undefined,
    borrowPrice: parseLoanFigure(borrowDetail?.oraclePrice) || undefined,
    maxLtv: maxLtvPercent !== undefined ? maxLtvPercent / 100 : undefined,
    liquidity: liquidity > 0 ? liquidity : undefined,
    weightedCollateral: position?.weightedCollateral ?? 0,
    debt: position?.debt ?? 0,
    collateralValue: position?.collateralValue ?? 0,
    debtValue: position?.debtValue ?? 0,
    collateralSupplied: position?.collateralSupplied ?? 0,
    collateralWeighted: position?.collateralWeighted ?? 0,
    borrowableNow: position?.borrowableNow ?? 0,
    collateralAssets: position?.collateralAssets ?? [],
    debtAssets: position?.debtAssets ?? [],
    positionNetValue: position?.positionNetValue ?? 0,
    positionAnnualNet: position?.positionAnnualNet ?? 0,
    // Without the account's list there is no telling: the server decides
    canBorrowHere: position ? position.canBorrowHere : true,
    walletBalance: position?.walletBalance,
    healthFactorDetail: position?.healthFactorDetail,
    hasHistory: position?.hasHistory ?? false,
    eModeLabel,
  };
}

/**
 * Each route's figures for the account: prices, the collateral's Max LTV,
 * what the market has left to lend, and the account's position there. A
 * route keeps its last answer while the next one is read
 */
export function useLoanRouterFacts({ routes }: { routes: ILoanRoute[] }) {
  const account = useLoanRouterAccount();
  const routesKey = routes.map((route) => route.key).join(',');
  const scope = `${account.accountId}|${account.indexedAccountId ?? ''}`;
  const lastRef = useRef<{
    scope: string;
    byRoute: Map<string, ILoanRouteFacts>;
  }>({ scope, byRoute: new Map() });
  if (lastRef.current.scope !== scope) {
    lastRef.current = { scope, byRoute: new Map() };
  }

  const { result, isLoading, run } = usePromiseResult(
    async () => {
      const reads = createLoanReads();
      const entries = await Promise.all(
        routes.map(
          async (route) =>
            [
              route.key,
              await readRouteFacts({ route, account, reads }),
            ] as const,
        ),
      );
      return { scope, routesKey, byRoute: new Map(entries) };
    },
    // routesKey stands in for the routes, rebuilt on every market poll
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routesKey, scope],
    {
      watchLoading: true,
      pollingInterval: FACTS_POLLING_INTERVAL,
      // A token picked in the boxes' popover changes the routes while the
      // popover still holds the page's focus: the read mustn't wait for a
      // focus that already came back
      checkIsFocused: false,
    },
  );

  const byRoute = useMemo(() => {
    const merged = new Map(lastRef.current.byRoute);
    if (result?.scope === scope) {
      result.byRoute.forEach((facts, key) => merged.set(key, facts));
    }
    lastRef.current.byRoute = merged;
    return merged;
  }, [result, scope]);

  return {
    account,
    byRoute,
    // Every route asked for has an answer
    isLoaded: routes.every((route) => byRoute.has(route.key)),
    isLoading: Boolean(isLoading),
    refresh: run,
  };
}
