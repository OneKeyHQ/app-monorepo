/** @jest-environment jsdom */

import { useContext } from 'react';
import type { ReactNode } from 'react';

import { cleanup, render } from '@testing-library/react';

import { TradingViewNativeChartActiveContext } from './TradingViewNativeChartActiveContext';
import { TradingViewNativeChartReadyContext } from './TradingViewNativeChartReadyContext';
import { TradingViewNativeFullscreenTransitionContext } from './TradingViewNativeFullscreenTransitionContext';
import {
  TradingViewNativeFullscreenHost,
  TradingViewNativePresentation,
} from './TradingViewNativePresentation.native';

import type { ITradingViewNativeFullscreenTransition } from './TradingViewNativeFullscreenTransitionContext';

let mockPortalHost: HTMLElement;
let mockLayerProps: Record<string, unknown>;
let mockOverlayProps: Record<string, unknown>;
let mockGestureRootStyle: Record<string, unknown>;
// A landscape Android window is 640 wide; its side navigation bar takes 48.
let mockContentFrame = { x: 0, y: 0, width: 592, height: 360 };
let mockWindowFrame: { width: number; height: number } | null = null;
let mockFrameCallback: (() => void) | undefined;
const mockSetFrameCallbackActive = jest.fn<void, [boolean]>();
let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({
    children,
    style,
  }: {
    children: ReactNode;
    style: Record<string, unknown>;
  }) => {
    mockGestureRootStyle = style;
    return <div>{children}</div>;
  },
}));
jest.mock('react-native-reanimated', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      View: ({
        children,
        style,
        ...props
      }: {
        children?: ReactNode;
        style: Record<string, unknown>[] | Record<string, unknown>;
      }) => {
        // The layer passes an animated style list; the window probe does not.
        if (Array.isArray(style)) {
          mockLayerProps = { ...props, style: Object.assign({}, ...style) };
        }
        return <div>{children}</div>;
      },
    },
    measure: () => mockWindowFrame,
    useAnimatedRef: () => react.useRef(null),
    useAnimatedStyle: (updater: () => Record<string, unknown>) => updater(),
    useFrameCallback: (callback: () => void) => {
      mockFrameCallback = callback;
      return react.useRef({ setActive: mockSetFrameCallbackActive }).current;
    },
    useSharedValue: (value: unknown) => react.useRef({ value }).current,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaFrame: () => mockContentFrame,
  useSafeAreaInsets: () => mockInsets,
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: ({ children, ...props }: { children: ReactNode }) => {
    mockOverlayProps = props;
    return <div>{children}</div>;
  },
}));

function ChartProbe() {
  const isActive = useContext(TradingViewNativeChartActiveContext);
  const onReady = useContext(TradingViewNativeChartReadyContext);
  return (
    <button type="button" onClick={onReady}>
      {isActive ? 'active' : 'inactive'}:{onReady ? 'ready' : 'none'}
    </button>
  );
}

function createTransition(
  overrides: Partial<ITradingViewNativeFullscreenTransition> = {},
): ITradingViewNativeFullscreenTransition {
  return {
    isRevealed: false,
    isLandscapeLayout: true,
    isStatusBarHidden: true,
    layerOpacity: {
      value: 0,
    } as ITradingViewNativeFullscreenTransition['layerOpacity'],
    revealOnLandscape: {
      value: false,
    } as ITradingViewNativeFullscreenTransition['revealOnLandscape'],
    onLayerReady: jest.fn(),
    ...overrides,
  };
}

