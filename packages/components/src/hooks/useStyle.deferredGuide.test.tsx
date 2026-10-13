/** @jest-environment jsdom */

import type { ReactNode } from 'react';
import { StrictMode } from 'react';

import { act, render, renderHook } from '@testing-library/react';

import { SHEET_AND_DIALOG_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import Toaster from '../actions/Toast/Toaster';

import {
  acquireDeferredGuideBlocker,
  useDeferredGuideBlocker,
  useIsDeferredGuideBlocked,
} from './useDeferredGuideBlocker';
import { useOverlayZIndex } from './useStyle';

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  getTokens: jest.fn(),
  useMedia: () => ({ md: false }),
  useThemeName: () => 'light',
}));

jest.mock('../primitives', () => ({
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('sonner', () => ({
  Toaster: () => <div>Ordinary toast viewport</div>,
}));

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 1280, height: 800 }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false },
}));

describe('overlay guide registration', () => {
  it('registers only open overlays and releases when they close', () => {
    const blocked = renderHook(() => useIsDeferredGuideBlocked());
    const overlay = renderHook(({ open }) => useOverlayZIndex(open), {
      initialProps: { open: false },
    });

    expect(blocked.result.current).toBe(false);

    overlay.rerender({ open: true });
    expect(blocked.result.current).toBe(true);

    overlay.rerender({ open: false });
    expect(blocked.result.current).toBe(false);
  });

  it('keeps closed dialogs and popovers from blocking while mounted', () => {
    const blocked = renderHook(() => useIsDeferredGuideBlocked());
    renderHook(() => useOverlayZIndex());
    renderHook(() => useOverlayZIndex(false));

    expect(blocked.result.current).toBe(false);
  });

  it.each(['first', 'last'] as const)(
    'waits for every overlay when the %s opened overlay closes first',
    (closeFirst) => {
      const blocked = renderHook(() => useIsDeferredGuideBlocked());
      const first = renderHook(({ open }) => useOverlayZIndex(open), {
        initialProps: { open: true },
      });
      const last = renderHook(({ open }) => useOverlayZIndex(open), {
        initialProps: { open: true },
      });

      expect(blocked.result.current).toBe(true);
      const [closing, remaining] =
        closeFirst === 'first' ? [first, last] : [last, first];

      closing.rerender({ open: false });
      expect(blocked.result.current).toBe(true);

      remaining.rerender({ open: false });
      expect(blocked.result.current).toBe(false);
    },
  );

  it('releases an unmounted overlay without clearing another open overlay', () => {
    const blocked = renderHook(() => useIsDeferredGuideBlocked());
    const first = renderHook(() => useOverlayZIndex(true));
    const second = renderHook(() => useOverlayZIndex(true));

    first.unmount();
    expect(blocked.result.current).toBe(true);

    second.unmount();
    expect(blocked.result.current).toBe(false);
  });

  it('preserves the existing stacking values when registering overlays', () => {
    const first = renderHook(() => useOverlayZIndex(true));
    const second = renderHook(() => useOverlayZIndex(true));

    expect(first.result.current).toBe(SHEET_AND_DIALOG_Z_INDEX);
    expect(second.result.current).toBe(SHEET_AND_DIALOG_Z_INDEX + 1);
  });

  it('does not register the ordinary toast viewport on mount or unmount', () => {
    const blocked = renderHook(() => useIsDeferredGuideBlocked());
    const toast = render(<Toaster />);

    expect(blocked.result.current).toBe(false);

    toast.unmount();
    expect(blocked.result.current).toBe(false);
  });

  it('releases concurrent leases independently and makes each release idempotent', () => {
    const blocked = renderHook(() => useIsDeferredGuideBlocked());
    let releaseFirst = () => {};
    let releaseSecond = () => {};
    try {
      act(() => {
        releaseFirst = acquireDeferredGuideBlocker();
        releaseSecond = acquireDeferredGuideBlocker();
      });
      expect(blocked.result.current).toBe(true);

      act(() => {
        releaseFirst();
        releaseFirst();
      });
      expect(blocked.result.current).toBe(true);

      act(() => {
        releaseSecond();
        releaseSecond();
      });
      expect(blocked.result.current).toBe(false);
    } finally {
      act(() => {
        releaseFirst();
        releaseSecond();
      });
    }
  });

  it('does not leak a lease after Strict Mode replays effects and the owner unmounts', () => {
    const blocked = renderHook(() => useIsDeferredGuideBlocked());
    const owner = renderHook(() => useDeferredGuideBlocker(true), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      ),
    });

    expect(blocked.result.current).toBe(true);

    owner.unmount();
    expect(blocked.result.current).toBe(false);
  });
});
