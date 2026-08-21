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

  describe('isScalingBalanceMultiplier', () => {
    it('rejects everything isValidBalanceMultiplier rejects', () => {
      expect(tokenRebaseUtils.isScalingBalanceMultiplier(undefined)).toBe(
        false,
      );
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('')).toBe(false);
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('--')).toBe(false);
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('0')).toBe(false);
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('-1.1')).toBe(false);
    });

    it('rejects the no-op multiplier 1 in any spelling', () => {
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('1')).toBe(false);
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('1.0')).toBe(false);
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('1.000')).toBe(false);
    });

    it('accepts multipliers that actually rescale', () => {
      expect(
        tokenRebaseUtils.isScalingBalanceMultiplier('1.0026642075893797'),
      ).toBe(true);
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('4.4')).toBe(true);
      expect(tokenRebaseUtils.isScalingBalanceMultiplier('0.5')).toBe(true);
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

    it('passes the Infinite sentinel through unchanged even with a scaling multiplier', () => {
      // The EVM approve decoder represents MaxUint256 as the literal string
      // 'Infinite' (InfiniteAmountText); it must never be multiplied.
      expect(
        tokenRebaseUtils.applyBalanceMultiplier({
          amount: 'Infinite',
          balanceMultiplier: '2',
        }),
      ).toBe('Infinite');
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
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '4.4',
          balanceMultiplier: '--',
          decimals: 8,
        }),
      ).toBe('4.4');
      // Native-coin call shape (e.g. TON updateUnsignedTx max-send guard,
      // which always passes balanceMultiplier: undefined for native
      // transfers and decimals: 0 as a native-coin fallback): must be a
      // pure passthrough, never divided.
      expect(
        tokenRebaseUtils.removeBalanceMultiplier({
          amount: '5',
          balanceMultiplier: undefined,
          decimals: 0,
        }),
      ).toBe('5');
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

  describe('convertDisplayAmountToRawAmount (display -> transfer payload)', () => {
    it('passes through when the multiplier is missing or invalid', () => {
      expect(
        tokenRebaseUtils.convertDisplayAmountToRawAmount({
          displayAmount: '1.5',
          balanceParsed: '4',
          balanceMultiplier: undefined,
          decimals: 8,
        }),
      ).toEqual({ rawAmount: '1.5', isFullSend: false });
      expect(
        tokenRebaseUtils.convertDisplayAmountToRawAmount({
          displayAmount: '1.5',
          balanceParsed: '4',
          balanceMultiplier: '--',
          decimals: 8,
        }),
      ).toEqual({ rawAmount: '1.5', isFullSend: false });
    });

    it('detects a MAX (untruncated display balance) input as a full send', () => {
      // balance 4 x 1.1 = display 4.4
      expect(
        tokenRebaseUtils.convertDisplayAmountToRawAmount({
          displayAmount: '4.4',
          balanceParsed: '4',
          balanceMultiplier: '1.1',
          decimals: 8,
        }),
      ).toEqual({ rawAmount: '4', isFullSend: true });
    });

    it('detects an input truncated to token decimals as a full send', () => {
      // 0.04602179 x 1.0009180758490996 = 0.046064041493931333480284;
      // the keyboard percent-100 shortcut truncates it to 8 dp first
      expect(
        tokenRebaseUtils.convertDisplayAmountToRawAmount({
          displayAmount: '0.04606404',
          balanceParsed: '0.04602179',
          balanceMultiplier: '1.0009180758490996',
          decimals: 8,
        }),
      ).toEqual({ rawAmount: '0.04602179', isFullSend: true });
    });

    it('divides partial amounts (floored at token decimals)', () => {
      expect(
        tokenRebaseUtils.convertDisplayAmountToRawAmount({
          displayAmount: '2.2',
          balanceParsed: '4',
          balanceMultiplier: '1.1',
          decimals: 8,
        }),
      ).toEqual({ rawAmount: '2.00000000', isFullSend: false });
    });

    describe('display balance below one input-precision unit (threshold truncates to 0)', () => {
      // decimals=8, multiplier=0.5, raw balance 0.00000001: display balance
      // 0.000000005 truncates to 0 at 8 dp, so an unguarded gte(0) would
      // treat every non-negative input as a full send.
      const dust = {
        balanceParsed: '0.00000001',
        balanceMultiplier: '0.5',
        decimals: 8,
      };

      it('zero-valued input strings never become a full send', () => {
        for (const zero of ['0', '0.0', '0.00']) {
          const res = tokenRebaseUtils.convertDisplayAmountToRawAmount({
            displayAmount: zero,
            ...dust,
          });
          expect(res.isFullSend).toBe(false);
          expect(new BigNumber(res.rawAmount).isZero()).toBe(true);
        }
      });

      it('MAX (the untruncated display balance) still full-sends', () => {
        expect(
          tokenRebaseUtils.convertDisplayAmountToRawAmount({
            displayAmount: '0.000000005',
            ...dust,
          }),
        ).toEqual({ rawAmount: '0.00000001', isFullSend: true });
      });

      it('partial amounts divide instead of full-sending a non-dust balance', () => {
        // decimals=2, multiplier=0.001, balance 5: display balance 0.005
        // truncates to 0 at 2 dp, yet 5 whole tokens are at stake — a zero
        // threshold would send all 5 for a 0.001 input.
        expect(
          tokenRebaseUtils.convertDisplayAmountToRawAmount({
            displayAmount: '0.001',
            balanceParsed: '5',
            balanceMultiplier: '0.001',
            decimals: 2,
          }),
        ).toEqual({ rawAmount: '1.00', isFullSend: false });
        expect(
          tokenRebaseUtils.convertDisplayAmountToRawAmount({
            displayAmount: '0.005',
            balanceParsed: '5',
            balanceMultiplier: '0.001',
            decimals: 2,
          }),
        ).toEqual({ rawAmount: '5', isFullSend: true });
      });
    });

    it('zero input on a zero balance is not a full send', () => {
      expect(
        tokenRebaseUtils.convertDisplayAmountToRawAmount({
          displayAmount: '0',
          balanceParsed: '0',
          balanceMultiplier: '1.1',
          decimals: 8,
        }),
      ).toEqual({ rawAmount: '0.00000000', isFullSend: false });
    });

    it('fails closed (throws) on invalid decimals for partial amounts', () => {
      expect(() =>
        tokenRebaseUtils.convertDisplayAmountToRawAmount({
          displayAmount: '1',
          balanceParsed: '4',
          balanceMultiplier: '1.1',
          decimals: undefined as unknown as number,
        }),
      ).toThrow();
    });
  });

  describe('pickBalanceMultiplier', () => {
    it('skips an invalid item-level value and falls back to a valid info-level value', () => {
      expect(
        tokenRebaseUtils.pickBalanceMultiplier({
          balanceMultiplier: '--',
          info: { balanceMultiplier: '1.5' },
        }),
      ).toBe('1.5');
    });

    it('returns undefined when the detail itself is undefined', () => {
      expect(tokenRebaseUtils.pickBalanceMultiplier(undefined)).toBeUndefined();
    });
  });

  describe('normalizers', () => {
    const M = '1.0026642075893797';

    it('normalizeTokenDetailItemsBalanceMultiplier syncs item-level and info-level', () => {
      const itemLevel = {
        info: { decimals: 8, address: 'x', symbol: 'AAPLx' },
        balance: '4',
        balanceParsed: '4',
        fiatValue: '0',
        price: 0,
        balanceMultiplier: M,
      } as any;
      const infoLevel = {
        info: {
          decimals: 8,
          address: 'y',
          symbol: 'TSLAx',
          balanceMultiplier: M,
        },
        balance: '1',
        balanceParsed: '1',
        fiatValue: '0',
        price: 0,
      } as any;
      const plain = {
        info: { decimals: 6, address: 'z', symbol: 'USDC' },
        balance: '1',
        balanceParsed: '1',
        fiatValue: '1',
        price: 1,
      } as any;

      tokenRebaseUtils.normalizeTokenDetailItemsBalanceMultiplier([
        itemLevel,
        infoLevel,
        plain,
      ]);

      expect(itemLevel.info.balanceMultiplier).toBe(M);
      expect(infoLevel.balanceMultiplier).toBe(M);
      expect(plain.balanceMultiplier).toBeUndefined();
      expect(plain.info.balanceMultiplier).toBeUndefined();
    });

    it('an invalid value on the winning (item) level does not shadow a valid info-level value', () => {
      const item = {
        info: {
          decimals: 8,
          address: 'w',
          symbol: 'NVDAx',
          balanceMultiplier: '1.5',
        },
        balance: '1',
        balanceParsed: '1',
        fiatValue: '0',
        price: 0,
        balanceMultiplier: '--',
      } as any;

      tokenRebaseUtils.normalizeTokenDetailItemsBalanceMultiplier([item]);

      expect(item.balanceMultiplier).toBe('1.5');
      expect(item.info.balanceMultiplier).toBe('1.5');
    });

    it('normalizeAccountTokensRespBalanceMultiplier syncs data[] and map', () => {
      const $key = 'sol--101_Xsb';
      const riskKey = 'sol--101_Risk';
      const resp = {
        tokens: {
          data: [{ $key, address: 'Xsb', decimals: 8, balanceMultiplier: M }],
          keys: '',
          map: {
            [$key]: {
              balance: '4',
              balanceParsed: '4',
              fiatValue: '0',
              price: 0,
            },
          },
        },
        riskTokens: {
          data: [
            {
              $key: riskKey,
              address: 'Risk',
              decimals: 8,
              balanceMultiplier: M,
            },
          ],
          keys: '',
          map: {
            [riskKey]: {
              balance: '2',
              balanceParsed: '2',
              fiatValue: '0',
              price: 0,
            },
          },
        },
        smallBalanceTokens: { data: [], keys: '', map: {} },
      } as any;

      tokenRebaseUtils.normalizeAccountTokensRespBalanceMultiplier(resp);

      expect(resp.tokens.map[$key].balanceMultiplier).toBe(M);
      expect(resp.riskTokens.map[riskKey].balanceMultiplier).toBe(M);
    });

    it('map-level multiplier wins over data-level and mirrors both ways', () => {
      const $key = 'sol--101_Y';
      const resp = {
        tokens: {
          data: [{ $key, address: 'Y', decimals: 8, balanceMultiplier: '2' }],
          keys: '',
          map: {
            [$key]: {
              balance: '4',
              balanceParsed: '4',
              fiatValue: '0',
              price: 0,
              balanceMultiplier: '3',
            },
          },
        },
        riskTokens: { data: [], keys: '', map: {} },
        smallBalanceTokens: { data: [], keys: '', map: {} },
      } as any;

      tokenRebaseUtils.normalizeAccountTokensRespBalanceMultiplier(resp);

      expect(resp.tokens.data[0].balanceMultiplier).toBe('3');
      expect(resp.tokens.map[$key].balanceMultiplier).toBe('3');
    });
  });

  describe('pickDecodeBalanceMultiplier', () => {
    const fetchedToken = { balanceMultiplier: '3' };

    it('prefers the snapshot multiplier on exact address match', () => {
      expect(
        tokenRebaseUtils.pickDecodeBalanceMultiplier({
          snapshotToken: { address: '0xAbC', balanceMultiplier: '2' },
          fetchedToken,
          tokenAddress: '0xAbC',
        }),
      ).toBe('2');
    });

    it('snapshot wins wholesale even when its multiplier is undefined', () => {
      // Same-snapshot contract: use what the send page displayed against,
      // even if that snapshot carried no multiplier.
      expect(
        tokenRebaseUtils.pickDecodeBalanceMultiplier({
          snapshotToken: { address: '0xAbC' },
          fetchedToken,
          tokenAddress: '0xAbC',
        }),
      ).toBeUndefined();
    });

    it('matches case-insensitively when addressCaseInsensitive is set (EVM)', () => {
      expect(
        tokenRebaseUtils.pickDecodeBalanceMultiplier({
          snapshotToken: { address: '0xABC', balanceMultiplier: '2' },
          fetchedToken,
          tokenAddress: '0xabc',
          addressCaseInsensitive: true,
        }),
      ).toBe('2');
    });

    it('does NOT match across case by default (base58 chains)', () => {
      expect(
        tokenRebaseUtils.pickDecodeBalanceMultiplier({
          snapshotToken: { address: 'AbC', balanceMultiplier: '2' },
          fetchedToken,
          tokenAddress: 'abc',
        }),
      ).toBe('3');
    });

    it('falls back to the fetched token on address mismatch', () => {
      expect(
        tokenRebaseUtils.pickDecodeBalanceMultiplier({
          snapshotToken: { address: '0xOther', balanceMultiplier: '2' },
          fetchedToken,
          tokenAddress: '0xAbC',
          addressCaseInsensitive: true,
        }),
      ).toBe('3');
    });

    it('falls back to the fetched token when no snapshot exists (dApp txs)', () => {
      expect(
        tokenRebaseUtils.pickDecodeBalanceMultiplier({
          snapshotToken: undefined,
          fetchedToken,
          tokenAddress: '0xAbC',
        }),
      ).toBe('3');
    });

    it('returns undefined when neither source has a multiplier', () => {
      expect(
        tokenRebaseUtils.pickDecodeBalanceMultiplier({
          snapshotToken: undefined,
          fetchedToken: undefined,
          tokenAddress: '0xAbC',
        }),
      ).toBeUndefined();
    });

    it('never matches on empty-string addresses (EVM native sentinel)', () => {
      expect(
        tokenRebaseUtils.pickDecodeBalanceMultiplier({
          snapshotToken: { address: '', balanceMultiplier: '2' },
          fetchedToken,
          tokenAddress: '',
        }),
      ).toBe('3');
    });
  });
});
