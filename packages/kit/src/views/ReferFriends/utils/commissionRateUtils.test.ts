import {
  DEFAULT_INVITEE_DISCOUNT_TEXT,
  formatCommissionRateText,
  formatInviteeDiscountFromConfig,
  formatInviteeDiscountText,
  isInviteeDiscountDeclined,
  shouldShowInviteeDiscount,
  sortCommissionRateItems,
} from './commissionRateUtils';

describe('commissionRateUtils', () => {
  it('hides zero invitee discounts', () => {
    expect(shouldShowInviteeDiscount(0)).toBe(false);
    expect(shouldShowInviteeDiscount(undefined)).toBe(false);
    expect(formatInviteeDiscountText(0)).toBe('-');
    expect(formatCommissionRateText({ rebate: 12, discount: 0 })).toBe(
      '12% / -',
    );
  });

  it('keeps positive invitee discounts', () => {
    expect(shouldShowInviteeDiscount(10)).toBe(true);
    expect(formatInviteeDiscountText(10)).toBe('10%');
    expect(formatCommissionRateText({ rebate: 12, discount: 10 })).toBe(
      '12% / 10%',
    );
  });

  it('sorts rebate modules as hardware, perps, swap, then defi', () => {
    expect(
      sortCommissionRateItems([
        { subject: 'Swap' },
        { subject: 'Earn' },
        { subject: 'HardwareSales' },
        { subject: 'Perp' },
      ]).map((item) => item.subject),
    ).toEqual(['HardwareSales', 'Perp', 'Swap', 'Earn']);
  });

  it('orders defi subjects independently of the API response order', () => {
    const expected = ['HardwareSales', 'Perp', 'Swap', 'Earn', 'Onchain'];

    expect(
      sortCommissionRateItems([
        { subject: 'Earn' },
        { subject: 'Onchain' },
        { subject: 'Perp' },
        { subject: 'HardwareSales' },
        { subject: 'Swap' },
      ]).map((item) => item.subject),
    ).toEqual(expected);

    expect(
      sortCommissionRateItems([
        { subject: 'Onchain' },
        { subject: 'Earn' },
        { subject: 'Swap' },
        { subject: 'HardwareSales' },
        { subject: 'Perp' },
      ]).map((item) => item.subject),
    ).toEqual(expected);
  });

  it('keeps unknown subjects after the known rebate modules', () => {
    expect(
      sortCommissionRateItems([
        { subject: 'referral_level_label_key' },
        { subject: 'Swap' },
        { subject: 'HardwareSales' },
      ]).map((item) => item.subject),
    ).toEqual(['HardwareSales', 'Swap', 'referral_level_label_key']);
  });
});

describe('formatInviteeDiscountFromConfig', () => {
  it('renders the rate the server gave, zero included', () => {
    expect(formatInviteeDiscountFromConfig({ amount: 15, unit: '%' })).toBe(
      '15%',
    );
    expect(formatInviteeDiscountFromConfig({ amount: 0, unit: '%' })).toBe(
      '0%',
    );
  });

  it('falls back only when there is no usable value', () => {
    expect(formatInviteeDiscountFromConfig(undefined)).toBe(
      DEFAULT_INVITEE_DISCOUNT_TEXT,
    );
    for (const amount of [-5, Number.NaN, null]) {
      expect(formatInviteeDiscountFromConfig({ amount, unit: '%' })).toBe(
        DEFAULT_INVITEE_DISCOUNT_TEXT,
      );
    }
    expect(formatInviteeDiscountFromConfig({ amount: 15 })).toBe(
      DEFAULT_INVITEE_DISCOUNT_TEXT,
    );
    expect(formatInviteeDiscountFromConfig({ amount: 15, unit: '' })).toBe(
      DEFAULT_INVITEE_DISCOUNT_TEXT,
    );
  });
});

describe('isInviteeDiscountDeclined', () => {
  it('is true only for an explicit zero amount', () => {
    expect(isInviteeDiscountDeclined({ amount: 0 })).toBe(true);
    expect(isInviteeDiscountDeclined({ amount: 10 })).toBe(false);
    expect(isInviteeDiscountDeclined({})).toBe(false);
    expect(isInviteeDiscountDeclined(undefined)).toBe(false);
  });
});
