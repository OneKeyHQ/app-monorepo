import BigNumber from 'bignumber.js';

import tokenRebaseUtils from './tokenRebaseUtils';

describe('tokenRebaseUtils', () => {
  describe('isValidBalanceMultiplier', () => {
    it('rejects nil, empty, NaN, zero and negative values', () => {
      expect(tokenRebaseUtils.isValidBalanceMultiplier(undefined)).toBe(false);
      expect(tokenRebaseUtils.isValidBalanceMultiplier('')).toBe(false);
      expect(tokenRebaseUtils.isValidBalanceMultiplier('--')).toBe(false);
      expect(tokenRebaseUtils.isValidBalanceMultiplier('0')).toBe(false);
      expect(tokenRebaseUtils.isValidBalanceMultiplier('-1.1')).toBe(false);
    });

    it('accepts positive finite values including 1', () => {
      expect(tokenRebaseUtils.isValidBalanceMultiplier('1')).toBe(true);
      expect(
        tokenRebaseUtils.isValidBalanceMultiplier('1.0026642075893797'),
      ).toBe(true);
    });
  });

  describe('applyBalanceMultiplier (raw -> display)', () => {
    it('passes through when multiplier is missing, invalid, or 1', () => {
      expect(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: '4',
          balanceMultiplier: undefined,
        }),
      ).toBe('4');
      expect(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: '4',
          balanceMultiplier: '--',
        }),
      ).toBe('4');
      expect(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: '4',
          balanceMultiplier: '1',
        }),
      ).toBe('4');
    });

    it('passes through undefined and non-numeric amounts', () => {
      expect(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: undefined,
          balanceMultiplier: '1.1',
        }),
      ).toBeUndefined();
      expect(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: '--',
          balanceMultiplier: '1.1',
        }),
      ).toBe('--');
    });

    it('multiplies with full BigNumber precision (Solscan parity case)', () => {
      // Real AAPLx sample from the design thread:
      // 0.04602179 * 1.0009180758490996 = 0.046064041493931333480284 (exact)
      expect(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: '0.04602179',
          balanceMultiplier: '1.0009180758490996',
        }),
      ).toBe('0.046064041493931333480284');
    });
  });

  describe('removeBalanceMultiplier (display -> raw)', () => {
    it('passes through when multiplier is missing, invalid, or 1', () => {
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '4.4',
          balanceMultiplier: undefined,
          decimals: 8,
        }),
      ).toBe('4.4');
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '4.4',
          balanceMultiplier: '1',
          decimals: 8,
        }),
      ).toBe('4.4');
    });

    it('divides and floors at token decimals', () => {
      // 4.4 / 1.1 = 4 exactly
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '4.4',
          balanceMultiplier: '1.1',
          decimals: 8,
        }),
      ).toBe('4.00000000');
      // 1 / 1.1 = 0.909090... floored at 8 dp
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '1',
          balanceMultiplier: '1.1',
          decimals: 8,
        }),
      ).toBe('0.90909090');
    });

    it('never exceeds the raw amount on a display->raw round trip', () => {
      const samples = [
        { raw: '0.04602179', m: '1.0009180758490996', decimals: 8 },
        { raw: '123456.789', m: '4.4', decimals: 8 },
        { raw: '0.00000001', m: '1.0026642075893797', decimals: 8 },
        { raw: '999999999.99999999', m: '2.2', decimals: 8 },
      ];
      for (const { raw, m, decimals } of samples) {
        const display = tokenRebaseUtils.applyBalanceMultiplier({
          amount: raw,
          balanceMultiplier: m,
        });
        const backToRaw = tokenRebaseUtils.removeBalanceMultiplier({
          amount: display,
          balanceMultiplier: m,
          decimals,
        });
        expect(new BigNumber(backToRaw).lte(raw)).toBe(true);
        // and stays within 1 base unit of the true raw amount
        expect(
          new BigNumber(raw)
            .minus(backToRaw)
            .lte(new BigNumber(10).pow(-decimals)),
        ).toBe(true);
      }
    });

    it('never rounds up across the floor boundary (div precision regression)', () => {
      const m = '1.0009180758490996';
      // display value whose true quotient is 0.123456779999999999999... — a
      // naive 20dp HALF_UP division would floor to 0.12345678
      const display = new BigNumber('0.12345678')
        .minus('1e-21')
        .times(m)
        .toFixed();
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: display,
          balanceMultiplier: m,
          decimals: 8,
        }),
      ).toBe('0.12345677');
    });

    it('handles multipliers below 1 in both directions', () => {
      expect(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: '10',
          balanceMultiplier: '0.5',
        }),
      ).toBe('5');
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '5',
          balanceMultiplier: '0.5',
          decimals: 8,
        }),
      ).toBe('10.00000000');
    });

    it('handles decimals=0 tokens', () => {
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '10',
          balanceMultiplier: '3',
          decimals: 0,
        }),
      ).toBe('3');
    });

    it('does not emit scientific notation for extreme values', () => {
      const applied = tokenRebaseUtils.applyBalanceMultiplier({
        amount: '0.000000001',
        balanceMultiplier: '1.1',
      });
      expect(applied).toBe('0.0000000011');
      expect(applied.includes('e')).toBe(false);
    });

    it('throws on invalid decimals when a division is required', () => {
      expect(() =>
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '1',
          balanceMultiplier: '1.1',
          decimals: undefined as unknown as number,
        }),
      ).toThrow();
      // passthrough paths must NOT touch decimals
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '1',
          balanceMultiplier: undefined,
          decimals: undefined as unknown as number,
        }),
      ).toBe('1');
    });
  });
});
