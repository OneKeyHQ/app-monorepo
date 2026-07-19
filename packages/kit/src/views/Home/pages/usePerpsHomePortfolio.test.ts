import fs from 'fs';
import path from 'path';

import {
  type IPerpsHomePortfolioResult,
  isPerpsHomeAsyncScopeCurrent,
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
}): IPerpsHomePortfolioResult {
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

  it('invalidates focus and deposit work synchronously on a scope change', () => {
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
    expect(scopeChangeBlock).toContain('focusRefreshNonceRef.current += 1');
    expect(scopeChangeBlock).toContain('depositRetryNonceRef.current += 1');
    expect(source).toContain(
      'liveAccountScopeKeyRef.current !== requestScopeKey',
    );
    expect(source.match(/isPerpsHomeAsyncScopeCurrent\(/g)).toHaveLength(2);
  });
});
