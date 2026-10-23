/** @jest-environment jsdom */

import { useContext } from 'react';
import type { PropsWithChildren } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';

import { TradingViewNativeChartActiveContext } from './TradingViewNativeChartActiveContext';
import { TradingViewNativeChartReadyContext } from './TradingViewNativeChartReadyContext';
import {
  TradingViewNativeFullscreenPage,
  TradingViewNativePresentation,
  pushTradingViewNativeFullscreenModal,
} from './TradingViewNativePresentation.ios';

import type { LayoutChangeEvent } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

let mockPageLayout: ((event: LayoutChangeEvent) => void) | undefined;
let mockChartReady: (() => void) | undefined;
let mockIsNativeIOSPad = false;
const mockDispatch = jest.fn();
const mockPageNavigation = {
  setOptions: jest.fn(),
};
const mockRootState = {
  key: 'root',
  index: 1,
  routes: [
    { key: 'main', name: 'main', params: undefined },
    {
      key: 'fullscreen',
      name: ERootRoutes.TradingViewNativeFullscreen,
      params: { presentationId: '' },
    },
  ],
};

jest.mock('@react-navigation/native', () => ({
  CommonActions: { goBack: () => ({ type: 'GO_BACK' }) },
  StackActions: {
    push: (name: string, params: { presentationId: string }) => ({
      type: 'PUSH',
      payload: { name, params },
    }),
  },
  useRoute: () => mockRootState.routes[1],
  useNavigation: () => mockPageNavigation,
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    onLayout,
  }: PropsWithChildren<{ onLayout?: typeof mockPageLayout }>) => {
    mockPageLayout = onLayout;
    return <div>{children}</div>;
  },
  rootNavigationRef: {
    current: {
      dispatch: (...args: unknown[]) => {
        mockDispatch(...args);
      },
      getState: () => mockRootState,
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOSPad() {
      return mockIsNativeIOSPad;
    },
  },
}));
jest.mock('react-native', () => ({
  StatusBar: () => null,
  useWindowDimensions: () => ({ width: 402, height: 874 }),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: PropsWithChildren) => (
    <div>{children}</div>
  ),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SafeAreaView: ({
    children,
    edges = ['top', 'right', 'bottom', 'left'],
  }: PropsWithChildren<{ edges?: Edge[] }>) => (
    <div
      data-testid="safe-area"
      style={{
        paddingTop: edges.includes('top') ? 62 : 0,
        paddingRight: edges.includes('right') ? 62 : 0,
        paddingBottom: edges.includes('bottom') ? 20 : 0,
        paddingLeft: edges.includes('left') ? 62 : 0,
      }}
    >
      {children}
    </div>
  ),
}));

beforeEach(() => {
  mockIsNativeIOSPad = false;
  mockDispatch.mockReset();
  mockChartReady = undefined;
  mockPageNavigation.setOptions.mockClear();
  mockDispatch.mockImplementation((action) => {
    if (
      action.type === 'PUSH' &&
      action.payload.name === ERootRoutes.TradingViewNativeFullscreen
    ) {
      mockRootState.routes[1].params = action.payload.params;
    }
  });
});
afterEach(cleanup);

function Chart({ label }: { label: string }) {
  const isActive = useContext(TradingViewNativeChartActiveContext);
  mockChartReady = useContext(TradingViewNativeChartReadyContext);
  return <span data-active={isActive}>{label}</span>;
}

function layout(width: number, height: number) {
  act(() => {
    mockPageLayout?.({
      nativeEvent: { layout: { x: 0, y: 0, width, height } },
    } as LayoutChangeEvent);
  });
}

it.each([
  { isPad: false, topPadding: '0px' },
  { isPad: true, topPadding: '62px' },
])(
  'handles a retained portrait top inset without losing cutout protection (iPad: $isPad)',
  ({ isPad, topPadding }) => {
    mockIsNativeIOSPad = isPad;
    render(
      <TradingViewNativePresentation isFullscreen>
        <Chart label="Chart" />
      </TradingViewNativePresentation>,
    );
    const page = render(<TradingViewNativeFullscreenPage />);
    layout(874, 402);
    const safeArea = page.getByTestId('safe-area');
    expect(safeArea.style.paddingTop).toBe(topPadding);
    expect(safeArea.style.paddingRight).toBe('62px');
    expect(safeArea.style.paddingBottom).toBe('20px');
    expect(safeArea.style.paddingLeft).toBe('62px');
  },
);

