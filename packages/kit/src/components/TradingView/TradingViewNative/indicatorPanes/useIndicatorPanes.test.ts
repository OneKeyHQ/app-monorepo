/** @jest-environment jsdom */
// cspell:ignore macd

import { act, renderHook, waitFor } from '@testing-library/react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { createTradingViewNativeSubIndicatorRenderSnapshots } from '../utils/subIndicatorRender/pipeline';

import { parseIndicatorPanePreferences } from './model';
import { useIndicatorPanes } from './useIndicatorPanes';

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
  configs: [
    { id: 'volume', indicator: 'VOL' },
    { id: 'rsi', indicator: 'RSI' },
    { id: 'macd', indicator: 'MACD' },
  ],
  points: [],
}).map(({ pane }) => pane);
const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  jest
    .mocked(appStorage.getItem)
    .mockReset()
    .mockImplementation(async (key) => stored.get(key) ?? null);
  jest
    .mocked(appStorage.setItem)
    .mockReset()
    .mockImplementation(async (key, value) => {
      stored.set(key, value);
    });
});

it('persists resize only on release and restores order/heights independently for each chart panel', async () => {
  const first = renderHook(() => useIndicatorPanes(panes, 'first'));
  const second = renderHook(() => useIndicatorPanes(panes, 'second'));
  await waitFor(() =>
    expect(first.result.current.ready && second.result.current.ready).toBe(
      true,
    ),
  );
  act(() => first.result.current.resize({ rsi: 140 }, false));
  expect(stored.size).toBe(0);
  act(() => first.result.current.resize({ rsi: 150 }, true));
  act(() => first.result.current.move('macd', 'volume'));
  await waitFor(() => expect(stored.size).toBe(1));
  expect(second.result.current.panes.map((pane) => pane.instanceId)).toEqual([
    'volume',
    'rsi',
    'macd',
  ]);
  expect(
    second.result.current.panes.every(
      (pane) => pane.preferredHeight === undefined,
    ),
  ).toBe(true);
  first.unmount();
  const restored = renderHook(() => useIndicatorPanes(panes, 'first'));
  await waitFor(() => expect(restored.result.current.ready).toBe(true));
  expect(restored.result.current.panes.map((pane) => pane.instanceId)).toEqual([
    'macd',
    'volume',
    'rsi',
  ]);
  expect(restored.result.current.panes[2].preferredHeight).toBe(150);
});

it('retains preferences when an indicator is hidden and enabled again', async () => {
  const hook = renderHook((input) => useIndicatorPanes(input, 'chart'), {
    initialProps: panes,
  });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  act(() => hook.result.current.resize({ rsi: 120 }, true));
  act(() => hook.result.current.move('rsi', 'volume'));
  hook.rerender(panes.filter((pane) => pane.instanceId !== 'rsi'));
  hook.rerender(panes);
  expect(hook.result.current.panes[0].instanceId).toBe('rsi');
  expect(hook.result.current.panes[0].preferredHeight).toBe(120);
});

it('ignores malformed and non-finite saved pane sizes', () => {
  expect(parseIndicatorPanePreferences('{bad')).toEqual({
    order: [],
    heights: {},
  });
  expect(
    parseIndicatorPanePreferences(
      JSON.stringify({
        order: ['rsi', 'rsi', 3],
        heights: { rsi: 110, macd: '200', volume: -10 },
      }),
    ),
  ).toEqual({ order: ['rsi'], heights: { rsi: 110 } });
});
