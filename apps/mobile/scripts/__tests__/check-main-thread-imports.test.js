const {
  checkEagerBuckets,
  FORBIDDEN_IN_EAGER,
} = require('../check-main-thread-imports');

function buildIdMap({
  common = {},
  main = {},
  background = {},
  segments = {},
} = {}) {
  return { common, main, background, segments };
}

describe('checkEagerBuckets', () => {
  it('returns no violations for a clean idMap', () => {
    const idMap = buildIdMap({
      common: {
        1: 'packages/shared/src/utils/foo.ts',
        2: 'node_modules/react/index.js',
      },
      main: {
        3: 'packages/kit/src/App.tsx',
      },
    });
    const violations = checkEagerBuckets(idMap, FORBIDDEN_IN_EAGER);
    expect(violations).toEqual([]);
  });

  it('flags core/src/secret/curves/ in common bucket', () => {
    const idMap = buildIdMap({
      common: {
        2099: 'packages/core/src/secret/curves/elliptic.ts',
        10_544: 'packages/core/src/secret/curves/index.ts',
        1: 'packages/shared/src/utils/foo.ts',
      },
    });
    const violations = checkEagerBuckets(idMap, FORBIDDEN_IN_EAGER);
    expect(violations.length).toBe(2);
    expect(violations[0].modulePath).toBe(
      'packages/core/src/secret/curves/elliptic.ts',
    );
    expect(violations[0].bucket).toBe('common');
    expect(violations[1].modulePath).toBe(
      'packages/core/src/secret/curves/index.ts',
    );
  });

  it('flags core/src/secret/bip32.ts in main bucket', () => {
    const idMap = buildIdMap({
      main: {
        2093: 'packages/core/src/secret/bip32.ts',
      },
    });
    const violations = checkEagerBuckets(idMap, FORBIDDEN_IN_EAGER);
    expect(violations.length).toBe(1);
    expect(violations[0].rule).toBe('packages/core/src/secret/bip32.ts');
  });

  it('flags core/src/chains/* in eager bundles', () => {
    const idMap = buildIdMap({
      common: {
        5000: 'packages/core/src/chains/btc/sdkBtc/index.ts',
        5001: 'packages/core/src/chains/evm/sdkEvm/signMessage.ts',
      },
    });
    const violations = checkEagerBuckets(idMap, FORBIDDEN_IN_EAGER);
    expect(violations.length).toBe(2);
    for (const v of violations) {
      expect(v.rule).toBe('packages/core/src/chains/');
    }
  });

  it('does NOT flag modules in background bucket', () => {
    const idMap = buildIdMap({
      background: {
        2099: 'packages/core/src/secret/curves/elliptic.ts',
        5000: 'packages/core/src/chains/btc/sdkBtc/index.ts',
      },
    });
    const violations = checkEagerBuckets(idMap, FORBIDDEN_IN_EAGER);
    expect(violations).toEqual([]);
  });

  it('does NOT flag modules in segments', () => {
    const idMap = buildIdMap({
      segments: {
        'seg:kit-bg.vaults.impls.btc.Vault': {
          modules: {
            5000: 'packages/core/src/chains/btc/sdkBtc/index.ts',
          },
        },
      },
    });
    const violations = checkEagerBuckets(idMap, FORBIDDEN_IN_EAGER);
    expect(violations).toEqual([]);
  });

  it('supports regex patterns', () => {
    const customRules = [
      {
        pattern: /secret\/curves\/.*\.ts$/,
        message: 'regex test',
      },
    ];
    const idMap = buildIdMap({
      common: {
        1: 'packages/core/src/secret/curves/elliptic.ts',
        2: 'packages/core/src/secret/index.ts',
      },
    });
    const violations = checkEagerBuckets(idMap, customRules);
    expect(violations.length).toBe(1);
    expect(violations[0].moduleId).toBe(1);
  });

  it('allows core/src/secret/encryptors/ in eager (AES utils are OK)', () => {
    const idMap = buildIdMap({
      common: {
        2100: 'packages/core/src/secret/encryptors/aes256.ts',
      },
    });
    const violations = checkEagerBuckets(idMap, FORBIDDEN_IN_EAGER);
    expect(violations).toEqual([]);
  });
});

// Regression: the current build has forbidden modules in eager.
// This test should FAIL until the refactoring (Task C) is complete,
// at which point the idMap will be clean and this test passes.
describe('FORBIDDEN_IN_EAGER rules cover known offenders', () => {
  it('has rules for curves, bip32, and chains', () => {
    const rulePatterns = FORBIDDEN_IN_EAGER.map((r) =>
      typeof r.pattern === 'string' ? r.pattern : r.pattern.source,
    );
    expect(rulePatterns).toContain('packages/core/src/secret/curves/');
    expect(rulePatterns).toContain('packages/core/src/secret/bip32.ts');
    expect(rulePatterns).toContain('packages/core/src/chains/');
  });
});
