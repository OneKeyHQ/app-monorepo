import {
  getInviteValueLine,
  selectInviteValueLineItems,
} from './getInviteValueLine';

import type { IInviteValueLineItem } from './getInviteValueLine';

const GOLD_RATES: IInviteValueLineItem[] = [
  { subject: 'Earn', you: 10, enabled: true },
  { subject: 'Perp', you: 18, enabled: true },
  { subject: 'HardwareSales', you: 18, enabled: true },
];

describe('getInviteValueLine', () => {
  it('shows the first two enabled inviter rates for the current level', () => {
    expect(getInviteValueLine(GOLD_RATES)).toBe(
      '18% on hardware sales · 18% on Perps fees',
    );
  });

  it('hides the line when there are no enabled rates', () => {
    expect(getInviteValueLine([])).toBeNull();
    expect(
      getInviteValueLine([
        { subject: 'HardwareSales', you: 18, enabled: false },
      ]),
    ).toBeNull();
    expect(
      getInviteValueLine([{ subject: 'Perp', you: Number.NaN, enabled: true }]),
    ).toBeNull();
  });

  it('drops disabled and zero-rate subjects', () => {
    expect(
      getInviteValueLine([
        { subject: 'Swap', you: 5, enabled: false },
        { subject: 'Perp', you: 18, enabled: true },
        { subject: 'HardwareSales', you: 0, enabled: true },
      ]),
    ).toBe('18% on Perps fees');
  });

  it('keeps a single rate readable', () => {
    expect(
      getInviteValueLine([{ subject: 'Earn', you: 10.5, enabled: true }]),
    ).toBe('10.5% on DeFi fees');
  });
});

describe('selectInviteValueLineItems', () => {
  it('keeps hook rates when subjects are already the config keys', () => {
    expect(
      selectInviteValueLineItems({
        commissionRates: GOLD_RATES,
        configs: {
          HardwareSales: { rebate: 1, enabled: true },
        },
      }),
    ).toEqual(GOLD_RATES);
  });

  it('falls back to rebateConfig when hook subjects are not known keys', () => {
    expect(
      selectInviteValueLineItems({
        commissionRates: [{ subject: 'referral.hw', you: 1, enabled: true }],
        configs: {
          Perp: { rebate: 18, enabled: true },
          HardwareSales: { rebate: 18, enabled: false },
        },
      }),
    ).toEqual([
      { subject: 'Perp', you: 18, enabled: true },
      { subject: 'HardwareSales', you: 18, enabled: false },
    ]);
  });

  it('returns an empty list when both sources are empty', () => {
    expect(
      selectInviteValueLineItems({
        commissionRates: [],
        configs: undefined,
      }),
    ).toEqual([]);
    expect(
      selectInviteValueLineItems({
        commissionRates: [],
        configs: {},
      }),
    ).toEqual([]);
  });
});
