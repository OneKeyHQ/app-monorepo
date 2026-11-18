import { act, renderHook } from '@testing-library/react-native';

import {
  HOME_TAB_FREEZE_DELAY_MS,
  isHomeTabActive,
  useHomeTabFreeze,
  useHomeTabOwnerThaw,
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

describe('useHomeTabOwnerThaw', () => {
  it('thaws for the render cycle in which the owner changes', () => {
    const { result, rerender } = renderHook(
      ({ ownerKey }: { ownerKey: string | undefined }) =>
        useHomeTabOwnerThaw(ownerKey),
      { initialProps: { ownerKey: 'hd-1-a' } },
    );
    expect(result.current).toBe(false);

    rerender({ ownerKey: 'hd-1-b' });
    // The effect that records the new owner has run by the time renderHook
    // returns, so the thaw is observable only through the freeze it drives.
    expect(result.current).toBe(false);

    rerender({ ownerKey: 'hd-1-b' });
    expect(result.current).toBe(false);
  });

  it('never thaws a pane without an owner', () => {
    const { result, rerender } = renderHook(
      ({ ownerKey }: { ownerKey: string | undefined }) =>
        useHomeTabOwnerThaw(ownerKey),
      { initialProps: { ownerKey: undefined } },
    );
    expect(result.current).toBe(false);
    rerender({ ownerKey: undefined });
    expect(result.current).toBe(false);
  });
});

describe('useHomeTabFreeze with an owner thaw', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('unfreezes an inactive pane on an owner change and re-freezes after the delay', () => {
    const { result, rerender } = renderHook(
      ({ ownerKey }: { ownerKey: string }) => {
        const thaw = useHomeTabOwnerThaw(ownerKey);
        return useHomeTabFreeze(
          thaw ||
            isHomeTabActive({
              tabName: 'Spot',
              focusedTab: 'History',
              pressedTabName: 'History',
            }),
        );
      },
      { initialProps: { ownerKey: 'hd-1-a' } },
    );
    expect(result.current).toBe(true);

    rerender({ ownerKey: 'hd-1-b' });
    // Thawed: the owner-change render and its effects ran unfrozen, and the
    // freeze timer only starts once the thaw flag drops.
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
});
