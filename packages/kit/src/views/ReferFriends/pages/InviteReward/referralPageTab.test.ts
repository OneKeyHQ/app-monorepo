import { EReferralPageTab, resolveReferralPageTab } from './referralPageTab';

describe('resolveReferralPageTab', () => {
  it('defaults to invite when the param is missing or unknown', () => {
    expect(resolveReferralPageTab()).toBe(EReferralPageTab.invite);
    expect(resolveReferralPageTab(undefined)).toBe(EReferralPageTab.invite);
    expect(resolveReferralPageTab(null)).toBe(EReferralPageTab.invite);
    expect(resolveReferralPageTab('')).toBe(EReferralPageTab.invite);
    expect(resolveReferralPageTab('rewards')).toBe(EReferralPageTab.invite);
  });

  it('keeps invite and benefits when the benefits tab is enabled', () => {
    expect(resolveReferralPageTab('invite', true)).toBe(
      EReferralPageTab.invite,
    );
    expect(resolveReferralPageTab('benefits', true)).toBe(
      EReferralPageTab.benefits,
    );
  });

  it('falls back to invite while the benefits tab is hidden', () => {
    expect(resolveReferralPageTab('benefits', false)).toBe(
      EReferralPageTab.invite,
    );
  });
});
