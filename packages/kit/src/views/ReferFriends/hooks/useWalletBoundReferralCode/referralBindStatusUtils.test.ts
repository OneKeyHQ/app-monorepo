import {
  canBindReferralCode,
  getReferralBindDisplayStatus,
  isReferralBindNotApplicable,
} from './referralBindStatusUtils';

describe('referralBindStatusUtils', () => {
  it('keeps bound as the highest priority', () => {
    const status = {
      isBound: true,
      bindable: false,
      bindWindowReason: 'exceeded_bind_window',
    };

    expect(canBindReferralCode(status)).toBe(false);
    expect(isReferralBindNotApplicable(status)).toBe(false);
    expect(getReferralBindDisplayStatus(status)).toBe('bound');
  });

  it('shows expired only for unbound wallets outside the bind window', () => {
    const status = {
      isBound: false,
      bindable: false,
      bindWindowReason: 'exceeded_bind_window',
    };

    expect(canBindReferralCode(status)).toBe(false);
    expect(isReferralBindNotApplicable(status)).toBe(true);
    expect(getReferralBindDisplayStatus(status)).toBe('notApplicable');
  });

  it('treats unbound non-expired wallets as bindable after server confirmation', () => {
    const status = {
      isBound: false,
      bindable: true,
    };

    expect(canBindReferralCode(status)).toBe(true);
    expect(isReferralBindNotApplicable(status)).toBe(false);
    expect(getReferralBindDisplayStatus(status)).toBe('bind');
  });

  it('keeps missing status unknown', () => {
    expect(getReferralBindDisplayStatus(undefined)).toBe('unknown');
    expect(
      getReferralBindDisplayStatus({
        isBound: false,
        bindable: undefined,
      }),
    ).toBe('unknown');
  });

  it('does not treat generic unbound status as expired', () => {
    expect(
      getReferralBindDisplayStatus({
        isBound: false,
        bindable: true,
        bindWindowReason: 'other_reason',
      }),
    ).toBe('bind');
  });
});
