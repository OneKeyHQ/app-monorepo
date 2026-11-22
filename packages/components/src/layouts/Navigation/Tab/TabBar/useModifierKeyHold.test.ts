/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import {
  MODIFIER_HOLD_DELAY_MS,
  useModifierKeyHold,
} from './useModifierKeyHold';

function press(type: 'keydown' | 'keyup', key: string) {
  act(() => {
    globalThis.dispatchEvent(new KeyboardEvent(type, { key }));
  });
}

function wait(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('useModifierKeyHold', () => {
  // jest-setup.js stubs the window listeners; use jsdom's real ones here.
  const stubbedAddEventListener = globalThis.addEventListener;
  beforeAll(() => {
    // @ts-expect-error restore the prototype method behind the stub
    delete globalThis.addEventListener;
  });
  afterAll(() => {
    globalThis.addEventListener = stubbedAddEventListener;
  });
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function renderHold() {
    return renderHook(() =>
      useModifierKeyHold({ enabled: true, modifierKey: 'Meta' }),
    );
  }

  it('shows after the modifier is held alone and hides on release', () => {
    const { result } = renderHold();
    press('keydown', 'Meta');
    wait(MODIFIER_HOLD_DELAY_MS - 1);
    expect(result.current).toBe(false);

    wait(1);
    expect(result.current).toBe(true);

    press('keyup', 'Meta');
    expect(result.current).toBe(false);
  });

  it('a quick combo such as Cmd+C never shows it', () => {
    const { result } = renderHold();
    press('keydown', 'Meta');
    press('keydown', 'c');
    wait(MODIFIER_HOLD_DELAY_MS);
    expect(result.current).toBe(false);
  });

  it('hides when the window loses focus while held', () => {
    const { result } = renderHold();
    press('keydown', 'Meta');
    wait(MODIFIER_HOLD_DELAY_MS);
    expect(result.current).toBe(true);

    act(() => {
      globalThis.dispatchEvent(new Event('blur'));
    });
    expect(result.current).toBe(false);
  });

  // Cmd+digit is taken by the Electron main process and never reaches the
  // page as a keydown; it arrives as the shortcut IPC instead.
  it('hides when an app shortcut fires while held', () => {
    let onShortcut: (() => void) | undefined;
    globalThis.desktopApi = {
      addIpcEventListener: (_event: string, listener: () => void) => {
        onShortcut = listener;
        return () => undefined;
      },
    } as unknown as typeof globalThis.desktopApi;

    const { result, unmount } = renderHold();
    press('keydown', 'Meta');
    wait(MODIFIER_HOLD_DELAY_MS);
    expect(result.current).toBe(true);

    act(() => onShortcut?.());
    expect(result.current).toBe(false);

    unmount();
    // @ts-expect-error test cleanup
    delete globalThis.desktopApi;
  });
});
