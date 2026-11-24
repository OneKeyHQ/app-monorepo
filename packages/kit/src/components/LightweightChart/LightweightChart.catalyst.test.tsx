/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { LightweightChart } from './index.native';

import type { ILightweightChartProps } from './types';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

let mockIsCatalyst = true;
let mockSkiaModuleFails = false;
let mockOnSkiaError: (() => void) | undefined;
const mockLoadSkiaModule = jest.fn();
const mockInjectJavaScript = jest.fn();
let mockWebViewProps: WebViewProps = {};
const mockGenerateChartHTML = jest.fn<string, [unknown]>(
  () => '<html>chart</html>',
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOSMacCatalyst() {
      return mockIsCatalyst;
    },
  },
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/sentry', () => ({
  initSentry: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('./LightweightChart.native', () => {
  mockLoadSkiaModule();
  if (mockSkiaModuleFails) {
    const { OneKeyLocalError: MockSkiaError } = jest.requireActual<
      typeof import('@onekeyhq/shared/src/errors')
    >('@onekeyhq/shared/src/errors');
    throw new MockSkiaError('Skia initialization failed');
  }
  return {
    LightweightChart: function MockSkiaChart({
      onSkiaError,
    }: {
      onSkiaError: () => void;
    }) {
      mockOnSkiaError = onSkiaError;
      return <div data-testid="skia-chart" />;
    },
  };
});
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('./hooks/useChartConfig', () => ({
  useChartConfig: ({ data }: ILightweightChartProps) => ({ data }),
}));
jest.mock('./utils/htmlTemplate', () => ({
  generateChartHTML: (config: unknown) => mockGenerateChartHTML(config),
}));
jest.mock('react-native-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockWebView = React.forwardRef<
    { injectJavaScript: typeof mockInjectJavaScript },
    WebViewProps
  >((props, ref) => {
    mockWebViewProps = props;
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: mockInjectJavaScript,
    }));
    return <div data-testid="webview" />;
  });
  MockWebView.displayName = 'MockWebView';
  return { __esModule: true, default: MockWebView };
});

test('Catalyst bypasses Skia and updates the ready WebView without reloading its document', () => {
  const onHover = jest.fn();
  const { rerender } = render(
    <LightweightChart data={[[100, 1]]} height={200} onHover={onHover} />,
  );
  expect(mockLoadSkiaModule).not.toHaveBeenCalled();
  const initialSource = mockWebViewProps.source;
  rerender(
    <LightweightChart data={[[200, 0]]} height={200} onHover={onHover} />,
  );
  expect(mockWebViewProps.source).toBe(initialSource);
  expect(mockGenerateChartHTML).toHaveBeenCalledTimes(1);
  expect(mockInjectJavaScript).not.toHaveBeenCalled();
  act(() => {
    mockWebViewProps.onMessage?.({
      nativeEvent: { data: '{"type":"ready"}' },
    } as WebViewMessageEvent);
  });
  expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
    expect.stringContaining('"data":[[200,0]]'),
  );
  act(() => {
    mockWebViewProps.onMessage?.({
      nativeEvent: {
        data: '{"type":"hover","time":"200","price":"0","secondaryPrice":"0","x":0,"y":0}',
      },
    } as WebViewMessageEvent);
  });
  expect(onHover).toHaveBeenLastCalledWith({
    time: 200,
    price: 0,
    secondaryPrice: 0,
    x: 0,
    y: 0,
  });
});

test('the shared entry loads the original chart without evaluating native implementations', () => {
  jest.isolateModules(() => {
    const originalChart = () => null;
    jest.doMock('./LightweightChart', () => ({
      LightweightChart: originalChart,
    }));
    const {
      LightweightChart: SharedChart,
    }: typeof import('./index') = require('./index');
    expect(SharedChart).toBe(originalChart);
  });
});

test('falls back to the WebView when the Skia module throws during initialization', () => {
  mockIsCatalyst = false;
  mockSkiaModuleFails = true;

  render(<LightweightChart data={[[100, 1]]} height={200} />, {
    onCaughtError: jest.fn(),
  });

  expect(mockLoadSkiaModule).toHaveBeenCalled();
  expect(screen.getByTestId('webview')).toBeTruthy();
});

test('starts in Skia and keeps the current series in the WebView after a mapper fails', () => {
  mockIsCatalyst = false;
  mockSkiaModuleFails = false;
  const mockData: ILightweightChartProps['data'] = [
    [100, 1],
    [200, 2],
  ];
  render(<LightweightChart data={mockData} height={200} />);
  expect(screen.getByTestId('skia-chart')).toBeTruthy();

  act(() => mockOnSkiaError?.());

  expect(screen.queryByTestId('skia-chart')).toBeNull();
  expect(screen.getByTestId('webview')).toBeTruthy();
  expect(mockGenerateChartHTML).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: mockData,
    }),
  );
});
