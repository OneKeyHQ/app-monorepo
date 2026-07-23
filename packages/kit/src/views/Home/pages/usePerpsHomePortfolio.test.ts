import fs from 'fs';
import path from 'path';

import {
  type IPerpsHomePortfolioResult,
  isPerpsHomeAsyncScopeCurrent,
  projectPerpsHomePortfolioEvidence,
  resolvePerpsHomeAmountAuthority,
  selectCurrentPerpsHomePortfolioResult,
} from './perpsHomePortfolioAuthority';

const scopeA = 'account:account-a';
const scopeB = 'account:account-b';
const sharedAddress = '0xabcdef';

function result({
  address = sharedAddress,
  requestResolved = true,
  scopeKey,
}: {
  address?: string;
  requestResolved?: boolean;
  scopeKey: string;
}): IPerpsHomePortfolioResult<{ isEmpty: boolean }> {
  return {
    address,
    requestResolved,
    scopeKey,
    view: undefined,
  };
}

describe('Perps Home amount authority scope gates', () => {
  it('keeps B success when a same-address A main request resolves late', () => {
    const bSuccess = result({ scopeKey: scopeB });
    expect(
      selectCurrentPerpsHomePortfolioResult({
        currentScopeKey: scopeB,
        incoming: result({ scopeKey: scopeA }),
        previous: bSuccess,
      }),
    ).toBe(bSuccess);
    expect(resolvePerpsHomeAmountAuthority(bSuccess)).toEqual({
      scopeKey: scopeB,
      status: 'success',
    });
  });

  it('starts B as loading instead of reusing a same-address A result', () => {
    const current = selectCurrentPerpsHomePortfolioResult({
      currentScopeKey: scopeB,
      incoming: result({ scopeKey: scopeA }),
      previous: result({ scopeKey: scopeA }),
    });
    expect(current).toBeUndefined();
    expect(resolvePerpsHomeAmountAuthority(current)).toEqual({
      scopeKey: undefined,
      status: 'loading',
    });
  });

  it('rejects same-address focus refresh completion from the old scope', () => {
    expect(
      isPerpsHomeAsyncScopeCurrent({
        captured: { address: sharedAddress, scopeKey: scopeA },
        live: { address: sharedAddress, scopeKey: scopeB },
      }),
    ).toBe(false);
    expect(
      isPerpsHomeAsyncScopeCurrent({
        captured: { address: '0xABCDEF', scopeKey: scopeB },
        live: { address: sharedAddress, scopeKey: scopeB },
      }),
    ).toBe(true);
  });

  it('rejects deposit completion after either scope or address changes', () => {
    expect(
      isPerpsHomeAsyncScopeCurrent({
        captured: { address: sharedAddress, scopeKey: scopeA },
        live: { address: sharedAddress, scopeKey: scopeB },
      }),
    ).toBe(false);
    expect(
      isPerpsHomeAsyncScopeCurrent({
        captured: { address: sharedAddress, scopeKey: scopeB },
        live: { address: '0x1234', scopeKey: scopeB },
      }),
    ).toBe(false);
  });

  it('invalidates deposit work synchronously on a scope change', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'usePerpsHomePortfolio.ts'),
      'utf8',
    );
    const scopeChangeBlock = source.slice(
      source.indexOf(
        'if (previousAccountScopeKeyRef.current !== currentAccountScopeKey)',
      ),
      source.indexOf(
        'const currentResult = selectCurrentPerpsHomePortfolioResult',
      ),
    );
    expect(scopeChangeBlock).toContain('depositRetryNonceRef.current += 1');
    expect(source).toContain(
      'liveAccountScopeKeyRef.current !== requestScopeKey',
    );
    expect(source.match(/isPerpsHomeAsyncScopeCurrent\(/g)).toHaveLength(2);
  });

  it('uses the polling focus gate as the only tab-refocus scheduler', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'usePerpsHomePortfolio.ts'),
      'utf8',
    );

    expect(source).toContain(
      'overrideIsFocused: (isPageFocused) => isPageFocused && isSourceActive',
    );
    expect(source).not.toContain('useTabIsRefreshingFocused');
    expect(source).not.toContain('focusRefreshNonceRef');
    expect(source).not.toContain('wasTabFocusedRef');
    expect(source.match(/force: true/g)).toHaveLength(1);
  });

  it('opens Store request tokens before each real background request', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'usePerpsHomePortfolio.ts'),
      'utf8',
    );
    const mainRequestSource = source.slice(
      source.indexOf('async () => {'),
      source.indexOf('const depositRetryTimerRef'),
    );
    const mainBeginIndex = mainRequestSource.indexOf(
      'beginHomeSectionRequest({',
    );
    expect(mainBeginIndex).toBeGreaterThan(-1);
    [
      'getGlobalDeriveTypeOfNetwork(',
      'getNetworkAccount(',
      'getHyperliquidPortfolioSnapshot(',
    ].forEach((requestCall) => {
      expect(mainBeginIndex).toBeLessThan(
        mainRequestSource.indexOf(requestCall),
      );
    });

    const depositRequestSource = source.slice(
      source.indexOf('const forceRefreshAfterDeposit'),
      source.indexOf('const startDepositConfirmationRetry'),
    );
    expect(
      depositRequestSource.indexOf('beginHomeSectionRequest({'),
    ).toBeLessThan(
      depositRequestSource.indexOf('getHyperliquidPortfolioSnapshot('),
    );
    expect(source).toContain('completeHomeSectionRequest(');
    expect(source).not.toContain('publishHomeSectionSource');
  });

  it('projects portfolio results to loading empty success and error evidence', () => {
    expect(projectPerpsHomePortfolioEvidence(undefined)).toEqual({
      kind: 'loading',
    });
    expect(
      projectPerpsHomePortfolioEvidence(
        result({ requestResolved: false, scopeKey: scopeA }),
      ),
    ).toEqual({ kind: 'loading' });
    expect(
      projectPerpsHomePortfolioEvidence({
        ...result({ scopeKey: scopeA }),
        errorKind: 'source',
      }),
    ).toEqual({ kind: 'error', errorKind: 'source' });
    expect(
      projectPerpsHomePortfolioEvidence({
        ...result({ scopeKey: scopeA }),
        view: { isEmpty: true },
      }),
    ).toEqual({
      kind: 'complete',
      confirmedEmpty: true,
      data: undefined,
      rowIds: [],
    });

    const view = { isEmpty: false };
    expect(
      projectPerpsHomePortfolioEvidence({
        ...result({ scopeKey: scopeA }),
        view,
      }),
    ).toEqual({
      kind: 'complete',
      confirmedEmpty: false,
      data: {
        address: sharedAddress,
        scopeKey: scopeA,
        view,
      },
      rowIds: ['perps'],
    });
  });

  it('keeps snapshot fetch failures as source errors instead of permanent empty', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'usePerpsHomePortfolio.ts'),
      'utf8',
    );
    expect(source).toContain("errorKind: 'source'");
    expect(source).toContain('requestResolved: true');
    expect(source).toContain(
      'projectPerpsHomePortfolioEvidence(requestResult)',
    );
  });

  it('completes the Store response before exposing the local compatibility result', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'usePerpsHomePortfolio.ts'),
      'utf8',
    );
    const finishRequestSource = source.slice(
      source.indexOf('const finishRequest ='),
      source.indexOf('let address ='),
    );

    expect(
      finishRequestSource.indexOf('completeHomeSectionRequest('),
    ).toBeLessThan(finishRequestSource.indexOf('return requestResult'));
    expect(finishRequestSource.indexOf('completePerpsRequest({')).toBeLessThan(
      finishRequestSource.lastIndexOf('return requestResult'),
    );
    expect(source).not.toContain('requestHandleByResultRef');
    expect(source).not.toContain('publishHomeSectionSource');
  });
});
