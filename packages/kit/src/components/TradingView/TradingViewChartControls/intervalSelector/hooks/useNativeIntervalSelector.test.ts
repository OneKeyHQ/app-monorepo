/** @jest-environment jsdom */

import { useLayoutEffect } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import { saveStoredPreferredIntervalValues } from '../NativeIntervalUtils';

import { useNativeIntervalSelector } from './useNativeIntervalSelector';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () =>
      JSON.stringify({ values: ['15', '240', '1D', '1W'] }),
    ),
    setItem: jest.fn(async () => undefined),
  },
}));

const intervals = [
  { label: '1m', value: '1' },
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
];

it('keeps customized shortcut intervals in the first frame after a chart remount', async () => {
  const frames: string[][] = [];
  const useSelector = () => {
    const selector = useNativeIntervalSelector({
      intervalConfig: { activeInterval: '15', intervals },
      visiblePreferredIntervalCount: 4,
    });
    useLayoutEffect(() => {
      frames.push(selector.preferredIntervalValues);
    });
    return selector;
  };
  const first = renderHook(useSelector);
  await waitFor(() =>
    expect(first.result.current.preferredIntervalValues).toEqual([
      '15',
      '240',
      '1D',
      '1W',
    ]),
  );
  first.unmount();
  frames.length = 0;

  const next = renderHook(useSelector);
  expect(frames[0]).toEqual(['15', '240', '1D', '1W']);
  next.unmount();

  await saveStoredPreferredIntervalValues(['1', '15', '1D', '1W']);
  frames.length = 0;
  renderHook(useSelector);
  expect(frames[0]).toEqual(['1', '15', '1D', '1W']);
});

it('keeps a mounted selector in sync with edits made from another chart', async () => {
  await act(async () => {
    await saveStoredPreferredIntervalValues(['15', '240', '1D', '1W']);
  });
  const renderSelector = (visiblePreferredIntervalCount: number) =>
    renderHook(() =>
      useNativeIntervalSelector({
        intervalConfig: { activeInterval: '15', intervals },
        visiblePreferredIntervalCount,
      }),
    );
  // The trade chart stays mounted while the chart page is pushed above it.
  const tradeChart = renderSelector(6);
  const chartPage = renderSelector(6);
  expect(tradeChart.result.current.preferredIntervalValues).toEqual([
    '15',
    '240',
    '1D',
    '1W',
  ]);

  act(() => {
    chartPage.result.current.handlePreferredValuesChange([
      '1',
      '15',
      '60',
      '240',
      '1D',
      '1W',
    ]);
  });
  expect(tradeChart.result.current.preferredIntervalValues).toEqual([
    '1',
    '15',
    '60',
    '240',
    '1D',
    '1W',
  ]);

  // A four-slot toolbar follows too, and only shows its visible prefix.
  const phoneChartPage = renderSelector(4);
  act(() => {
    tradeChart.result.current.handlePreferredValuesChange([
      '15',
      '60',
      '240',
      '1D',
      '1W',
    ]);
  });
  expect(chartPage.result.current.preferredIntervalValues).toEqual([
    '15',
    '60',
    '240',
    '1D',
    '1W',
  ]);
  expect(phoneChartPage.result.current.preferredIntervalValues).toEqual([
    '15',
    '60',
    '240',
    '1D',
  ]);
});