describe('TradingViewNative fullscreen presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowFrame = null;
    mockFrameCallback = undefined;
    mockContentFrame = { x: 0, y: 0, width: 592, height: 360 };
    mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    mockPortalHost = render(<TradingViewNativeFullscreenHost />).container;
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the inline chart under the fullscreen layer and removes the layer synchronously on exit', () => {
    const chart = (isFullscreen: boolean, label = 'Chart') => (
      <TradingViewNativePresentation isFullscreen={isFullscreen}>
        <button type="button">{label}</button>
      </TradingViewNativePresentation>
    );
    const { container, rerender } = render(chart(false));
    expect(container.textContent).toBe('Chart');
    expect(mockPortalHost.textContent).toBe('');

    rerender(chart(true));
    expect(container.textContent).toBe('Chart');
    expect(mockPortalHost.textContent).toBe('Chart');

    // The inline chart keeps the frame it had when fullscreen opened.
    rerender(chart(true, 'Updated chart'));
    expect(container.textContent).toBe('Chart');
    expect(mockPortalHost.textContent).toBe('Updated chart');

    rerender(chart(false, 'Updated chart'));
    expect(container.textContent).toBe('Updated chart');
    expect(mockPortalHost.textContent).toBe('');
  });

  it('mounts no inline chart for an owner that starts in fullscreen', () => {
    const chart = (isFullscreen: boolean, label: string) => (
      <TradingViewNativePresentation isFullscreen={isFullscreen}>
        <button type="button">{label}</button>
      </TradingViewNativePresentation>
    );
    const { container, rerender } = render(chart(true, 'Fullscreen chart'));
    expect(container.textContent).toBe('');
    expect(mockPortalHost.textContent).toBe('Fullscreen chart');

    rerender(chart(false, 'Inline chart'));
    expect(container.textContent).toBe('Inline chart');
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

  it('activates only the fullscreen chart and gives it the ready callback', () => {
    const transition = createTransition();
    const chart = (isFullscreen: boolean) => (
      <TradingViewNativeFullscreenTransitionContext.Provider value={transition}>
        <TradingViewNativePresentation isFullscreen={isFullscreen}>
          <ChartProbe />
        </TradingViewNativePresentation>
      </TradingViewNativeFullscreenTransitionContext.Provider>
    );
    const { container, rerender } = render(chart(false));
    expect(container.textContent).toBe('active:none');

    rerender(chart(true));
    expect(container.textContent).toBe('inactive:none');
    expect(mockPortalHost.textContent).toBe('active:ready');
    mockPortalHost.querySelector('button')?.click();
    expect(transition.onLayerReady).toHaveBeenCalledTimes(1);
  });

  it('sizes the fullscreen layer to the app content frame instead of the window', () => {
    render(
      <TradingViewNativePresentation isFullscreen>
        <button type="button">Chart</button>
      </TradingViewNativePresentation>,
    );
    expect(mockLayerProps).toMatchObject({
      pointerEvents: 'auto',
      style: { top: 0, left: 0, width: 592, height: 360, opacity: 1 },
    });
    expect(mockOverlayProps.contentSize).toBeUndefined();
  });

  it('lays out a rotating layer for landscape and keeps it hidden until revealed', () => {
    // Prepared in the portrait window it is about to rotate out of.
    mockContentFrame = { x: 0, y: 0, width: 360, height: 640 };
    mockInsets = { top: 24, right: 0, bottom: 24, left: 16 };
    const chart = (transition: ITradingViewNativeFullscreenTransition) => (
      <TradingViewNativeFullscreenTransitionContext.Provider value={transition}>
        <TradingViewNativePresentation isFullscreen>
          <button type="button">Chart</button>
        </TradingViewNativePresentation>
      </TradingViewNativeFullscreenTransitionContext.Provider>
    );
    const transition = createTransition();
    const { rerender } = render(chart(transition));

    expect(mockLayerProps).toMatchObject({
      pointerEvents: 'none',
      importantForAccessibility: 'no-hide-descendants',
      style: { width: 640, height: 360, opacity: 0 },
    });
    // The overlay would otherwise clip the layer to the portrait window size
    // JS still holds right after rotation.
    expect(mockOverlayProps.contentSize).toEqual({ width: 640, height: 360 });
    expect(mockGestureRootStyle).toMatchObject({
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 24,
      paddingLeft: 0,
    });

    rerender(chart({ ...transition, isRevealed: true }));
    expect(mockLayerProps).toMatchObject({
      pointerEvents: 'auto',
      accessibilityViewIsModal: true,
    });
  });

  it('shows a rotating layer on the UI thread once the window is landscape', () => {
    mockContentFrame = { x: 0, y: 0, width: 360, height: 640 };
    const request = { value: false };
    const opacity = { value: 0 };
    const transition = createTransition({
      layerOpacity:
        opacity as ITradingViewNativeFullscreenTransition['layerOpacity'],
      revealOnLandscape:
        request as ITradingViewNativeFullscreenTransition['revealOnLandscape'],
    });
    render(
      <TradingViewNativeFullscreenTransitionContext.Provider value={transition}>
        <TradingViewNativePresentation isFullscreen>
          <button type="button">Chart</button>
        </TradingViewNativePresentation>
      </TradingViewNativeFullscreenTransitionContext.Provider>,
    );
    expect(mockSetFrameCallbackActive).toHaveBeenLastCalledWith(true);

    // Not requested yet: the layer is still preparing.
    mockWindowFrame = { width: 640, height: 360 };
    mockFrameCallback?.();
    expect(opacity.value).toBe(0);

    // Requested, but the window has not rotated yet.
    request.value = true;
    mockWindowFrame = { width: 360, height: 640 };
    mockFrameCallback?.();
    expect(opacity.value).toBe(0);

    mockWindowFrame = { width: 640, height: 360 };
    mockFrameCallback?.();
    expect(opacity.value).toBe(1);
    expect(request.value).toBe(false);
  });
});
