import type { IBorrowApy } from '@onekeyhq/shared/types/staking';

import { buildLendingHeadlineApyParts } from './lendingHeadlineApy.utils';

const item = (text: string, title = 'Item') => ({
  title: { text: title },
  value: { apy: '', normal: { text } },
});

const withBreakdown = (
  apy: string,
  apyDetail: NonNullable<IBorrowApy['button']>['data']['apyDetail'],
): IBorrowApy => ({
  apy,
  button: { type: 'popup', data: { apyDetail } },
});

describe('buildLendingHeadlineApyParts', () => {
  it("splits Kamino's incentives off a supply rate that is all incentives", () => {
    expect(
      buildLendingHeadlineApyParts(
        withBreakdown('0.77264935154388298', {
          normal: { items: [item('+0.00%', 'Native Supply APY')] },
          supplyBonus: { items: [item('+0.77%', 'strongSOL Incentives')] },
        }),
      ),
    ).toEqual({
      base: '0.00%',
      bonus: '+0.77%',
      bonusColor: '$textInfo',
      unit: 'APY',
    });
  });

  it("colors the bonus orange when OneKey's own is in it", () => {
    expect(
      buildLendingHeadlineApyParts(
        withBreakdown('5.5', {
          normal: { items: [item('3.50%')] },
          platformBonus: { items: [item('+1.50%')] },
          supplyBonus: { items: [item('+0.50%')] },
        }),
      ),
    ).toEqual({
      base: '3.50%',
      bonus: '+2.00%',
      bonusColor: '$orange10',
      unit: 'APY',
    });
  });

  it("keeps one figure when the parts don't add up to the rate", () => {
    expect(
      buildLendingHeadlineApyParts(
        withBreakdown('3.5', {
          normal: { items: [item('3.50%')] },
          collateralBonus: { items: [item('+2.00%')] },
          supplyBonus: { items: [item('+2.00%')] },
        }),
      ),
    ).toBeUndefined();
  });

  it('keeps one figure without a breakdown', () => {
    expect(buildLendingHeadlineApyParts({ apy: '4.59' })).toBeUndefined();
  });

  it('shows the base alone when nothing is added', () => {
    expect(
      buildLendingHeadlineApyParts(
        withBreakdown('4.59', { normal: { items: [item('4.59%')] } }),
      ),
    ).toEqual({ base: '4.59%', unit: 'APY' });
  });
});
