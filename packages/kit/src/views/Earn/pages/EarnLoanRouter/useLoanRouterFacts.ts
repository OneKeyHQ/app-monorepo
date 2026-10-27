import { useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EBorrowProviderEnum } from '@onekeyhq/shared/types/staking';

import { toLtvFraction } from '../../components/desktopHome/earnDesktopHome.utils';
import { parseFormattedLiquidityValue } from '../../utils/availableAssetsUtils';

import { isSameReserve, parseLoanFigure } from './loanRouter.utils';

import type {
  ILoanPositionAsset,
  ILoanRoute,
  ILoanRouteFacts,
} from './loanRouter.utils';

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
  | 'canBorrowHere'
  | 'walletBalance'
>;

/** The account's position in the route's market, from its reserve lists */
export async function readLoanRoutePosition({
  route,
  networkAccountId,
}: {
  route: ILoanRoute;
  networkAccountId: string;
}): Promise<ILoanRoutePosition | undefined> {
  const { market } = route;
  const reserves = await backgroundApiProxy.serviceStaking
    .getBorrowReserves({
      provider: market.provider,
      networkId: market.networkId,
      marketAddress: market.marketAddress,
      accountId: networkAccountId,
    })
    .catch(() => undefined);
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
  let collateralValue = 0;
  let collateralSupplied = 0;
  let collateralWeighted = 0;
  const collateralAssets: ILoanPositionAsset[] = [];
  (reserves.supplied?.assets ?? []).forEach((asset) => {
    const value = toNumber(asset.suppliedAmount?.fiatValue);
    // Off as collateral (a switch, or an asset that never counts)
    const counts =
      asset.usageAsCollateral !== false && asset.canBeCollateral !== false;
    const weighted = counts ? value * toLtvFraction(asset.liquidationLtv) : 0;
    weightedCollateral += weighted;
    collateralValue += counts ? value : 0;
    if (counts && value > 0) {
      collateralAssets.push({
        symbol: asset.token.symbol,
        logoURI: asset.token.logoURI,
      });
    }
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
  const debtValue = borrowed.reduce(
    (sum, asset) => sum + toNumber(asset.borrowedAmount?.fiatValue),
    0,
  );
  const debtAssets: ILoanPositionAsset[] = borrowed
    .filter((asset) => toNumber(asset.borrowedAmount?.fiatValue) > 0)
    .map((asset) => ({
      symbol: asset.token.symbol,
      logoURI: asset.token.logoURI,
    }));
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
    canBorrowHere: Boolean(lent),
    walletBalance: held?.walletBalance?.amount ?? held?.walletBalance?.number,
  };
}

async function readRouteFacts({
  route,
  account,
}: {
  route: ILoanRoute;
  account: ILoanRouterAccount;
}): Promise<ILoanRouteFacts> {
  const { market } = route;
  const marketParams = {
    provider: market.provider,
    networkId: market.networkId,
    marketAddress: market.marketAddress,
  };
  const networkAccountId = await getLoanNetworkAccountId({
    account,
    networkId: market.networkId,
  });
  const [collateralDetail, borrowDetail, position] = await Promise.all([
    backgroundApiProxy.serviceStaking
      .getBorrowReserveDetails({
        ...marketParams,
        reserveAddress: route.collateral.reserveAddress,
      })
      .catch(() => undefined),
    backgroundApiProxy.serviceStaking
      .getBorrowReserveDetails({
        ...marketParams,
        reserveAddress: route.borrow.reserveAddress,
      })
      .catch(() => undefined),
    networkAccountId
      ? readLoanRoutePosition({ route, networkAccountId })
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
    const status = await backgroundApiProxy.serviceStaking
      .getBorrowEModeStatus({ ...marketParams, accountId: networkAccountId })
      .catch(() => undefined);
    if (status?.eModeId) {
      eModeLabel = status.categories.find(
        (category) => category.eModeId === status.eModeId,
      )?.label;
    }
  }
  return {
    hasAccount: Boolean(networkAccountId),
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
    // Without the account's list there is no telling: the server decides
    canBorrowHere: position ? position.canBorrowHere : true,
    walletBalance: position?.walletBalance,
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
      const entries = await Promise.all(
        routes.map(
          async (route) =>
            [route.key, await readRouteFacts({ route, account })] as const,
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
