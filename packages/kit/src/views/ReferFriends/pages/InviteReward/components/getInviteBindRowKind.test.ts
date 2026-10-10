import { getInviteBindRowKind } from './getInviteBindRowKind';

describe('getInviteBindRowKind', () => {
  it('returns unknown while wallets are still loading', () => {
    expect(getInviteBindRowKind(undefined)).toBe('unknown');
  });

  it('returns empty when there are no bindable wallets', () => {
    expect(getInviteBindRowKind([])).toBe('empty');
  });

  it('prefers bind when any wallet can still accept a code', () => {
    expect(
      getInviteBindRowKind([
        { status: 'bound' },
        { status: 'bindable' },
        { status: 'unknown' },
      ]),
    ).toBe('bind');
  });

  it('returns bound when every remaining wallet is already bound', () => {
    expect(
      getInviteBindRowKind([{ status: 'bound' }, { status: 'expired' }]),
    ).toBe('bound');
  });

  it('returns unknown when status cannot be decided', () => {
    expect(
      getInviteBindRowKind([{ status: 'unknown' }, { status: 'expired' }]),
    ).toBe('unknown');
  });
});
