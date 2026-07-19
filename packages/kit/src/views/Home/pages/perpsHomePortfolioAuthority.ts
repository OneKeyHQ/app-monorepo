interface IPerpsHomePortfolioResult<TView = unknown> {
  address: string;
  scopeKey: string | undefined;
  view: TView | undefined;
  requestResolved: boolean;
}

interface IPerpsHomeAsyncScope {
  address: string | undefined;
  scopeKey: string | undefined;
}

function normalizeAddress(address: string | undefined) {
  return (address || '').toLowerCase();
}

function isPerpsHomeAsyncScopeCurrent({
  captured,
  live,
}: {
  captured: IPerpsHomeAsyncScope;
  live: IPerpsHomeAsyncScope;
}) {
  return (
    captured.scopeKey === live.scopeKey &&
    normalizeAddress(captured.address) === normalizeAddress(live.address)
  );
}

function selectCurrentPerpsHomePortfolioResult<TView>({
  currentScopeKey,
  incoming,
  previous,
}: {
  currentScopeKey: string | undefined;
  incoming: IPerpsHomePortfolioResult<TView> | undefined;
  previous: IPerpsHomePortfolioResult<TView> | undefined;
}) {
  if (incoming?.scopeKey === currentScopeKey) {
    return incoming;
  }
  if (previous?.scopeKey === currentScopeKey) {
    return previous;
  }
  return undefined;
}

function resolvePerpsHomeAmountAuthority(
  currentResult: IPerpsHomePortfolioResult | undefined,
) {
  return {
    scopeKey: currentResult?.scopeKey,
    status:
      currentResult?.requestResolved === true
        ? ('success' as const)
        : ('loading' as const),
  };
}

export {
  isPerpsHomeAsyncScopeCurrent,
  resolvePerpsHomeAmountAuthority,
  selectCurrentPerpsHomePortfolioResult,
};
export type { IPerpsHomeAsyncScope, IPerpsHomePortfolioResult };
