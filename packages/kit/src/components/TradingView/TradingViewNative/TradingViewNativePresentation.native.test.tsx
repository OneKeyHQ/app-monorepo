/** @jest-environment jsdom */

import { useContext } from 'react';
import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  within,
} from '@testing-library/react';

import type { Dialog } from '@onekeyhq/components';
import { NativePopoverPresentationContext } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewChartDialogContext } from '../TradingViewChartControls/TradingViewChartDialogContext';

import { TradingViewNativePresentationRotationContext } from './native/TradingViewNativePresentationContext';
import {
  TradingViewNativeFullscreenHost,
  TradingViewNativePresentation,
  setTradingViewNativeTransitionCover,
} from './TradingViewNativePresentation.native';

let mockPortalHost: HTMLElement;
let mockDimensions = { width: 390, height: 844 };
const mockDialogShow = jest.fn<
  ReturnType<typeof Dialog.show>,
  [Parameters<typeof Dialog.show>[0]]
>(() => ({
  close: jest.fn(async () => undefined),
  getForm: () => undefined,
  isExist: () => true,
}));

jest.mock('@onekeyhq/components', () => ({
  NativePopoverPresentationContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(undefined),
  Dialog: {
    show: (props: Parameters<typeof Dialog.show>[0]) => mockDialogShow(props),
  },
  Portal: {
    Container: ({ name, children }: { name: string; children: ReactNode }) => (
      <div data-portal={name}>{children}</div>
    ),
  },
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
  useWindowDimensions: () => mockDimensions,
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
    jest.clearAllMocks();
    platformEnv.isNativeIOSPad = false;
    mockDimensions = { width: 390, height: 844 };
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

  it.each(['unmount', 'resize'])(
    'opens a right drawer in the rotated chart and cleans it up on %s',
    (cleanupReason) => {
      function Chart() {
        const showDialog = useContext(TradingViewChartDialogContext);
        const popoverPresentation = useContext(
          NativePopoverPresentationContext,
        );
        return (
          <button
            type="button"
            data-popover-portal={popoverPresentation?.portalContainer}
            onClick={() =>
              showDialog?.({ title: 'Indicators', showFooter: false })
            }
          >
            Indicators
          </button>
        );
      }
      const chart = (
        <TradingViewNativePresentation isFullscreen>
          <Chart />
        </TradingViewNativePresentation>
      );
      const { unmount, rerender } = render(chart);
      const button = within(mockPortalHost).getByRole('button');
      fireEvent.click(button);
      const props = mockDialogShow.mock.calls[0][0];
      const portal = mockPortalHost.querySelector(
        `[data-portal="${props.portalContainer}"]`,
      );
      expect(portal?.closest('[data-rotation="90deg"]')).not.toBeNull();
      expect(button.getAttribute('data-popover-portal')).toBe(
        props.portalContainer,
      );
      expect(props).toEqual(
        expect.objectContaining({
          nativeSheet: false,
          nativeDrawer: { width: 422, height: 390 },
        }),
      );
      const instance = mockDialogShow.mock.results[0].value as ReturnType<
        typeof Dialog.show
      >;
      if (cleanupReason === 'resize') {
        mockDimensions = { width: 844, height: 390 };
        rerender(
          <TradingViewNativePresentation isFullscreen>
            <Chart />
          </TradingViewNativePresentation>,
        );
      } else {
        unmount();
      }
      expect(instance.close).toHaveBeenCalledTimes(1);
    },
  );
});
