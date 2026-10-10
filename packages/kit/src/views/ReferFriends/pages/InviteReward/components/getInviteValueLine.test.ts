import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getInviteValueSummary,
  getRateLineMessageId,
  selectInviteValueLineItems,
} from './getInviteValueLine';

import type { IInviteValueLineItem } from './getInviteValueLine';

const GOLD_RATES: IInviteValueLineItem[] = [
  { subject: 'Earn', you: 10, invitee: 10, enabled: true },
  { subject: 'Perp', you: 18, invitee: 10, enabled: true },
  { subject: 'Swap', you: 18, invitee: 0, enabled: true },
  { subject: 'HardwareSales', you: 18, invitee: 0, enabled: true },
];

// The figures the rate line reads: "up to" the top rate when products
// differ, the invitee's best rate, and which products pay.
function figures(items: IInviteValueLineItem[]) {
  const summary = getInviteValueSummary(items);
  return summary
    ? {
        rate: `${summary.isUniform ? '' : 'up to '}${summary.rate}`,
        friendRate: summary.friendRate,
        products: summary.rows.map((row) => row.labelId),
      }
    : null;
}

describe('getInviteValueSummary', () => {
  it('leads with the top rate across every paying product', () => {
    expect(figures(GOLD_RATES)).toEqual({
      rate: 'up to 18%',
      friendRate: '10%',
      products: [
        ETranslations.referral_referred_type_3,
        ETranslations.referral_rate_perps__title,
        ETranslations.referral_rate_swap__title,
        ETranslations.referral_rate_defi__title,
      ],
    });
  });

  it('drops "up to" when every product pays the same', () => {
    expect(
      figures([
        { subject: 'HardwareSales', you: 10, enabled: true },
        { subject: 'Perp', you: 10, enabled: true },
      ]),
    ).toEqual({
      rate: '10%',
      friendRate: null,
      products: [
        ETranslations.referral_referred_type_3,
        ETranslations.referral_rate_perps__title,
      ],
    });
  });

  it('lists the split in canonical order with no friend reward as null', () => {
    expect(getInviteValueSummary(GOLD_RATES)?.rows).toEqual([
      {
        subject: 'HardwareSales',
        labelId: ETranslations.referral_referred_type_3,
        you: '18%',
        friend: null,
      },
      {
        subject: 'Perp',
        labelId: ETranslations.referral_rate_perps__title,
        you: '18%',
        friend: '10%',
      },
      {
        subject: 'Swap',
        labelId: ETranslations.referral_rate_swap__title,
        you: '18%',
        friend: null,
      },
      {
        subject: 'Earn',
        labelId: ETranslations.referral_rate_defi__title,
        you: '10%',
        friend: '10%',
      },
    ]);
  });

  it('drops disabled, zero and unknown subjects, and merges DeFi keys at the higher rate', () => {
    expect(
      figures([
        { subject: 'Swap', you: 5, enabled: false },
        { subject: 'HardwareSales', you: 0, enabled: true },
        { subject: 'Unknown', you: 30, enabled: true },
        { subject: 'Earn', you: 10.5, enabled: true },
        { subject: 'Onchain', you: 12, enabled: true },
      ]),
    ).toEqual({
      rate: '12%',
      friendRate: null,
      products: [ETranslations.referral_rate_defi__title],
    });
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

  it('turns off hook rates for products the config disables', () => {
    expect(
      selectInviteValueLineItems({
        commissionRates: GOLD_RATES,
        configs: {
          Perp: { rebate: 18, enabled: false },
          Swap: { rebate: 18, enabled: true },
        },
      }),
    ).toEqual(
      GOLD_RATES.map((item) =>
        item.subject === 'Perp' ? { ...item, enabled: false } : item,
      ),
    );
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

describe('getRateLineMessageId', () => {
  // Real Bronze rates: invitees get nothing on hardware, 10% elsewhere.
  const BRONZE: IInviteValueLineItem[] = [
    { subject: 'HardwareSales', you: 10, invitee: 0, enabled: true },
    { subject: 'Perp', you: 10, invitee: 10, enabled: true },
    { subject: 'Swap', you: 10, invitee: 10, enabled: true },
    { subject: 'Onchain', you: 10, invitee: 10, enabled: true },
  ];
  const lineFor = (items: IInviteValueLineItem[]) => {
    const summary = getInviteValueSummary(items);
    return summary ? getRateLineMessageId(summary) : null;
  };

  it.each([
    [
      'same rates on both sides',
      BRONZE.map((item) => ({ ...item, invitee: 10 })),
      ETranslations.referral_rate_line__desc,
    ],
    [
      'same referrer rate, invitee discounts differ',
      BRONZE,
      ETranslations.referral_rate_line_invitee_up_to__desc,
    ],
    [
      'referrer rates differ, same invitee discount',
      BRONZE.map((item, index) => ({
        ...item,
        you: index === 3 ? 10 : 15,
        invitee: 10,
      })),
      ETranslations.referral_rate_line_you_up_to__desc,
    ],
    [
      'both sides differ',
      BRONZE.map((item, index) => ({ ...item, you: index === 3 ? 10 : 15 })),
      ETranslations.referral_rate_line_up_to__desc,
    ],
    [
      'same referrer rate, no invitee discount',
      BRONZE.map((item) => ({ ...item, invitee: 0 })),
      ETranslations.referral_you_earn__desc,
    ],
    [
      'referrer rates differ, no invitee discount',
      BRONZE.map((item, index) => ({
        ...item,
        you: index === 3 ? 10 : 15,
        invitee: 0,
      })),
      ETranslations.referral_you_earn_up_to__desc,
    ],
  ])('%s', (_case, items, expected) => {
    expect(lineFor(items)).toBe(expected);
  });

  it('ignores products that are off when comparing invitee discounts', () => {
    expect(
      lineFor([
        { subject: 'HardwareSales', you: 10, invitee: 0, enabled: false },
        { subject: 'Perp', you: 10, invitee: 10, enabled: true },
        { subject: 'Swap', you: 10, invitee: 10, enabled: true },
      ]),
    ).toBe(ETranslations.referral_rate_line__desc);
  });
});
