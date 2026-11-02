/**
 * @jest-environment jsdom
 */
import { useLayoutEffect } from 'react';

import { act, renderHook } from '@testing-library/react';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { useFrozenTopHistoryData } from './useFrozenTopHistoryData.native';

jest.mock('@onekeyhq/components', () => ({
  useCurrentTabScrollY: jest.fn(),
}));
jest.mock('react-native-reanimated', () => ({
  runOnJS: (fn: unknown) => fn,
  useAnimatedReaction: jest.fn(),
  useSharedValue: (value: unknown) => ({ value }),
}));

function rows(...rowIds: string[]): IAccountHistoryTx[] {
  return rowIds.map((id) => ({ id }) as unknown as IAccountHistoryTx);
}

function ids(list: IAccountHistoryTx[]) {
  return list.map((row) => row.id);
}

type IProps = {
  combined: IAccountHistoryTx[];
  enabled: boolean;
  identityKey: string;
};

function renderFrozen(initial: IProps) {
  // Record every committed result so a one-commit lag would be visible.
  // Render passes React restarts before committing never reach the screen.
  const rendered: string[][] = [];
  const hook = renderHook(
    ({ combined, enabled, identityKey }: IProps) => {
      const result = useFrozenTopHistoryData(combined, enabled, identityKey);
      const displayedIds = ids(result.displayedHistoryData);
      useLayoutEffect(() => {
        rendered.push(displayedIds);
      });
      return result;
    },
    { initialProps: initial },
  );
  return { ...hook, rendered };
}

describe('useFrozenTopHistoryData (native)', () => {
  it('renders an identity switch without a stale commit', () => {
    const { rerender, rendered } = renderFrozen({
      combined: rows('a1', 'a2'),
      enabled: true,
      identityKey: 'account-a',
    });

    // The container clears the rows in the commit that switches identity,
    // then the local cache read lands the new identity's rows.
    rendered.length = 0;
    rerender({ combined: [], enabled: true, identityKey: 'account-b' });
    rerender({
      combined: rows('b1', 'b2'),
      enabled: true,
      identityKey: 'account-b',
    });

    expect(rendered).toEqual([[], ['b1', 'b2']]);
  });

  it('holds prepended rows back while away from the top', () => {
    const { result, rerender } = renderFrozen({
      combined: rows('a1', 'a2'),
      enabled: true,
      identityKey: 'account-a',
    });

    act(() => result.current.onAwayFromTopChange(true));
    rerender({
      combined: rows('new', 'a1', 'a2', 'a3'),
      enabled: true,
      identityKey: 'account-a',
    });
    // Bottom growth renders live, the top insert is held back.
    expect(ids(result.current.displayedHistoryData)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);

    act(() => result.current.onAwayFromTopChange(false));
    expect(ids(result.current.displayedHistoryData)).toEqual([
      'new',
      'a1',
      'a2',
      'a3',
    ]);
  });

  it('drops the freeze in the render that switches identity', () => {
    const { result, rerender } = renderFrozen({
      combined: rows('shared', 'a1'),
      enabled: true,
      identityKey: 'account-a',
    });
    act(() => result.current.onAwayFromTopChange(true));

    // The new identity reuses a tx id; a carried-over freeze would hold its
    // top row back.
    rerender({
      combined: rows('b-top', 'shared', 'b1'),
      enabled: true,
      identityKey: 'account-b',
    });

    expect(ids(result.current.displayedHistoryData)).toEqual([
      'b-top',
      'shared',
      'b1',
    ]);
  });

  it('does not revive the freeze when switching back to an earlier identity', () => {
    const { result, rerender } = renderFrozen({
      combined: rows('a1', 'a2', 'a3'),
      enabled: true,
      identityKey: 'unfiltered',
    });
    act(() => result.current.onAwayFromTopChange(true));

    // A history filter toggle narrows the stream to a subset of the same ids.
    rerender({
      combined: rows('a2', 'a3'),
      enabled: true,
      identityKey: 'filtered',
    });
    expect(ids(result.current.displayedHistoryData)).toEqual(['a2', 'a3']);

    // Toggling it back must restore the full list, not re-freeze on the
    // filtered subset.
    rerender({
      combined: rows('a1', 'a2', 'a3'),
      enabled: true,
      identityKey: 'unfiltered',
    });
    expect(ids(result.current.displayedHistoryData)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
  });

  it('renders the live list while the gate is off', () => {
    const { result, rerender } = renderFrozen({
      combined: rows('a1', 'a2'),
      enabled: true,
      identityKey: 'account-a',
    });
    act(() => result.current.onAwayFromTopChange(true));

    rerender({
      combined: rows('new', 'a1', 'a2'),
      enabled: false,
      identityKey: 'account-a',
    });

    expect(ids(result.current.displayedHistoryData)).toEqual([
      'new',
      'a1',
      'a2',
    ]);
  });
});
