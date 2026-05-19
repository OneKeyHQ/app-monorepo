import {
  EVM_PATH_TEMPLATE,
  resolveEvmPath,
  validateEvmNetworkId,
} from '../signer/impls/evm/evm-path';

describe('resolveEvmPath', () => {
  it('substitutes the index placeholder for account 0', () => {
    expect(resolveEvmPath(0)).toBe("m/44'/60'/0'/0/0");
  });

  it('substitutes the index placeholder for higher accounts', () => {
    expect(resolveEvmPath(5)).toBe("m/44'/60'/0'/0/5");
  });

  it('rejects negative indices', () => {
    expect(() => resolveEvmPath(-1)).toThrow(/Invalid EVM account index/);
  });

  it('rejects non-integer indices', () => {
    expect(() => resolveEvmPath(1.5)).toThrow(/Invalid EVM account index/);
  });

  it('exposes the template for callers that need it raw (HD)', () => {
    expect(EVM_PATH_TEMPLATE).toBe("m/44'/60'/0'/0/$$INDEX$$");
  });
});

describe('validateEvmNetworkId', () => {
  it('accepts a known EVM networkId (eth mainnet)', () => {
    expect(() => validateEvmNetworkId('evm--1')).not.toThrow();
  });

  it('rejects an unknown networkId', () => {
    expect(() => validateEvmNetworkId('evm--999999')).toThrow(
      /Unsupported EVM networkId/,
    );
  });

  it('rejects a non-EVM networkId', () => {
    expect(() => validateEvmNetworkId('btc--0')).toThrow(
      /Unsupported EVM networkId/,
    );
  });
});
