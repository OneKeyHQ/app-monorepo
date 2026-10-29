/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { useLevelOverview } from './useLevelOverview';

const NOW = Date.parse('2026-10-29T00:00:00.000Z');
const DETAIL: IInviteLevelDetail = {
  currentLevel: 1,
  levelPolicy: 'floor',
  floorUntil: new Date(NOW + 1000).toISOString(),
  levelProgress: {},
  levels: [0, 1, 2].map((level) => ({
    level,
    label: `Level ${level}`,
    labelKey: '',
    icon: '',
    emoji: '',
    isCurrent: level === 1,
    commissionRates: {},
    upgradeConditions: [
      {
        subject: 'HardwareSales',
        current: '0',
        currentFiatValue: '0',
        threshold: '100',
        thresholdFiatValue: '100',
        progress: '0',
      },
    ],
  })),
};

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

it('ends protection in place even if the response object never changes', () => {
  const { result } = renderHook(() => useLevelOverview(DETAIL));
  expect(result.current.levelPolicy).toBe('floor');
  expect(result.current.retentionStatus).toBe('none');

  act(() => jest.advanceTimersByTime(1000));

  expect(result.current.levelPolicy).toBe('normal');
  expect(result.current.floorUntil).toBeUndefined();
  expect(result.current.retentionStatus).toBe('notKept');
  expect(result.current.currentLevel).toBe(DETAIL.levels[1]);
  expect(result.current.upgradeTargets).toHaveLength(1);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(['normal', 'fixed'] as const)(
  'cancels the protection timer when changed to %s',
  (levelPolicy) => {
    const { result, rerender } = renderHook(
      (data: IInviteLevelDetail) => useLevelOverview(data),
      { initialProps: DETAIL },
    );
    expect(jest.getTimerCount()).toBe(1);
    rerender({ ...DETAIL, levelPolicy });
    expect(result.current.levelPolicy).toBe(levelPolicy);
    expect(result.current.floorUntil).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  },
);

it('reschedules when the protection end time is extended and cleans up on unmount', () => {
  const { result, rerender, unmount } = renderHook(
    (data: IInviteLevelDetail) => useLevelOverview(data),
    { initialProps: DETAIL },
  );
  rerender({ ...DETAIL, floorUntil: new Date(NOW + 120_000).toISOString() });
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current.levelPolicy).toBe('floor');
  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

it('does not start a timer before data arrives or for protection without an end time', () => {
  const { result, rerender } = renderHook(
    (data: IInviteLevelDetail | undefined) => useLevelOverview(data),
    { initialProps: undefined as IInviteLevelDetail | undefined },
  );
  expect(result.current.currentLevel).toBeUndefined();
  rerender({ ...DETAIL, floorUntil: null });
  expect(result.current.levelPolicy).toBe('floor');
  expect(jest.getTimerCount()).toBe(0);
});
