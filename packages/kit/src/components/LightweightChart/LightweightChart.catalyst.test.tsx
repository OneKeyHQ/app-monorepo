/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { ILightweightChartProps } from './types';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

const mockInjectJavaScript = jest.fn();
let mockWebViewProps: WebViewProps = {};
const mockGenerateChartHTML = jest.fn<string, [unknown]>(
  () => '<html>chart</html>',
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSMacCatalyst: true },
}));
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
  jest.doMock('./LightweightChart.native', () => {
    throw new OneKeyLocalError('Catalyst must not initialize the Skia chart');
  });
  const {
    LightweightChart,
  }: typeof import('./index.native') = require('./index.native');
  const onHover = jest.fn();
  const { rerender } = render(
    <LightweightChart data={[[100, 1]]} height={200} onHover={onHover} />,
  );
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
    jest.doMock('./LightweightChart.native', () => {
      throw new OneKeyLocalError('The shared entry must not load Skia');
    });
    jest.doMock('./LightweightChart.catalyst', () => {
      throw new OneKeyLocalError('The shared entry must not load Catalyst');
    });

    const { LightweightChart }: typeof import('./index') = require('./index');
    expect(LightweightChart).toBe(originalChart);
  });
});

test.each(['ios', 'android'])(
  'the native entry preserves the original Skia chart on ordinary %s',
  (platform) => {
    jest.resetModules();
    jest.isolateModules(() => {
      const originalChart = () => null;
      jest.doMock('@onekeyhq/shared/src/platformEnv', () => ({
        __esModule: true,
        default: {
          isNativeIOSMacCatalyst: false,
          isNativeIOS: platform === 'ios',
          isNativeAndroid: platform === 'android',
        },
      }));
      jest.doMock('./LightweightChart.native', () => ({
        LightweightChart: originalChart,
      }));
      jest.doMock('./LightweightChart.catalyst', () => {
        throw new OneKeyLocalError(
          'Ordinary native apps must not load Catalyst',
        );
      });

      const {
        LightweightChart,
      }: typeof import('./index.native') = require('./index.native');
      expect(LightweightChart).toBe(originalChart);
    });
  },
);