it('keeps the inline canvas mounted while the native page receives updates', () => {
  const onClose = jest.fn();
  const chart = (isFullscreen: boolean, label: string) => (
    <TradingViewNativePresentation
      isFullscreen={isFullscreen}
      onRequestClose={onClose}
    >
      <Chart label={label} />
    </TradingViewNativePresentation>
  );
  const owner = render(chart(false, '10'));
  const inlineCanvas = owner.container.querySelector('span');
  owner.rerender(chart(true, '11'));
  const page = render(<TradingViewNativeFullscreenPage />);
  expect(owner.container.textContent).toBe('10');
  expect(inlineCanvas?.dataset.active).toBe('false');
  expect(page.container.textContent).toBe('11');
  expect(mockPageNavigation.setOptions).not.toHaveBeenCalled();
  layout(402, 874);
  expect(mockChartReady).toBeUndefined();
  layout(874, 402);
  expect(mockPageNavigation.setOptions).not.toHaveBeenCalled();
  act(() => {
    mockChartReady?.();
  });
  expect(mockPageNavigation.setOptions).toHaveBeenCalledWith({
    contentReady: true,
  });

  owner.rerender(chart(true, '12'));
  expect(page.container.textContent).toBe('12');
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  page.unmount();
  expect(onClose).toHaveBeenCalledTimes(1);
  owner.rerender(chart(false, '12'));
  expect(owner.container.querySelector('span')).toBe(inlineCanvas);
  expect(inlineCanvas?.dataset.active).toBe('true');
  expect(owner.container.textContent).toBe('12');
});

it('closes only the owned native page when the chart owner unmounts', () => {
  const owner = render(
    <TradingViewNativePresentation isFullscreen>
      Chart
    </TradingViewNativePresentation>,
  );
  owner.unmount();
  expect(mockDispatch).toHaveBeenLastCalledWith({
    type: 'GO_BACK',
    source: 'fullscreen',
    target: 'root',
  });
});

it('opens indicator settings above the fullscreen chart without closing it', () => {
  const onClose = jest.fn();
  render(
    <TradingViewNativePresentation isFullscreen onRequestClose={onClose}>
      Chart
    </TradingViewNativePresentation>,
  );
  const page = render(<TradingViewNativeFullscreenPage />);
  act(() => {
    pushTradingViewNativeFullscreenModal(EModalRoutes.MarketModal, {
      screen: EModalMarketRoutes.MarketIndicatorSettings,
      params: { storageNamespace: 'market', indicatorId: 'RSI' },
    });
  });
  expect(mockDispatch).toHaveBeenLastCalledWith({
    type: 'PUSH',
    payload: {
      name: ERootRoutes.Modal,
      params: {
        screen: EModalRoutes.MarketModal,
        params: {
          screen: EModalMarketRoutes.MarketIndicatorSettings,
          params: { storageNamespace: 'market', indicatorId: 'RSI' },
        },
        tradingViewFullscreen: true,
      },
    },
    source: 'fullscreen',
    target: 'root',
  });
  expect(page.container.textContent).toBe('Chart');
  expect(onClose).not.toHaveBeenCalled();
  expect(mockPageNavigation.setOptions).not.toHaveBeenCalled();
});

it.each([true, false])(
  'waits for portrait before closing (initial layout: %s)',
  (hasInitialLayout) => {
    const chart = (isFullscreen: boolean) => (
      <TradingViewNativePresentation isFullscreen={isFullscreen}>
        <Chart label="Chart" />
      </TradingViewNativePresentation>
    );
    const owner = render(chart(true));
    const page = render(<TradingViewNativeFullscreenPage />);
    if (hasInitialLayout) layout(874, 402);
    const lateChartReady = mockChartReady;
    owner.rerender(chart(false));
    expect(mockPageNavigation.setOptions).toHaveBeenCalledWith({
      contentReady: false,
      orientation: 'portrait',
    });
    act(() => lateChartReady?.());
    expect(mockPageNavigation.setOptions).not.toHaveBeenCalledWith({
      contentReady: true,
    });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(page.container.textContent).toBe('Chart');
    expect(page.container.querySelector('span')?.dataset.active).toBe('false');
    layout(0, 0);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    layout(402, 874);
    expect(mockDispatch).toHaveBeenLastCalledWith({
      type: 'GO_BACK',
      source: 'fullscreen',
      target: 'root',
    });
  },
);
