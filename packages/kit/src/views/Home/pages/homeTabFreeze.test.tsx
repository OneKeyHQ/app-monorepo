import { act, renderHook } from '@testing-library/react-native';

import {
  HOME_TAB_FREEZE_DELAY_MS,
  isHomeTabActive,
  useHomeTabFreeze,
} from './homeTabFreeze';

describe('isHomeTabActive', () => {
  it('never freezes before the pager reports a focused tab', () => {
    expect(
      isHomeTabActive({ tabName: 'Perps', focusedTab: '', pressedTabName: '' }),
    ).toBe(true);
  });

  it('keeps the focused tab and the pressed target active', () => {
    expect(
      isHomeTabActive({
        tabName: 'Spot',
        focusedTab: 'Spot',
        pressedTabName: 'Perps',
      }),
    ).toBe(true);
    // The tab-bar press lands before the pager flips focus; the target must
    // be rendered while the pager slides towards it.
    expect(
      isHomeTabActive({
        tabName: 'Perps',
        focusedTab: 'Spot',
        pressedTabName: 'Perps',
      }),
    ).toBe(true);
    expect(
      isHomeTabActive({
        tabName: 'DeFi',
        focusedTab: 'Spot',
        pressedTabName: 'Perps',
      }),
    ).toBe(false);
  });
});

describe('useHomeTabFreeze', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('unfreezes immediately and freezes only after the switch settles', () => {
    const { result, rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) => useHomeTabFreeze(isActive),
      { initialProps: { isActive: true } },
    );
    expect(result.current).toBe(false);

    rerender({ isActive: false });
    // Still visible while the pager slides away from it.
    expect(result.current).toBe(false);
    act(() => {
      jest.advanceTimersByTime(HOME_TAB_FREEZE_DELAY_MS - 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);

    rerender({ isActive: true });
    expect(result.current).toBe(false);
  });

  it('freezes a pane that mounts inactive without waiting for the delay', () => {
    const { result, rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) => useHomeTabFreeze(isActive),
      { initialProps: { isActive: false } },
    );
    expect(result.current).toBe(true);

    rerender({ isActive: true });
    expect(result.current).toBe(false);
  });

  it('thaws an inactive pane for one delay when its thaw key changes', () => {
    const { result, rerender } = renderHook(
      ({ thawKey }: { thawKey: string }) => useHomeTabFreeze(false, thawKey),
      { initialProps: { thawKey: 'wallet-1-account-0' } },
    );
    expect(result.current).toBe(true);

    rerender({ thawKey: 'wallet-1-account-1' });
    // Rendered once with the new owner so the pane's own effects can run.
    expect(result.current).toBe(false);
    act(() => {
      jest.advanceTimersByTime(HOME_TAB_FREEZE_DELAY_MS - 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('stays frozen across re-renders that keep the same thaw key', () => {
    const { result, rerender } = renderHook(
      ({ thawKey }: { thawKey: string }) => useHomeTabFreeze(false, thawKey),
      { initialProps: { thawKey: 'wallet-1-account-0' } },
    );
    rerender({ thawKey: 'wallet-1-account-0' });
    act(() => {
      jest.advanceTimersByTime(HOME_TAB_FREEZE_DELAY_MS * 2);
    });
    expect(result.current).toBe(true);
  });

  it('does not thaw later for a key that changed while the pane was active', () => {
    const { result, rerender } = renderHook(
      ({ isActive, thawKey }: { isActive: boolean; thawKey: string }) =>
        useHomeTabFreeze(isActive, thawKey),
      { initialProps: { isActive: true, thawKey: 'wallet-1-account-0' } },
    );
    rerender({ isActive: true, thawKey: 'wallet-1-account-1' });
    rerender({ isActive: false, thawKey: 'wallet-1-account-1' });
    act(() => {
      jest.advanceTimersByTime(HOME_TAB_FREEZE_DELAY_MS);
    });
    expect(result.current).toBe(true);

    rerender({ isActive: false, thawKey: 'wallet-1-account-1' });
    expect(result.current).toBe(true);
  });

  it('cancels a pending freeze when the tab regains focus in time', () => {
    const { result, rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) => useHomeTabFreeze(isActive),
      { initialProps: { isActive: true } },
    );
    rerender({ isActive: false });
    act(() => {
      jest.advanceTimersByTime(HOME_TAB_FREEZE_DELAY_MS / 2);
    });
    rerender({ isActive: true });
    act(() => {
      jest.advanceTimersByTime(HOME_TAB_FREEZE_DELAY_MS * 2);
    });
    expect(result.current).toBe(false);
  });
});
