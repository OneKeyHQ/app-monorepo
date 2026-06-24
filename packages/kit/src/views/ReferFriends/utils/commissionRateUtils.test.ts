import {
  formatCommissionRateText,
  formatInviteeDiscountText,
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

  it('keeps hardware sales first when sorting commission rates', () => {
    expect(
      sortCommissionRateItems([
        { subject: 'Earn' },
        { subject: 'HardwareSales' },
        { subject: 'Perp' },
      ]).map((item) => item.subject),
    ).toEqual(['HardwareSales', 'Perp', 'Earn']);
  });
});
