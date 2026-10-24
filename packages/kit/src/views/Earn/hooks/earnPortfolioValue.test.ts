import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import {
  applyEarnPortfolioFetchResult,
  mergeEarnPortfolioInvestments,
  removeEarnPortfolioInvestmentSource,
} from './earnPortfolioInvestmentMerge';
import {
  getEarnPortfolioValueDisplay,
  getKnownEarnPortfolioValue,
  passesEarnPortfolioSmallAssetsFilter,
  shouldKeepEarnPortfolioInvestment,
} from './earnPortfolioValue';

/** Include metadata so merge and filtering tests use the same shape as portfolio rows. */
const buildInvestment = (
  overrides: Partial<IEarnPortfolioInvestment> = {},
): IEarnPortfolioInvestment => {
  const protocol = {
    symbol: 'USD',
    vault: 'vault',
    providerDetail: { code: 'provider', name: 'Provider', logoURI: '' },
  };
  const network = { networkId: 'evm--1', name: 'Ethereum', logoURI: '' };
  return {
    totalFiatValue: '0',
    totalFiatValueUsd: '0',
    earnings24hFiatValue: '0',
    protocol,
    network,
    assets: [
      {
        token: { info: { symbol: 'USD', logoURI: '' } },
        deposit: { title: { text: '0 USD' }, description: { text: '' } },
        earnings24h: { title: { text: '--' } },
        rewardAssets: [],
        assetsStatus: [],
        buttons: [],
        metadata: {
          protocol,
          network,
          fiatValue: overrides.totalFiatValue ?? '0',
          fiatValueUsd: overrides.totalFiatValueUsd ?? '0',
        },
      },
    ],
    airdropAssets: [],
    ...overrides,
  };
};

describe('Earn portfolio valuations', () => {
  it.each(['0', '0.000000000000000000', '-1', 'NaN', '', 'Infinity'])(
    'hides holdings without a positive value (%s)',
    (value) => {
      expect(
        shouldKeepEarnPortfolioInvestment({
          totalFiatValue: value,
        }),
      ).toBe(false);
      expect(
        passesEarnPortfolioSmallAssetsFilter({
          fiatValueUsd: value,
        }),
      ).toBe(false);
    },
  );

  it.each(['0.000000000000000001', '0.001', '1'])(
    'keeps an unrounded positive holding (%s)',
    (value) => {
      expect(
        shouldKeepEarnPortfolioInvestment({
          totalFiatValue: value,
        }),
      ).toBe(true);
      expect(
        passesEarnPortfolioSmallAssetsFilter({
          fiatValueUsd: value,
        }),
      ).toBe(Number(value) >= 0.01);
    },
  );

  it('keeps a queued-only holding when the wallet deposit is zero', () => {
    const investment = buildInvestment({
      totalFiatValue: '1.25',
      totalFiatValueUsd: '1.25',
    });
    expect(investment.assets[0].deposit.title.text).toBe('0 USD');
    expect(shouldKeepEarnPortfolioInvestment(investment)).toBe(true);
    expect(
      passesEarnPortfolioSmallAssetsFilter(investment.assets[0].metadata),
    ).toBe(true);
  });

  it('applies the zero and USD 0.01 visibility thresholds', () => {
    expect(shouldKeepEarnPortfolioInvestment({ totalFiatValue: '0' })).toBe(
      false,
    );
    expect(shouldKeepEarnPortfolioInvestment({ totalFiatValue: 'NaN' })).toBe(
      false,
    );
    expect(
      passesEarnPortfolioSmallAssetsFilter({ fiatValueUsd: '0.009' }),
    ).toBe(false);
    expect(passesEarnPortfolioSmallAssetsFilter({ fiatValueUsd: '0.01' })).toBe(
      true,
    );
  });

  it.each([false, true])(
    'aggregates holdings regardless of source order (%s)',
    (reverse) => {
      const first = buildInvestment({
        totalFiatValue: '12',
      });
      const second = buildInvestment({ totalFiatValue: '30' });
      const merged = reverse
        ? mergeEarnPortfolioInvestments(second, first)
        : mergeEarnPortfolioInvestments(first, second);

      expect(merged.totalFiatValue).toBe('42');
      expect(merged.assets).toHaveLength(2);
    },
  );

  it('does not let an unavailable amount invalidate other holdings', () => {
    const merged = mergeEarnPortfolioInvestments(
      buildInvestment({ totalFiatValue: 'NaN' }),
      buildInvestment({ totalFiatValue: '30' }),
    );
    expect(merged.totalFiatValue).toBe('30');
    expect(getKnownEarnPortfolioValue('Infinity').toFixed()).toBe('0');
  });

  it('replaces the previous holding when refreshing the same position', () => {
    const requestMap = new Map([
      ['position', buildInvestment({ totalFiatValue: '12' })],
    ]);
    applyEarnPortfolioFetchResult({
      requestMap,
      result: {
        key: 'position',
        source: 'normal',
        investment: buildInvestment({
          totalFiatValue: '15',
        }),
      },
      normalKeysUpdatedInSession: new Set(),
      airdropKeysUpdatedInSession: new Set(),
    });
    expect(requestMap.get('position')?.totalFiatValue).toBe('15');
    expect(requestMap.get('position')?.assets).toHaveLength(1);
  });

  it('removes a holding after its normal source is removed', () => {
    const investment = buildInvestment();
    const requestMap = new Map([['position', investment]]);
    removeEarnPortfolioInvestmentSource({
      requestMap,
      key: 'position',
      source: 'normal',
    });
    expect(requestMap.has('position')).toBe(false);
  });

  it('removes an empty holding when cleaning an absent airdrop source', () => {
    const requestMap = new Map([['position', buildInvestment({ assets: [] })]]);
    removeEarnPortfolioInvestmentSource({
      requestMap,
      key: 'position',
      source: 'airdrop',
    });
    expect(requestMap.has('position')).toBe(false);
  });

  it('displays valid amounts and preserves unavailable values', () => {
    expect(getEarnPortfolioValueDisplay('0')).toBe('0');
    expect(getEarnPortfolioValueDisplay('12.5')).toBe('12.5');
    expect(getEarnPortfolioValueDisplay('NaN')).toBe('--');
    expect(getEarnPortfolioValueDisplay(undefined)).toBe('--');
  });
});
