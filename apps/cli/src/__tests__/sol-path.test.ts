import {
  SOL_PATH_TEMPLATE,
  resolveSolPath,
  validateSolNetworkId,
} from '../signer/impls/sol/sol-path';

describe('resolveSolPath', () => {
  it('substitutes the index placeholder for account 0', () => {
    expect(resolveSolPath(0)).toBe("m/44'/501'/0'/0'");
  });

  it('substitutes the index placeholder for higher accounts', () => {
    expect(resolveSolPath(7)).toBe("m/44'/501'/7'/0'");
  });

  it('rejects negative indices', () => {
    expect(() => resolveSolPath(-1)).toThrow(/Invalid SOL account index/);
  });

  it('rejects non-integer indices', () => {
    expect(() => resolveSolPath(2.5)).toThrow(/Invalid SOL account index/);
  });

  it('exposes the template for callers that need it raw (HD)', () => {
    // This is the OneKey/Phantom/Sollet standard. Mirrors
    // packages/kit-bg/src/vaults/impls/sol/settings.ts:33 — drift between
    // the CLI and the App would mean addresses derived from the same
    // mnemonic do not match, so this test is a regression guard.
    expect(SOL_PATH_TEMPLATE).toBe("m/44'/501'/$$INDEX$$'/0'");
  });
});

describe('validateSolNetworkId', () => {
  it('accepts the SOL mainnet networkId', () => {
    expect(() => validateSolNetworkId('sol--101')).not.toThrow();
  });

  it('rejects an unknown SOL networkId', () => {
    expect(() => validateSolNetworkId('sol--999999')).toThrow(
      /Unsupported SOL networkId/,
    );
  });

  it('rejects a non-SOL networkId', () => {
    expect(() => validateSolNetworkId('evm--1')).toThrow(
      /Unsupported SOL networkId/,
    );
  });
});
