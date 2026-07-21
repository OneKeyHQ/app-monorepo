interface IPerpsHomePortfolioResult<TView = unknown> {
  address: string;
  errorKind?: 'source' | 'transport' | 'schemaMismatch' | 'runtimeUnavailable';
  scopeKey: string | undefined;
  view: TView | undefined;
  requestResolved: boolean;
}

interface IPerpsHomeAsyncScope {
  address: string | undefined;
  scopeKey: string | undefined;
}

type IPerpsHomePortfolioEvidence<TView> =
  | { kind: 'loading' }
  | {
      kind: 'complete';
      confirmedEmpty: boolean;
      data:
        | {
            address: string;
            scopeKey: string | undefined;
            view: TView;
          }
        | undefined;
      rowIds: readonly string[];
    }
  | {
      kind: 'error';
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    };

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

function selectCurrentPerpsHomePortfolioResult<
  TResult extends IPerpsHomePortfolioResult,
>({
  currentScopeKey,
  incoming,
  previous,
}: {
  currentScopeKey: string | undefined;
  incoming: TResult | undefined;
  previous: TResult | undefined;
}): TResult | undefined {
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

function projectPerpsHomePortfolioEvidence<TView extends { isEmpty: boolean }>(
  currentResult: IPerpsHomePortfolioResult<TView> | undefined,
): IPerpsHomePortfolioEvidence<TView> {
  if (currentResult?.errorKind) {
    return { kind: 'error', errorKind: currentResult.errorKind };
  }
  if (!currentResult || !currentResult.requestResolved) {
    return { kind: 'loading' };
  }
  if (!currentResult.view || currentResult.view.isEmpty) {
    return {
      kind: 'complete',
      confirmedEmpty: true,
      data: undefined,
      rowIds: [],
    };
  }
  return {
    kind: 'complete',
    confirmedEmpty: false,
    data: {
      address: currentResult.address,
      scopeKey: currentResult.scopeKey,
      view: currentResult.view,
    },
    rowIds: ['perps'],
  };
}

export {
  isPerpsHomeAsyncScopeCurrent,
  projectPerpsHomePortfolioEvidence,
  resolvePerpsHomeAmountAuthority,
  selectCurrentPerpsHomePortfolioResult,
};
export type {
  IPerpsHomeAsyncScope,
  IPerpsHomePortfolioEvidence,
  IPerpsHomePortfolioResult,
};
