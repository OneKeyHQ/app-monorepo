/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';

import {
  TradingViewNativeFullscreenHost,
  TradingViewNativePresentation,
} from './TradingViewNativePresentation.native';

let mockPortalHost: HTMLElement;
let mockLayerProps: Record<string, unknown>;
// A landscape Android window is 640 wide; its side navigation bar takes 48.
const mockContentFrame = { x: 0, y: 0, width: 592, height: 360 };

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children, ...props }: { children: ReactNode }) => {
    mockLayerProps = props;
    return <div>{children}</div>;
  },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaFrame: () => mockContentFrame,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('TradingViewNative fullscreen presentation', () => {
  beforeEach(() => {
    mockPortalHost = render(<TradingViewNativeFullscreenHost />).container;
  });

  afterEach(() => {
    cleanup();
  });

  it('moves presentation out of the inline tree and removes the layer synchronously on exit', () => {
    const chart = (isFullscreen: boolean, label = 'Chart') => (
      <TradingViewNativePresentation isFullscreen={isFullscreen}>
        <button type="button">{label}</button>
      </TradingViewNativePresentation>
    );
    const { container, rerender } = render(chart(false));
    expect(container.textContent).toBe('Chart');
    expect(mockPortalHost.textContent).toBe('');

    rerender(chart(true));
    expect(container.textContent).toBe('');
    expect(mockPortalHost.textContent).toBe('Chart');

    rerender(chart(true, 'Updated chart'));
    expect(mockPortalHost.textContent).toBe('Updated chart');

    rerender(chart(false, 'Updated chart'));
    expect(container.textContent).toBe('Updated chart');
    expect(mockPortalHost.textContent).toBe('');
  });

  it('removes the fullscreen layer when the chart owner unmounts', () => {
    const { unmount } = render(
      <TradingViewNativePresentation isFullscreen>
        <button type="button">Chart</button>
      </TradingViewNativePresentation>,
    );
    expect(mockPortalHost.textContent).toBe('Chart');
    unmount();
    expect(mockPortalHost.textContent).toBe('');
  });

  it('sizes the fullscreen layer to the app content frame instead of the window', () => {
    render(
      <TradingViewNativePresentation isFullscreen>
        <button type="button">Chart</button>
      </TradingViewNativePresentation>,
    );
    expect(mockLayerProps).toMatchObject({
      testID: 'trading-view-native-fullscreen-layer',
      top: 0,
      left: 0,
      width: 592,
      height: 360,
    });
  });
});
