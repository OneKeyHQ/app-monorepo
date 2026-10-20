/** @jest-environment jsdom */

import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { TradingViewNativePresentation } from './TradingViewNativePresentation.ios';

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: PropsWithChildren) => (
    <div>{children}</div>
  ),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SafeAreaView: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('react-native-screens', () => ({
  FullWindowOverlay: ({
    children,
    inlinePresentation,
  }: PropsWithChildren<{ inlinePresentation: boolean }>) => (
    <div data-testid="native-container" data-inline={inlinePresentation}>
      {children}
    </div>
  ),
}));

it('retains the chart instance and local state through fullscreen round trips', () => {
  const mounted = jest.fn();
  const unmounted = jest.fn();
  function Chart() {
    const [viewport, setViewport] = useState(0);
    useEffect(() => {
      mounted();
      return unmounted;
    }, []);
    return (
      <button type="button" onClick={() => setViewport((value) => value + 1)}>
        {viewport}
      </button>
    );
  }
  const presentation = (isFullscreen: boolean) => (
    <TradingViewNativePresentation isFullscreen={isFullscreen}>
      <Chart />
    </TradingViewNativePresentation>
  );
  const { getByRole, getByTestId, rerender, unmount } = render(
    presentation(false),
  );
  const canvas = getByRole('button');
  fireEvent.click(canvas);

  for (const fullscreen of [true, false, true, false]) {
    rerender(presentation(fullscreen));
    expect(getByRole('button')).toBe(canvas);
    expect(canvas.textContent).toBe('1');
    expect(getByTestId('native-container').dataset.inline).toBe(
      String(!fullscreen),
    );
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  }

  unmount();
  expect(unmounted).toHaveBeenCalledTimes(1);
});
