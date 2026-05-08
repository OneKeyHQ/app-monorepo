import {
  assertAddressForChain,
  sameAddress,
  validateAddressForChain,
} from '../core/address-utils';
import { resolveChain } from '../core/chain-resolver';

describe('address-utils', () => {
  const evm = resolveChain('eth');
  const btc = resolveChain('btc');
  const tbtc = resolveChain('tbtc');

  it('validates EVM addresses case-insensitively', () => {
    expect(
      validateAddressForChain(evm, '0x0000000000000000000000000000000000000001')
        .isValid,
    ).toBe(true);
    expect(
      sameAddress(
        evm,
        '0x000000000000000000000000000000000000000A',
        '0x000000000000000000000000000000000000000a',
      ),
    ).toBe(true);
  });

  it('validates BTC mainnet addresses', () => {
    expect(
      validateAddressForChain(btc, 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')
        .isValid,
    ).toBe(true);
  });

  it('validates Bitcoin testnet addresses', () => {
    expect(
      validateAddressForChain(
        tbtc,
        'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      ).isValid,
    ).toBe(true);
  });

  it('rejects a mainnet BTC address on testnet', () => {
    expect(
      validateAddressForChain(
        tbtc,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      ).isValid,
    ).toBe(false);
  });

  it('throws AppError for invalid chain address', () => {
    expect(() =>
      assertAddressForChain(tbtc, '0x0000000000000000000000000000000000000001'),
    ).toThrow(/Invalid address/);
  });
});
