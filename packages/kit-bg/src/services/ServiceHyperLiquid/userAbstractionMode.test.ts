import { shouldPreserveConfirmedUserAbstractionMode } from './userAbstractionMode';

describe('user abstraction mode refresh policy', () => {
  it('does not preserve a confirmed mode for regular refreshes', () => {
    expect(
      shouldPreserveConfirmedUserAbstractionMode({
        refreshedMode: 'unifiedAccount',
      }),
    ).toBe(false);
  });

  it('does not rewrite when the refetch already returned the confirmed mode', () => {
    expect(
      shouldPreserveConfirmedUserAbstractionMode({
        confirmedMode: 'portfolioMargin',
        refreshedMode: 'portfolioMargin',
      }),
    ).toBe(false);
  });

  it('preserves the confirmed mode when a refetch returns a stale mode', () => {
    expect(
      shouldPreserveConfirmedUserAbstractionMode({
        confirmedMode: 'portfolioMargin',
        refreshedMode: 'unifiedAccount',
      }),
    ).toBe(true);
  });

  it('preserves the confirmed mode when a refetch only hits the cache fallback', () => {
    expect(
      shouldPreserveConfirmedUserAbstractionMode({
        confirmedMode: 'portfolioMargin',
        refreshedMode: undefined,
      }),
    ).toBe(true);
  });
});
