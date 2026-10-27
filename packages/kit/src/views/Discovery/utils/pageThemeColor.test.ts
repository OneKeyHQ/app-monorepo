/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  applyCachedPageThemeColor,
  clearPageColors,
  tryDispatchPageThemeMessage,
  usePageBottomColor,
  usePageTheme,
} from './pageThemeColor';

const TAB = 'tab-1';

function reportColors(color: string, bottomColor: string, pageUrl: string) {
  return tryDispatchPageThemeMessage(
    TAB,
    JSON.stringify({
      type: '$onekeyPageThemeColor',
      color,
      bottomColor,
    }),
    pageUrl,
  );
}

function renderColors() {
  return renderHook(() => ({
    top: usePageTheme(TAB).pageColor,
    bottom: usePageBottomColor(TAB),
  }));
}

beforeEach(() => {
  clearPageColors(TAB);
});

describe('applyCachedPageThemeColor', () => {
  it('drops the page bottom color and falls back to the top color', () => {
    const { result } = renderColors();

    act(() => {
      reportColors('rgb(0, 0, 0)', 'rgb(10, 10, 10)', 'https://a.example.com/');
    });
    expect(result.current.bottom).toBe('rgb(10, 10, 10)');

    act(() => {
      applyCachedPageThemeColor(TAB, 'https://b.example.com/');
    });

    // The top color stays until the destination reports, and the bottom color of
    // the page just left must not drive the bar's icon contrast any more.
    expect(result.current.top).toBe('rgb(0, 0, 0)');
    expect(result.current.bottom).toBe('rgb(0, 0, 0)');
  });

  it('applies the destination cached color over the previous page colors', () => {
    const { result } = renderColors();

    // Visit the light page first so its origin is cached.
    act(() => {
      reportColors(
        'rgb(255, 255, 255)',
        'rgb(250, 250, 250)',
        'https://light.example.com/',
      );
    });
    act(() => {
      reportColors(
        'rgb(0, 0, 0)',
        'rgb(12, 12, 12)',
        'https://dark.example.com/',
      );
    });
    expect(result.current.bottom).toBe('rgb(12, 12, 12)');

    act(() => {
      applyCachedPageThemeColor(TAB, 'https://light.example.com/');
    });

    expect(result.current.top).toBe('rgb(255, 255, 255)');
    expect(result.current.bottom).toBe('rgb(255, 255, 255)');
  });

  it('notifies subscribers when only the bottom color has to be dropped', () => {
    const { result } = renderColors();

    act(() => {
      reportColors(
        'rgb(30, 30, 30)',
        'rgb(40, 40, 40)',
        'https://c.example.com/',
      );
    });

    act(() => {
      // Same origin, so the cached top color equals the current one; dropping the
      // stale bottom color alone must still re-render the chrome.
      applyCachedPageThemeColor(TAB, 'https://c.example.com/');
    });

    expect(result.current.top).toBe('rgb(30, 30, 30)');
    expect(result.current.bottom).toBe('rgb(30, 30, 30)');
  });
});
