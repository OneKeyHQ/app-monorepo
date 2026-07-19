import { useCallback, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';

import {
  type IHomeBalanceState,
  resolveHomeBalanceState,
} from '../../hooks/useHomeBalanceState';
import { buildOverviewOwnerKey } from '../../states/jotai/contexts/accountOverview';

export type INativeHomeBalanceAuthorityStatus = 'loading' | 'success' | 'error';

export interface INativeHomeBalanceAuthority {
  generation: number;
  scopeKey: string | undefined;
  status: INativeHomeBalanceAuthorityStatus;
}

export interface INativeHomeBalanceAuthorityToken {
  generation: number;
  scopeKey: string;
}

export interface INativeHomeHeaderActionPresentation {
  actionLayout: 'loading' | 'standard' | 'zeroBalance';
  rowHeight: 62 | 82;
  slotKind: 'loading' | 'positive' | 'zero';
}

export interface INativeHomeBalanceScopeCacheEntry {
  scopeKey: string;
  state: Exclude<IHomeBalanceState, 'unknown'>;
}

export interface INativeHomeBalanceScopeCache {
  entries: INativeHomeBalanceScopeCacheEntry[];
}

export const NATIVE_HOME_BALANCE_SCOPE_CACHE_LIMIT = 8;

const nativeHomeFundedOwners = new Set<string>();

appEventBus.on(EAppEventBusNames.WalletRemove, () =>
  nativeHomeFundedOwners.clear(),
);
appEventBus.on(EAppEventBusNames.AccountRemove, () =>
  nativeHomeFundedOwners.clear(),
);

export function buildNativeHomeBalanceScopeKey({
  accountId,
  networkId,
  walletId,
}: {
  accountId: string | undefined;
  networkId: string | undefined;
  walletId: string | undefined;
}): string | undefined {
  if (!accountId || !networkId || !walletId) {
    return undefined;
  }
  return `${walletId}__${accountId}__${networkId}`;
}

export function hasNativeHomeTokenHoldings(
  tokenMaps: Array<
    Record<
      string,
      { balance?: string | number; balanceParsed?: string | number }
    >
  >,
): boolean {
  return tokenMaps.some((tokenMap) =>
    Object.values(tokenMap).some((fiat) =>
      new BigNumber(fiat.balanceParsed || fiat.balance || 0).gt(0),
    ),
  );
}

export function hasNativeHomePortfolioHoldings({
  map,
  smallBalanceMap,
}: {
  map: Record<
    string,
    { balance?: string | number; balanceParsed?: string | number }
  >;
  smallBalanceMap: Record<
    string,
    { balance?: string | number; balanceParsed?: string | number }
  >;
  riskMap?: Record<
    string,
    { balance?: string | number; balanceParsed?: string | number }
  >;
}): boolean {
  // Match Legacy fundedIds: risk-only balances never establish a funded owner.
  return hasNativeHomeTokenHoldings([map, smallBalanceMap]);
}

export function hasNativeHomeNonZeroWorth(
  values: Array<string | number | undefined>,
): boolean {
  return values.some((value) => {
    const worth = new BigNumber(value ?? 0);
    return worth.isFinite() && !worth.isZero();
  });
}

export function resolveNativeHomeConfirmedBalanceIsPositive(
  value: string | undefined,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const amount = new BigNumber(value);
  return amount.isFinite() ? !amount.isZero() : undefined;
}

export function getNativeHomeLastConfirmedBalance({
  accountId,
  byOwner,
  networkId,
}: {
  accountId: string | undefined;
  byOwner: Record<string, string>;
  networkId: string | undefined;
}): string | undefined {
  const ownerKey = buildOverviewOwnerKey(accountId, networkId);
  return ownerKey ? byOwner[ownerKey] : undefined;
}

export function resolveNativeHomeFundedHoldings({
  accountId,
  hasHoldingsNow,
  networkId,
}: {
  accountId: string | undefined;
  hasHoldingsNow: boolean;
  networkId: string | undefined;
}): boolean {
  const ownerKey =
    accountId && networkId ? `${accountId}__${networkId}` : undefined;
  if (ownerKey && hasHoldingsNow) {
    nativeHomeFundedOwners.add(ownerKey);
  }
  return Boolean(
    hasHoldingsNow || (ownerKey && nativeHomeFundedOwners.has(ownerKey)),
  );
}

export function useNativeHomeBalanceAuthorityOwner(
  scopeKey: string | undefined,
): {
  authority: INativeHomeBalanceAuthority;
  begin: () => INativeHomeBalanceAuthorityToken | undefined;
  settle: (
    token: INativeHomeBalanceAuthorityToken | undefined,
    status: Exclude<INativeHomeBalanceAuthorityStatus, 'loading'>,
  ) => void;
} {
  const generationRef = useRef(0);
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;
  const [authority, setAuthority] = useState<INativeHomeBalanceAuthority>({
    generation: 0,
    scopeKey: undefined,
    status: 'loading',
  });

  const begin = useCallback(() => {
    if (!scopeKey) {
      return undefined;
    }
    generationRef.current += 1;
    const token = {
      generation: generationRef.current,
      scopeKey,
    };
    setAuthority((previous) =>
      previous.scopeKey === scopeKey && previous.status === 'success'
        ? previous
        : { ...token, status: 'loading' },
    );
    return token;
  }, [scopeKey]);

  const settle = useCallback(
    (
      token: INativeHomeBalanceAuthorityToken | undefined,
      status: Exclude<INativeHomeBalanceAuthorityStatus, 'loading'>,
    ) => {
      if (
        !token ||
        token.generation !== generationRef.current ||
        token.scopeKey !== scopeKeyRef.current
      ) {
        return;
      }
      setAuthority({ ...token, status });
    },
    [],
  );

  return { authority, begin, settle };
}

function isCurrentSuccessfulAuthority({
  authority,
  currentScopeKey,
}: {
  authority: INativeHomeBalanceAuthority | undefined;
  currentScopeKey: string | undefined;
}) {
  return Boolean(
    currentScopeKey &&
    authority?.scopeKey === currentScopeKey &&
    authority.status === 'success',
  );
}

export function resolveNativeHomeBalanceState({
  currentScopeKey,
  hasCurrentPositiveBalance,
  hasHoldings,
  lastConfirmedBalanceIsPositive,
  hasWallet,
  portfolioAuthority,
}: {
  currentScopeKey: string | undefined;
  hasCurrentPositiveBalance: boolean;
  hasHoldings: boolean;
  lastConfirmedBalanceIsPositive: boolean | undefined;
  hasWallet: boolean;
  portfolioAuthority: INativeHomeBalanceAuthority;
}): IHomeBalanceState {
  if (!hasWallet || !currentScopeKey) {
    return 'unknown';
  }
  if (hasHoldings || hasCurrentPositiveBalance) {
    return 'positive';
  }
  if (lastConfirmedBalanceIsPositive !== undefined) {
    return lastConfirmedBalanceIsPositive ? 'positive' : 'zero';
  }
  if (
    !isCurrentSuccessfulAuthority({
      authority: portfolioAuthority,
      currentScopeKey,
    })
  ) {
    return 'unknown';
  }
  return resolveHomeBalanceState({
    hasWallet: true,
    hasHoldings: false,
    balanceIsPositive: false,
  });
}

export function resolveNativeHomeScopeCachedBalanceState({
  computed,
  previous,
  scopeKey,
}: {
  computed: IHomeBalanceState;
  previous: INativeHomeBalanceScopeCache;
  scopeKey: string | undefined;
}): {
  state: IHomeBalanceState;
  cache: INativeHomeBalanceScopeCache;
} {
  if (!scopeKey) {
    return { state: 'unknown', cache: previous };
  }
  const cached = previous.entries.find((entry) => entry.scopeKey === scopeKey);
  if (computed === 'unknown') {
    return { state: cached?.state ?? 'unknown', cache: previous };
  }
  const entries = previous.entries
    .filter((entry) => entry.scopeKey !== scopeKey)
    .concat({ scopeKey, state: computed })
    .slice(-NATIVE_HOME_BALANCE_SCOPE_CACHE_LIMIT);
  return {
    state: computed,
    cache: { entries },
  };
}

export function resolveNativeHomeHeaderActionPresentation(
  balanceState: IHomeBalanceState,
): INativeHomeHeaderActionPresentation {
  if (balanceState === 'unknown') {
    return {
      actionLayout: 'loading',
      rowHeight: 82,
      slotKind: 'loading',
    };
  }
  if (balanceState === 'zero') {
    return {
      actionLayout: 'zeroBalance',
      rowHeight: 82,
      slotKind: 'zero',
    };
  }
  return {
    actionLayout: 'standard',
    rowHeight: 62,
    slotKind: 'positive',
  };
}
