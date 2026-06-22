import { shouldCheckPerpsAccountStatusOnFocus } from './PerpsGlobalEffects.utils';

describe('shouldCheckPerpsAccountStatusOnFocus', () => {
  const staleMs = 60 * 60 * 1000;
  const nowMs = 2 * staleMs;

  it('skips before the first account selection has produced status params', () => {
    expect(
      shouldCheckPerpsAccountStatusOnFocus({
        isFocused: true,
        hasSelectedAccountParams: false,
        isSelectingAccount: false,
        lastCheckTimeMs: 0,
        nowMs,
        staleMs,
      }),
    ).toBe(false);
  });

  it('skips while account selection is already going to check status', () => {
    expect(
      shouldCheckPerpsAccountStatusOnFocus({
        isFocused: true,
        hasSelectedAccountParams: true,
        isSelectingAccount: true,
        lastCheckTimeMs: 0,
        nowMs,
        staleMs,
      }),
    ).toBe(false);
  });

  it('runs when focused and the previous status check is stale', () => {
    expect(
      shouldCheckPerpsAccountStatusOnFocus({
        isFocused: true,
        hasSelectedAccountParams: true,
        isSelectingAccount: false,
        lastCheckTimeMs: 0,
        nowMs,
        staleMs,
      }),
    ).toBe(true);
  });
});
