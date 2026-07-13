import {
  assertAddressForChain,
  assertTokenAddressForChain,
  sameAddress,
  validateAddressForChain,
} from '../core/address-utils';
import { resolveChain } from '../core/chain-resolver';

describe('address-utils', () => {
  const evm = resolveChain('eth');
  const btc = resolveChain('btc');
  const tbtc = resolveChain('tbtc');
  const sol = resolveChain('sol');

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

  describe('SOL', () => {
    // System Program ID — guaranteed on-curve, length 32, base58.
    const ON_CURVE_SOL = '11111111111111111111111111111111';
    // SPL Associated Token Program ID — a well-known *off-curve* program key
    // (32 bytes base58 but not a valid ed25519 point). Mirrors kit-bg's
    // validateAddress, which accepts any 32-byte key. Documents the lax
    // behavior so anyone who tightens the rule must update both sides.
    const OFF_CURVE_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

    it('accepts an on-curve SOL address', () => {
      const result = validateAddressForChain(sol, ON_CURVE_SOL);
      expect(result.isValid).toBe(true);
      expect(result.normalizedAddress).toBe(ON_CURVE_SOL);
    });

    it('accepts an off-curve 32-byte program key (App parity — PDAs hold SPL tokens)', () => {
      expect(validateAddressForChain(sol, OFF_CURVE_PROGRAM).isValid).toBe(
        true,
      );
    });

    it('rejects a clearly malformed (too short) address', () => {
      expect(validateAddressForChain(sol, 'too-short').isValid).toBe(false);
    });

    it('rejects an EVM address on SOL', () => {
      expect(
        validateAddressForChain(
          sol,
          '0x0000000000000000000000000000000000000001',
        ).isValid,
      ).toBe(false);
    });

    it('is case-sensitive (base58 has no case-fold)', () => {
      // Use an address with mixed-case letters so lowercase actually changes
      // the bytes — the all-1's System Program ID would be a no-op.
      const SOL_MIXED = '4Nd1mYgMnA73L1z9Mt9HBTppmKQGYP1qhwFQ7y5dQbpC';
      expect(sameAddress(sol, SOL_MIXED, SOL_MIXED.toLowerCase())).toBe(false);
    });
  });

  describe('assertTokenAddressForChain', () => {
    const USDC_EVM = '0xdac17f958d2ee523a2206206994597c13d831ec7';
    const USDC_SPL_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    it('accepts a valid ERC-20 contract address on EVM', () => {
      expect(assertTokenAddressForChain(evm, USDC_EVM)).toBe(USDC_EVM);
    });

    it('rejects a base58 SPL mint on EVM', () => {
      expect(() => assertTokenAddressForChain(evm, USDC_SPL_MINT)).toThrow(
        /Invalid ERC-20 contract address/,
      );
    });

    it('accepts a valid SPL mint on SOL', () => {
      expect(assertTokenAddressForChain(sol, USDC_SPL_MINT)).toBe(
        USDC_SPL_MINT,
      );
    });

    it('rejects an EVM-shaped token on SOL', () => {
      expect(() => assertTokenAddressForChain(sol, USDC_EVM)).toThrow(
        /Invalid SPL mint address/,
      );
    });

    it('rejects tokens on BTC entirely', () => {
      expect(() => assertTokenAddressForChain(btc, USDC_EVM)).toThrow(
        /Token transfers not supported/,
      );
    });
  });
});
