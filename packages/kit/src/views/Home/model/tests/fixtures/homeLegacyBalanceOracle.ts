import type { IHomeBalanceState } from '@onekeyhq/kit/src/hooks/useHomeBalanceState';

type IHomeLegacyBalanceAuthorityStatus = 'loading' | 'success' | 'error';

interface IHomeLegacyBalanceAuthority {
  generation: number;
  scopeKey: string | undefined;
  status: IHomeLegacyBalanceAuthorityStatus;
}

interface IHomeLegacyAmountSourceAuthority {
  included: boolean;
  scopeKey: string | undefined;
  status: IHomeLegacyBalanceAuthorityStatus;
}

interface IHomeLegacyBalanceScopeCache {
  entries: Array<{
    scopeKey: string;
    state: Exclude<IHomeBalanceState, 'unknown'>;
  }>;
}

const HOME_LEGACY_BALANCE_SCOPE_CACHE_LIMIT = 8;

function isCurrentSuccessfulAuthority({
  authority,
  currentScopeKey,
}: {
  authority: IHomeLegacyBalanceAuthority | undefined;
  currentScopeKey: string | undefined;
}) {
  return Boolean(
    currentScopeKey &&
    authority?.scopeKey === currentScopeKey &&
    authority.status === 'success',
  );
}

function resolveHomeLegacyBalanceState({
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
  portfolioAuthority: IHomeLegacyBalanceAuthority;
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
  return isCurrentSuccessfulAuthority({
    authority: portfolioAuthority,
    currentScopeKey,
  })
    ? 'zero'
    : 'unknown';
}

function resolveHomeLegacyScopeCachedBalanceState({
  computed,
  previous,
  scopeKey,
}: {
  computed: IHomeBalanceState;
  previous: IHomeLegacyBalanceScopeCache;
  scopeKey: string | undefined;
}): {
  state: IHomeBalanceState;
  cache: IHomeLegacyBalanceScopeCache;
} {
  if (!scopeKey) {
    return { state: 'unknown', cache: previous };
  }
  const cached = previous.entries.find((entry) => entry.scopeKey === scopeKey);
  if (computed === 'unknown') {
    return { state: cached?.state ?? 'unknown', cache: previous };
  }
  return {
    state: computed,
    cache: {
      entries: previous.entries
        .filter((entry) => entry.scopeKey !== scopeKey)
        .concat({ scopeKey, state: computed })
        .slice(-HOME_LEGACY_BALANCE_SCOPE_CACHE_LIMIT),
    },
  };
}

function resolveHomeLegacyHeaderActionPresentation(
  balanceState: IHomeBalanceState,
) {
  if (balanceState === 'unknown') {
    return {
      actionLayout: 'loading' as const,
      rowHeight: 82 as const,
      slotKind: 'loading' as const,
    };
  }
  if (balanceState === 'zero') {
    return {
      actionLayout: 'zeroBalance' as const,
      rowHeight: 82 as const,
      slotKind: 'zero' as const,
    };
  }
  return {
    actionLayout: 'standard' as const,
    rowHeight: 62 as const,
    slotKind: 'positive' as const,
  };
}

function isCurrentIncludedSourceReady({
  source,
  scopeKey,
}: {
  source: IHomeLegacyAmountSourceAuthority;
  scopeKey: string;
}) {
  return (
    !source.included ||
    (source.scopeKey === scopeKey && source.status === 'success')
  );
}

function resolveHomeLegacyBalanceAmountPresentation({
  confirmedValueUsd,
  deFi,
  liveValueUsd,
  ownerKey,
  perps,
  portfolio,
  scopeKey,
}: {
  confirmedValueUsd: string | undefined;
  deFi: IHomeLegacyAmountSourceAuthority;
  liveValueUsd: string;
  ownerKey: string;
  perps: IHomeLegacyAmountSourceAuthority;
  portfolio: IHomeLegacyAmountSourceAuthority;
  scopeKey: string | undefined;
}) {
  const isFullyReady = Boolean(
    ownerKey &&
    scopeKey &&
    isCurrentIncludedSourceReady({ source: portfolio, scopeKey }) &&
    isCurrentIncludedSourceReady({ source: deFi, scopeKey }) &&
    isCurrentIncludedSourceReady({ source: perps, scopeKey }),
  );
  if (isFullyReady && scopeKey) {
    return {
      commit: { ownerKey, scopeKey, valueUsd: liveValueUsd },
      presentation: { status: 'final' as const, valueUsd: liveValueUsd },
    };
  }
  if (confirmedValueUsd !== undefined) {
    return {
      commit: undefined,
      presentation: {
        status: 'confirmed' as const,
        valueUsd: confirmedValueUsd,
      },
    };
  }
  return {
    commit: undefined,
    presentation: { status: 'loading' as const, valueUsd: undefined },
  };
}

export {
  resolveHomeLegacyBalanceAmountPresentation,
  resolveHomeLegacyBalanceState,
  resolveHomeLegacyHeaderActionPresentation,
  resolveHomeLegacyScopeCachedBalanceState,
};
export type { IHomeLegacyAmountSourceAuthority };
