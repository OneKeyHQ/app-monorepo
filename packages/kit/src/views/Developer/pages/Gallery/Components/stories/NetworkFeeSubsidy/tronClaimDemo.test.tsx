/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  TRON_RESOURCE_LIFETIME,
  claimTronDemo,
  createTronClaimDemo,
  getTronClaimStatus,
  useTronClaimClock,
} from './tronClaimDemo';

describe('TRON subsidy demo', () => {
  const now = Date.parse('2026-10-14T10:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deducts quotas once and rejects repeat claims without mutating fixtures', () => {
    const initial = createTronClaimDemo();
    const claimed = claimTronDemo(initial, now);
    expect(claimed.remaining).toBe(127);
    expect(claimed.monthIPRemaining).toBe(5);
    expect(claimed.accounts[0].monthRemaining).toBe(7);
    expect(initial.remaining).toBe(128);
    expect(claimed.accounts[1]).toBe(initial.accounts[1]);
    expect(claimTronDemo(claimed, now + 1000)).toBe(claimed);
  });

  it.each([
    'missingAccount',
    'inactive',
    'watching',
    'monthlyLimit',
    'ipLimit',
    'exhausted',
    'failed',
    'claimed',
  ] as const)('does not deduct quotas for the %s scenario', (scenario) => {
    const initial = createTronClaimDemo(scenario);
    expect(claimTronDemo(initial, now)).toBe(initial);
  });

  it('rejects negative quotas as well as zero quotas', () => {
    const initial = { ...createTronClaimDemo(), remaining: -1 };
    expect(getTronClaimStatus(initial, now).canClaim).toBe(false);
    expect(claimTronDemo(initial, now)).toBe(initial);
  });

  it('expires resources after ten minutes but resets eligibility at GMT+8 midnight', () => {
    const claimed = claimTronDemo(createTronClaimDemo(), now);
    const expired = getTronClaimStatus(claimed, now + TRON_RESOURCE_LIFETIME);
    expect(expired.secondsLeft).toBe(0);
    expect(expired.canClaim).toBe(false);
    expect(
      getTronClaimStatus(claimed, Date.parse('2026-10-14T15:59:59Z')).canClaim,
    ).toBe(false);
    expect(
      getTronClaimStatus(claimed, Date.parse('2026-10-14T16:00:00Z')).canClaim,
    ).toBe(true);
  });

  it('only ticks for claimed accounts and cleans up when switching or unmounting', () => {
    const initial = createTronClaimDemo();
    const { result, rerender, unmount } = renderHook(
      ({ state }) => useTronClaimClock(state),
      { initialProps: { state: initial } },
    );
    expect(jest.getTimerCount()).toBe(0);
    const claimed = claimTronDemo(initial, now);
    rerender({ state: claimed });
    expect(jest.getTimerCount()).toBe(1);
    act(() => jest.advanceTimersByTime(1000));
    expect(getTronClaimStatus(claimed, result.current).secondsLeft).toBe(599);
    rerender({ state: { ...claimed, selectedAccountId: 'account-2' } });
    expect(jest.getTimerCount()).toBe(0);
    rerender({ state: claimed });
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('sleeps after expiry and refreshes at the daily reset', () => {
    const claimed = claimTronDemo(createTronClaimDemo(), now);
    jest.setSystemTime(now + TRON_RESOURCE_LIFETIME);
    let renders = 0;
    const { result, unmount } = renderHook(() => {
      renders += 1;
      return useTronClaimClock(claimed);
    });
    act(() => jest.advanceTimersByTime(60_000));
    expect(renders).toBe(1);
    act(() =>
      jest.advanceTimersByTime(Date.parse('2026-10-14T16:00:00Z') - Date.now()),
    );
    expect(getTronClaimStatus(claimed, result.current).canClaim).toBe(true);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
