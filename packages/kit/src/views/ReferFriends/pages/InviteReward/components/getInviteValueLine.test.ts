import {
  getInviteValueSummary,
  selectInviteValueLineItems,
} from './getInviteValueLine';

import type { IInviteValueLineItem } from './getInviteValueLine';

const GOLD_RATES: IInviteValueLineItem[] = [
  { subject: 'Earn', you: 10, invitee: 10, enabled: true },
  { subject: 'Perp', you: 18, invitee: 10, enabled: true },
  { subject: 'Swap', you: 18, invitee: 0, enabled: true },
  { subject: 'HardwareSales', you: 18, invitee: 0, enabled: true },
];

function sentence(items: IInviteValueLineItem[]) {
  const summary = getInviteValueSummary(items);
  return summary ? `${summary.lead} ${summary.rate} ${summary.products}` : null;
}

describe('getInviteValueSummary', () => {
  it('names every paying product and leads with the top rate', () => {
    expect(sentence(GOLD_RATES)).toBe(
      'Earn up to 18% on hardware, Perps, Swap and DeFi',
    );
  });

  it('drops "up to" when every product pays the same', () => {
    expect(
      sentence([
        { subject: 'HardwareSales', you: 10, enabled: true },
        { subject: 'Perp', you: 10, enabled: true },
      ]),
    ).toBe('Earn 10% on hardware and Perps');
  });

  it('lists the split in canonical order with no friend reward as null', () => {
    expect(getInviteValueSummary(GOLD_RATES)?.rows).toEqual([
      {
        subject: 'HardwareSales',
        label: 'Hardware sales',
        you: '18%',
        friend: null,
      },
      { subject: 'Perp', label: 'Perps fees', you: '18%', friend: '10%' },
      { subject: 'Swap', label: 'Swap fees', you: '18%', friend: null },
      { subject: 'Earn', label: 'DeFi fees', you: '10%', friend: '10%' },
    ]);
  });

  it('drops disabled, zero and unknown subjects, and merges DeFi keys', () => {
    expect(
      sentence([
        { subject: 'Swap', you: 5, enabled: false },
        { subject: 'HardwareSales', you: 0, enabled: true },
        { subject: 'Unknown', you: 30, enabled: true },
        { subject: 'Earn', you: 10.5, enabled: true },
        { subject: 'Onchain', you: 12, enabled: true },
      ]),
    ).toBe('Earn 10.5% on DeFi');
  });

  it('returns null when nothing pays', () => {
    expect(getInviteValueSummary([])).toBeNull();
    expect(
      getInviteValueSummary([
        { subject: 'Perp', you: Number.NaN, enabled: true },
      ]),
    ).toBeNull();
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
      { subject: 'Perp', you: 18, invitee: undefined, enabled: true },
      { subject: 'HardwareSales', you: 18, invitee: undefined, enabled: false },
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
