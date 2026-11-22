/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import {
  MODIFIER_HOLD_DELAY_MS,
  useModifierKeyHold,
} from './useModifierKeyHold';

// App shortcuts arrive from the Electron main process.
let mockOnShortcut: (() => void) | undefined;
jest.mock('@onekeyhq/components/src/hooks/useShortcuts', () => ({
  useShortcuts: (_eventName: unknown, callback: () => void) => {
    mockOnShortcut = callback;
  },
}));

function press(
  type: 'keydown' | 'keyup',
  key: string,
  code = key,
  metaKey = false,
) {
  act(() => {
    globalThis.dispatchEvent(new KeyboardEvent(type, { key, code, metaKey }));
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

  it('does not show while another key is still held', () => {
    const { result } = renderHold();
    press('keydown', 'a', 'KeyA');
    press('keydown', 'Meta');
    wait(MODIFIER_HOLD_DELAY_MS);
    expect(result.current).toBe(false);
  });

  it('a key held from before still blocks it after Cmd is pressed again', () => {
    const { result } = renderHold();
    press('keydown', 'a', 'KeyA');
    press('keydown', 'Meta', 'MetaLeft', true);
    press('keyup', 'Meta', 'MetaLeft');
    press('keydown', 'Meta', 'MetaLeft', true);
    wait(MODIFIER_HOLD_DELAY_MS);
    expect(result.current).toBe(false);
  });

  it('a key pressed under Cmd whose keyup was dropped does not block it', () => {
    const { result } = renderHold();
    press('keydown', 'Meta', 'MetaLeft', true);
    press('keydown', 'c', 'KeyC', true);
    press('keyup', 'Meta', 'MetaLeft');
    press('keydown', 'Meta', 'MetaLeft', true);
    wait(MODIFIER_HOLD_DELAY_MS);
    expect(result.current).toBe(true);
  });

  it('a key released under another name (Shift+A) no longer blocks it', () => {
    const { result } = renderHold();
    press('keydown', 'A', 'KeyA');
    press('keyup', 'a', 'KeyA');
    press('keydown', 'Meta');
    wait(MODIFIER_HOLD_DELAY_MS);
    expect(result.current).toBe(true);
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
    const { result } = renderHold();
    press('keydown', 'Meta');
    wait(MODIFIER_HOLD_DELAY_MS);
    expect(result.current).toBe(true);

    act(() => mockOnShortcut?.());
    expect(result.current).toBe(false);
  });
});
