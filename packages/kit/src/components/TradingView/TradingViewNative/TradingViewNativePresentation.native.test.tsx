/** @jest-environment jsdom */

import { useContext } from 'react';
import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewNativePresentationRotationContext } from './native/TradingViewNativePresentationContext';
import {
  TradingViewNativeFullscreenHost,
  TradingViewNativePresentation,
  setTradingViewNativeTransitionCover,
} from './TradingViewNativePresentation.native';

let mockPortalHost: HTMLElement;

jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    rotate,
    width,
    height,
  }: {
    children: ReactNode;
    rotate?: string;
    width?: number;
    height?: number;
  }) => (
    <div data-rotation={rotate} data-width={width} data-height={height}>
      {children}
    </div>
  ),
  OverlayContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('react-native', () => ({
  Image: ({ source }: { source: { uri: string } }) => (
    <img src={source.uri} alt="Transition" />
  ),
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  StyleSheet: { absoluteFill: {} },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true, isNativeIOSPad: false },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaInsetsContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext({ top: 0, right: 0, bottom: 0, left: 0 }),
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
  SafeAreaProvider: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SafeAreaView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('TradingViewNative fullscreen presentation', () => {
  beforeEach(() => {
    platformEnv.isNativeIOSPad = false;
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

  it.each([false, true])(
    'rotates only the iPhone chart within the current window (iPad: %s)',
    (isPad) => {
      platformEnv.isNativeIOSPad = isPad;
      function Chart() {
        const rotated = useContext(
          TradingViewNativePresentationRotationContext,
        );
        return <span>{rotated ? 'rotated' : 'unrotated'}</span>;
      }
      render(
        <TradingViewNativePresentation isFullscreen>
          <Chart />
        </TradingViewNativePresentation>,
      );
      const rotatedLayer = mockPortalHost.querySelector(
        '[data-rotation="90deg"]',
      );
      if (isPad) {
        expect(rotatedLayer).toBeNull();
        expect(mockPortalHost.textContent).toBe('unrotated');
      } else {
        expect(rotatedLayer?.getAttribute('data-width')).toBe('844');
        expect(rotatedLayer?.getAttribute('data-height')).toBe('390');
        expect(mockPortalHost.textContent).toBe('rotated');
      }
    },
  );

  it('keeps the transition image above both presentations until explicitly released', () => {
    const { rerender } = render(
      <TradingViewNativePresentation isFullscreen>
        <button type="button">Chart</button>
      </TradingViewNativePresentation>,
    );
    act(() =>
      setTradingViewNativeTransitionCover('transition', {
        uri: 'file:///transition.png',
        onLoad: jest.fn(),
        onError: jest.fn(),
      }),
    );
    expect(
      mockPortalHost.lastElementChild?.querySelector('img'),
    ).not.toBeNull();
    rerender(
      <TradingViewNativePresentation isFullscreen={false}>
        <button type="button">Chart</button>
      </TradingViewNativePresentation>,
    );
    expect(mockPortalHost.querySelector('img')).not.toBeNull();
    act(() => setTradingViewNativeTransitionCover('transition', null));
    expect(mockPortalHost.querySelector('img')).toBeNull();
  });
});
