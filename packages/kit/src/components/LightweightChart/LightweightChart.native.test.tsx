/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { LightweightChart } from './LightweightChart.native';

const mockInject = jest.fn();
let mockWebViewProps: {
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  onLoadStart: () => void;
};
const mockTheme = {
  textSubdued: { val: '#999999' },
  borderSubdued: { val: '#555555' },
};

jest.mock('@tamagui/core', () => ({ useTheme: () => mockTheme }));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children }: PropsWithChildren) => <>{children}</>,
    CollapsibleTabContext: React.createContext(undefined),
  };
});
jest.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  View: ({ children }: PropsWithChildren) => <>{children}</>,
}));
jest.mock('react-native-reanimated', () => ({
  runOnJS: (callback: () => void) => callback,
  useAnimatedReaction: () => {},
}));
jest.mock('react-native-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return React.forwardRef((props: typeof mockWebViewProps, ref) => {
    mockWebViewProps = props;
    React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }));
    return null;
  });
});
jest.mock('./utils/htmlTemplate', () => ({
  generateChartHTML: () => '<head></head>',
}));
jest.mock('./utils/formatChartPriceSource', () => ({
  __esModule: true,
  default: 'function(price) { return String(price); }',
}));

it('sends only overlay data while scrubbing and resends full data after reload', () => {
  const data: IMarketTokenChart = [
    [1, 10],
    [2, 20],
    [3, 30],
  ];
  const { rerender } = render(
    <LightweightChart data={data} secondaryLineData={data} height={240} />,
  );
  const ready = () =>
    mockWebViewProps.onMessage({
      nativeEvent: { data: JSON.stringify({ type: 'ready' }) },
    });
  act(ready);
  expect(mockInject).toHaveBeenLastCalledWith(
    expect.stringContaining('window.applyChartConfig(newConfig)'),
  );

  rerender(
    <LightweightChart
      data={data}
      secondaryLineData={data.slice(0, 2)}
      height={240}
    />,
  );
  const scrubScript = String(mockInject.mock.calls.at(-1)?.[0]);
  expect(scrubScript).toContain('window.applyChartSecondaryData(newConfig)');
  expect(scrubScript).not.toContain('"data":');
  expect(scrubScript).not.toContain('"theme":');

  act(() => mockWebViewProps.onLoadStart());
  act(ready);
  expect(mockInject).toHaveBeenLastCalledWith(
    expect.stringContaining('window.applyChartConfig(newConfig)'),
  );
  rerender(
    <LightweightChart
      data={data.slice(0, 2)}
      secondaryLineData={data.slice(0, 2)}
      height={240}
    />,
  );
  expect(mockInject).toHaveBeenLastCalledWith(
    expect.stringContaining('window.applyChartConfig(newConfig)'),
  );
});
