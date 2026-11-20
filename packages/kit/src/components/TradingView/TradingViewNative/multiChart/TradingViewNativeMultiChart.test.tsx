/**
 * @jest-environment jsdom
 */

import { useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';

import { createTradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';
import type {
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeSourceKey } from '../data/getTradingViewNativeSource';

import { TradingViewNativeMultiChart } from './TradingViewNativeMultiChart';
import {
  TRADING_VIEW_NATIVE_MULTI_CHART_KEEP_SELECTION_PROPS,
  TradingViewNativeMultiChartControlsContext,
} from './TradingViewNativeMultiChartPanelContext';

import type {
  ITradingViewNativeMultiChartPanel,
  ITradingViewNativeMultiChartProps,
} from './TradingViewNativeMultiChart.types';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    testID,
    'data-selected': selected,
  }: {
    children?: ReactNode;
    testID?: string;
    'data-selected'?: string;
  }) => (
    <div data-testid={testID} data-selected={selected}>
      {children}
    </div>
  ),
}));

jest.mock('./TradingViewNativeMultiChartDivider', () => ({
  TradingViewNativeMultiChartDivider: () => null,
}));

jest.mock('./TradingViewNativeMultiChartLayoutSelect', () => ({
  TradingViewNativeMultiChartLayoutSelect: ({
    onChange,
    onSyncChange,
    sync,
  }: {
    onChange: (preset: '2h' | '4') => void;
    onSyncChange: (option: 'symbol', isSynced: boolean) => void;
    sync: { symbol: boolean };
  }) => (
    <span data-testid="layout-select">
      <button
        type="button"
        aria-label="symbol sync"
        data-testid="sync-symbol"
        onClick={() => onSyncChange('symbol', !sync.symbol)}
      />
      {(['2h', '4'] as const).map((preset) => (
        <button
          key={preset}
          type="button"
          aria-label={preset}
          data-testid={`preset-${preset}`}
          onClick={() => onChange(preset)}
        />
      ))}
    </span>
  ),
}));

const coin = (name: string): ITradingViewNativeSource => ({
  kind: 'hyperliquid',
  coin: name,
  environment: 'mainnet',
});
const indicatorSettings = createTradingViewNativeIndicatorSettings();
const mockChartMount = jest.fn<void, [string]>();
const mockChartUnmount = jest.fn<void, [string]>();

function Chart({ panel }: { panel: ITradingViewNativeMultiChartPanel }) {
  const label = `${panel.id}:${getTradingViewNativeSourceKey(panel.source)}`;
  useEffect(() => {
    mockChartMount(label);
    return () => mockChartUnmount(label);
  }, [label]);
  // Stands in for the chart's controls row, as `TradingViewNative` places it.
  const controlsSlot = useContext(TradingViewNativeMultiChartControlsContext);
  const controls = (
    <span data-testid={`controls-${panel.id}`}>{panel.layoutControl}</span>
  );
  return (
    <>
      {controlsSlot ? controlsSlot.renderControls(controls) : controls}
      {/* The token picker: its trigger sits in the panel, its list elsewhere
          on the page. */}
      <span
        data-testid={`picker-${panel.id}`}
        {...TRADING_VIEW_NATIVE_MULTI_CHART_KEEP_SELECTION_PROPS}
      />
      {createPortal(
        <button
          type="button"
          aria-label="pick DOGE"
          data-testid={`pick-${panel.id}`}
          onClick={() => panel.setSource(coin('DOGE'))}
        />,
        document.body,
      )}
      <span
        data-testid={`chart-${panel.id}`}
        data-coin={panel.source.kind === 'hyperliquid' ? panel.source.coin : ''}
      />
      {/* What the keyboard can focus in a panel: the chart itself and its own
          controls, such as a drawing tool's style list. */}
      <canvas
        aria-label="Price chart"
        data-testid={`canvas-${panel.id}`}
        tabIndex={0}
      />
      <select aria-label="Line style" data-testid={`style-${panel.id}`}>
        <option>solid</option>
      </select>
      <button
        type="button"
        aria-label="Trend line"
        data-testid={`tool-${panel.id}`}
      />
    </>
  );
}

const renderPanel = (panel: ITradingViewNativeMultiChartPanel) => (
  <Chart key={getTradingViewNativeSourceKey(panel.source)} panel={panel} />
);

interface IHarness {
  layout: ITradingViewNativeMultiChartLayout;
  setActiveSource: (source: ITradingViewNativeSource) => void;
  // Lets the next layout write, or all of them, come back from bg.
  flushLayout: (count?: number) => void;
  unmount: () => void;
}

function renderGrid({
  layout: initialLayout = {
    preset: '2h',
    panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
  },
  onSelectPanel,
  deferLayoutWrites = false,
  activeSource: initialActiveSource = coin('BTC'),
}: {
  activeSource?: ITradingViewNativeSource;
  layout?: ITradingViewNativeMultiChartLayout;
  onSelectPanel: (
    source: ITradingViewNativeSource,
    harness: IHarness,
  ) => Promise<boolean>;
  deferLayoutWrites?: boolean;
}) {
  const harness: IHarness = {
    layout: initialLayout,
    setActiveSource: () => {},
    flushLayout: () => {},
    unmount: () => {},
  };
  // As on a split runtime: a write is evaluated at once against the snapshot
  // bg sent last, forwarded as a complete layout and applied when it returns.
  const sentLayouts: ITradingViewNativeMultiChartLayout[] = [];
  const onLayoutChange: ITradingViewNativeMultiChartProps['onLayoutChange'] = (
    update,
  ) => {
    const next = update(harness.layout);
    if (next === harness.layout) return;
    if (deferLayoutWrites) {
      sentLayouts.push(next);
    } else {
      harness.layout = next;
      harness.flushLayout();
    }
  };
  function Host() {
    const [layout, setLayout] = useState(initialLayout);
    const [activeSource, setActiveSource] = useState(initialActiveSource);
    harness.layout = layout;
    harness.setActiveSource = setActiveSource;
    harness.flushLayout = (count = sentLayouts.length) => {
      const next = sentLayouts.splice(0, count).at(-1) ?? harness.layout;
      harness.layout = next;
      setLayout(next);
    };
    return (
      <TradingViewNativeMultiChart
        layout={layout}
        onLayoutChange={onLayoutChange}
        activeSource={activeSource}
        onSelectPanel={(source) => onSelectPanel(source, harness)}
        defaultIndicatorSettings={indicatorSettings}
        getDefaultPanelSource={() => coin('SOL')}
        renderPanel={renderPanel}
      />
    );
  }
  harness.unmount = render(<Host />).unmount;
  return harness;
}

function getPanel(id: string) {
  return screen.getByTestId(`trading-view-multi-chart-panel-${id}`);
}

function expectScreen(expected: Record<string, string>, selected: string) {
  for (const [id, name] of Object.entries(expected)) {
    expect(screen.getByTestId(`chart-${id}`).dataset.coin).toBe(name);
    expect(getPanel(id).dataset.selected).toBe(
      id === selected ? 'true' : undefined,
    );
  }
}

function press(id: string, button = 0) {
  fireEvent.pointerDown(screen.getByTestId(`chart-${id}`), { button });
}

const originalPointerEvent = globalThis.PointerEvent;

// jsdom has no PointerEvent, and the grid reads the pressed button.
beforeAll(() => {
  globalThis.PointerEvent =
    MouseEvent as unknown as typeof globalThis.PointerEvent;
});

afterAll(() => {
  globalThis.PointerEvent = originalPointerEvent;
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('selects a pressed panel without moving or remounting any chart', async () => {
  const onSelectPanel = jest.fn(
    async (source: ITradingViewNativeSource, harness: IHarness) => {
      harness.setActiveSource(source);
      return true;
    },
  );
  const harness = renderGrid({ onSelectPanel });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');

  await act(async () => press('panel-2'));

  expect(onSelectPanel).toHaveBeenCalledWith(coin('ETH'), harness);
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-2',
    panels: { main: { source: coin('BTC') } },
  });
  expect(mockChartUnmount).not.toHaveBeenCalled();

  // The first panel is selected again; panel-2 keeps the traded ETH.
  await act(async () => press('main'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('keeps the selected token on screen while the host is switching', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    onSelectPanel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });

  act(() => press('panel-2'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');

  await act(async () => {
    harness.setActiveSource(coin('ETH'));
    finish(true);
  });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('goes back to the previous panel when the host keeps its token', async () => {
  const harness = renderGrid({ onSelectPanel: async () => false });
  const saved = harness.layout;

  await act(async () => press('panel-2'));

  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  // A selection the host has not followed is never saved.
  expect(harness.layout).toBe(saved);
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('saves a selection only once the host has followed', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    onSelectPanel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const saved = harness.layout;

  act(() => press('panel-2'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');
  expect(harness.layout).toBe(saved);

  // The page drops the grid, e.g. for another chart mode, and the switch
  // fails afterwards: the layout still has the first panel selected.
  harness.unmount();
  await act(async () => finish(false));
  expect(harness.layout).toBe(saved);
});

it('saves a selection the host follows after the grid is gone', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    onSelectPanel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });

  act(() => press('panel-2'));
  harness.unmount();
  await act(async () => finish(true));

  // Otherwise the first panel would come back showing ETH as well.
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-2',
    panels: { main: { source: coin('BTC') } },
  });
});

it('ignores a rejection that lands after a newer selection', async () => {
  const finishes: ((switched: boolean) => void)[] = [];
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: () =>
      new Promise((resolve) => {
        finishes.push(resolve);
      }),
  });

  act(() => press('panel-2'));
  act(() => press('panel-3'));
  await act(async () => finishes[0](false));

  // panel-2 keeps the ETH it showed while selected.
  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'panel-3',
  );

  await act(async () => {
    harness.setActiveSource(coin('SOL'));
    finishes[1](true);
  });
  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'panel-3',
  );
  // The first panel was selected until now, across both presses.
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-3',
    panels: { main: { source: coin('BTC') } },
  });
});

it('returns to the last saved panel when two switches in a row fail', async () => {
  const finishes: ((switched: boolean) => void)[] = [];
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: () =>
      new Promise((resolve) => {
        finishes.push(resolve);
      }),
  });
  const saved = harness.layout;

  // The second press replaces a selection the host never followed.
  act(() => press('panel-2'));
  act(() => press('panel-3'));
  await act(async () => {
    finishes[0](false);
    finishes[1](false);
  });

  // Not panel-2, which was never the host's panel.
  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'main',
  );
  expect(harness.layout).toBe(saved);
});

it('drops a switch still on its way when the host token is selected again', async () => {
  const finishes: ((switched: boolean) => void)[] = [];
  const onSelectPanel = jest.fn(
    (_source: ITradingViewNativeSource, _harness: IHarness) =>
      new Promise<boolean>((resolve) => {
        finishes.push(resolve);
      }),
  );
  const harness = renderGrid({ onSelectPanel });

  // The host is still loading what it needs to switch to ETH.
  act(() => press('panel-2'));
  act(() => press('main'));

  // It shows BTC already, and is asked for it so that it drops the ETH switch.
  expect(onSelectPanel).toHaveBeenCalledTimes(2);
  expect(onSelectPanel).toHaveBeenLastCalledWith(coin('BTC'), harness);
  await act(async () => {
    finishes[0](false);
    finishes[1](true);
  });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  expect(harness.layout.activePanelId ?? 'main').toBe('main');

  // With nothing on its way, the host is left alone.
  await act(async () => press('panel-2'));
  await act(async () => finishes[2](false));
  expect(onSelectPanel).toHaveBeenCalledTimes(3);
});

it('keeps a selection whose switch was superseded by another token', async () => {
  const harness = renderGrid({
    onSelectPanel: async (_source, { setActiveSource }) => {
      setActiveSource(coin('DOGE'));
      return false;
    },
  });

  await act(async () => press('panel-2'));

  // The selected panel follows the host wherever it went.
  expectScreen({ main: 'BTC', 'panel-2': 'DOGE' }, 'panel-2');
  expect(harness.layout.activePanelId).toBe('panel-2');
});

it('shows a selection before a split runtime has saved it', async () => {
  const harness = renderGrid({
    deferLayoutWrites: true,
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });

  await act(async () => press('panel-2'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');

  act(() => harness.flushLayout());
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');
  expect(harness.layout.activePanelId).toBe('panel-2');
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('keeps every token when a split runtime selects twice before saving', async () => {
  const charts = { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL' };
  const harness = renderGrid({
    deferLayoutWrites: true,
    layout: {
      preset: '3',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
      },
    },
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });

  // Both writes are evaluated against the layout from before the first one.
  await act(async () => press('panel-2'));
  await act(async () => press('panel-3'));
  expectScreen(charts, 'panel-3');

  // The first write returns alone, then the second.
  act(() => harness.flushLayout(1));
  expectScreen(charts, 'panel-3');
  act(() => harness.flushLayout());
  expectScreen(charts, 'panel-3');
  // The first panel keeps BTC, not the ETH that panel-2 was showing.
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-3',
    panels: {
      main: { source: coin('BTC') },
      'panel-2': { source: coin('ETH') },
    },
  });
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('leaves the selection alone for the selected panel and other buttons', () => {
  const onSelectPanel = jest.fn(async () => true);
  renderGrid({ onSelectPanel });

  press('main');
  press('panel-2', 2);

  expect(onSelectPanel).not.toHaveBeenCalled();
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
});

it('selects a panel from the keyboard', async () => {
  const onSelectPanel = jest.fn(
    async (source: ITradingViewNativeSource, harness: IHarness) => {
      harness.setActiveSource(source);
      return true;
    },
  );
  renderGrid({ onSelectPanel });
  const chart = screen.getByTestId('canvas-panel-2');

  // Other keys and shortcuts leave the selection alone, and so do the keys of
  // the panel's own controls: a picker, a style list, a tool button.
  fireEvent.keyDown(chart, { key: 'Tab' });
  fireEvent.keyDown(chart, { key: 'Enter', metaKey: true });
  for (const control of ['picker', 'pick', 'style', 'tool']) {
    for (const key of ['Enter', ' ']) {
      fireEvent.keyDown(screen.getByTestId(`${control}-panel-2`), { key });
    }
  }
  expect(onSelectPanel).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.keyDown(chart, { key: 'Enter' });
  });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');
  // The controls row follows, as with a press.
  expect(
    screen
      .getByTestId('trading-view-multi-chart-controls')
      .contains(screen.getByTestId('controls-panel-2')),
  ).toBe(true);

  // Space selects as well, and does not scroll the page.
  let scrolls = true;
  await act(async () => {
    scrolls = fireEvent.keyDown(screen.getByTestId('canvas-main'), {
      key: ' ',
    });
  });
  expect(scrolls).toBe(false);
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
});

it('changes only the token of a panel whose picker is used', () => {
  const onSelectPanel = jest.fn(async () => true);
  const harness = renderGrid({ onSelectPanel });

  // Opening the picker and pressing a token in its list are not presses on
  // the chart, so the trade stays on BTC.
  fireEvent.pointerDown(screen.getByTestId('picker-panel-2'), { button: 0 });
  fireEvent.pointerDown(screen.getByTestId('pick-panel-2'), { button: 0 });
  act(() => {
    fireEvent.click(screen.getByTestId('pick-panel-2'));
  });

  expect(onSelectPanel).not.toHaveBeenCalled();
  expectScreen({ main: 'BTC', 'panel-2': 'DOGE' }, 'main');
  expect(harness.layout.panels['panel-2']?.source).toEqual(coin('DOGE'));
  expect(harness.layout.activePanelId).toBeUndefined();
});

it('keeps a token picked for the previous panel while the host is switching', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    onSelectPanel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });

  act(() => press('panel-2'));
  // The first panel is not selected any more, so its picker changes its token.
  act(() => {
    fireEvent.click(screen.getByTestId('pick-main'));
  });
  expectScreen({ main: 'DOGE', 'panel-2': 'ETH' }, 'panel-2');

  await act(async () => {
    harness.setActiveSource(coin('ETH'));
    finish(true);
  });
  expectScreen({ main: 'DOGE', 'panel-2': 'ETH' }, 'panel-2');
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-2',
    panels: { main: { source: coin('DOGE') } },
  });
});

it('keeps a token picked for the previous panel when another panel is pressed mid-switch', async () => {
  const finishes: ((switched: boolean) => void)[] = [];
  const harness = renderGrid({
    layout: {
      preset: '3',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
      },
    },
    onSelectPanel: () =>
      new Promise((resolve) => {
        finishes.push(resolve);
      }),
  });
  const charts = { main: 'DOGE', 'panel-2': 'ETH', 'panel-3': 'SOL' };

  // The host is still switching to ETH when the first panel gets DOGE from
  // its picker and a third chart is pressed.
  act(() => press('panel-2'));
  act(() => {
    fireEvent.click(screen.getByTestId('pick-main'));
  });
  act(() => press('panel-3'));
  // Not the BTC the host was still trading.
  expectScreen(charts, 'panel-3');

  await act(async () => {
    finishes[0](false);
    harness.setActiveSource(coin('SOL'));
    finishes[1](true);
  });
  expectScreen(charts, 'panel-3');
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-3',
    panels: { main: { source: coin('DOGE') } },
  });
});

it('follows the host in the selected panel only', () => {
  const harness = renderGrid({
    layout: {
      preset: '2h',
      activePanelId: 'panel-2',
      panels: {
        main: { source: coin('SOL') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
      },
    },
    onSelectPanel: async () => true,
  });
  expectScreen({ main: 'SOL', 'panel-2': 'BTC' }, 'panel-2');

  act(() => harness.setActiveSource(coin('DOGE')));

  expectScreen({ main: 'SOL', 'panel-2': 'DOGE' }, 'panel-2');
});

it('marks no selection while a single chart is on screen', () => {
  renderGrid({
    layout: { preset: '1', activePanelId: 'panel-2', panels: {} },
    onSelectPanel: async () => true,
  });

  expect(screen.getByTestId('chart-main').dataset.coin).toBe('BTC');
  expect(getPanel('main').dataset.selected).toBeUndefined();
});

it('shows the selected panel controls once, above the grid', async () => {
  renderGrid({
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  const bar = screen.getByTestId('trading-view-multi-chart-controls');
  const expectControls = (id: string) => {
    expect(
      screen.getAllByTestId(/^controls-/).map((node) => node.dataset.testid),
    ).toEqual([`controls-${id}`]);
    expect(bar.contains(screen.getByTestId(`controls-${id}`))).toBe(true);
    // The layout picker sits in those controls.
    expect(screen.getAllByTestId('layout-select')).toHaveLength(1);
    expect(
      screen
        .getByTestId(`controls-${id}`)
        .contains(screen.getByTestId('layout-select')),
    ).toBe(true);
  };
  expectControls('main');

  await act(async () => press('panel-2'));

  expectControls('panel-2');
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('only moves the selection while every panel shows the host token', async () => {
  const onSelectPanel = jest.fn(async () => true);
  const layout: ITradingViewNativeMultiChartLayout = {
    preset: '2h',
    sync: { symbol: true },
    panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
  };
  const harness = renderGrid({ layout, onSelectPanel });
  expectScreen({ main: 'BTC', 'panel-2': 'BTC' }, 'main');

  await act(async () => press('panel-2'));

  expect(onSelectPanel).not.toHaveBeenCalled();
  expectScreen({ main: 'BTC', 'panel-2': 'BTC' }, 'panel-2');
  // For when the option is turned off, the first panel keeps the token it
  // showed and panel-2 its own.
  expect(harness.layout.panels).toEqual({
    ...layout.panels,
    main: { source: coin('BTC') },
  });

  await act(async () => press('main'));
  expect(onSelectPanel).not.toHaveBeenCalled();
  expect(harness.layout.panels['panel-2']).toEqual(layout.panels['panel-2']);
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('returns a panel to the token it showed before the tokens were synced', async () => {
  const harness = renderGrid({
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  const toggleSymbolSync = () => {
    act(() => {
      fireEvent.click(screen.getByTestId('sync-symbol'));
    });
  };

  // panel-2 is selected and its token changed through the host: what the
  // layout stores for it is still the ETH from before it was selected.
  await act(async () => press('panel-2'));
  act(() => harness.setActiveSource(coin('DOGE')));
  expectScreen({ main: 'BTC', 'panel-2': 'DOGE' }, 'panel-2');

  toggleSymbolSync();
  await act(async () => press('main'));
  expectScreen({ main: 'DOGE', 'panel-2': 'DOGE' }, 'main');

  toggleSymbolSync();
  expectScreen({ main: 'DOGE', 'panel-2': 'DOGE' }, 'main');
  expect(harness.layout.panels['panel-2']?.source).toEqual(coin('DOGE'));
});

it('keeps the token of the first panel while it stands in for a hidden selection', async () => {
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  const setPreset = (preset: '2h' | '4') => {
    act(() => {
      fireEvent.click(screen.getByTestId(`preset-${preset}`));
    });
  };
  const four = {
    main: 'BTC',
    'panel-2': 'ETH',
    'panel-3': 'SOL',
    'panel-4': 'HYPE',
  };

  await act(async () => press('panel-4'));
  expectScreen(four, 'panel-4');

  // Two charts: the first panel shows the traded HYPE for the hidden panel.
  setPreset('2h');
  expectScreen({ main: 'HYPE', 'panel-2': 'ETH' }, 'main');

  // Selecting the other chart hands HYPE back to the hidden panel, and the
  // first panel returns to its own token.
  await act(async () => press('panel-2'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');

  setPreset('4');
  expectScreen(four, 'panel-2');
  expect(harness.layout.panels.main?.source).toEqual(coin('BTC'));
});

it('saves the hidden selected panel token when the tokens are synced', async () => {
  const harness = renderGrid({
    layout: {
      preset: '2h',
      activePanelId: 'panel-4',
      panels: {
        main: { source: coin('BTC') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: async () => true,
  });
  // The first panel shows the host's BTC here for the hidden panel-4.
  act(() => harness.setActiveSource(coin('DOGE')));
  expectScreen({ main: 'DOGE', 'panel-2': 'ETH' }, 'main');

  act(() => {
    fireEvent.click(screen.getByTestId('sync-symbol'));
  });

  expect(harness.layout.panels).toMatchObject({
    main: { source: coin('BTC') },
    'panel-4': { source: coin('DOGE') },
  });
});

it('saves a selection whose panel the preset hides before the host follows', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const setPreset = (preset: '2h' | '4') => {
    act(() => {
      fireEvent.click(screen.getByTestId(`preset-${preset}`));
    });
  };

  // The host is still switching to HYPE when the layout shrinks to two charts.
  act(() => press('panel-4'));
  setPreset('2h');
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  await act(async () => {
    harness.setActiveSource(coin('HYPE'));
    finish(true);
  });
  // The first panel shows HYPE for the hidden panel and keeps its BTC.
  expectScreen({ main: 'HYPE', 'panel-2': 'ETH' }, 'main');
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-4',
    panels: { main: { source: coin('BTC') } },
  });

  setPreset('4');
  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'panel-4',
  );
});

it('keeps a selection still on its way to a split runtime when a panel gets a token', async () => {
  const onSelectPanel = async (
    source: ITradingViewNativeSource,
    { setActiveSource }: IHarness,
  ) => {
    setActiveSource(source);
    return true;
  };
  const harness = renderGrid({ deferLayoutWrites: true, onSelectPanel });

  // The host follows to ETH; the selection has not come back from bg when the
  // first panel, not selected any more, gets another token.
  await act(async () => press('panel-2'));
  act(() => {
    fireEvent.click(screen.getByTestId('pick-main'));
  });
  expectScreen({ main: 'DOGE', 'panel-2': 'ETH' }, 'panel-2');

  act(() => harness.flushLayout());
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-2',
    panels: { main: { source: coin('DOGE') } },
  });

  // A grid mounted afresh, e.g. after another chart mode, shows the same.
  harness.unmount();
  renderGrid({
    layout: harness.layout,
    activeSource: coin('ETH'),
    onSelectPanel,
  });
  expectScreen({ main: 'DOGE', 'panel-2': 'ETH' }, 'panel-2');
});

it('selects the first panel for good while it stands in for a hidden one', async () => {
  const finishes: ((switched: boolean) => void)[] = [];
  let answersAtOnce = true;
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: (source, { setActiveSource }) => {
      if (answersAtOnce) {
        setActiveSource(source);
        return Promise.resolve(true);
      }
      return new Promise((resolve) => {
        finishes.push(resolve);
      });
    },
  });
  const setPreset = (preset: '2h' | '4') => {
    act(() => {
      fireEvent.click(screen.getByTestId(`preset-${preset}`));
    });
  };

  // The fourth panel is selected and hidden: the first one shows its HYPE.
  await act(async () => press('panel-4'));
  setPreset('2h');
  expectScreen({ main: 'HYPE', 'panel-2': 'ETH' }, 'main');

  // The host is still switching to ETH when the first panel, back on its own
  // BTC, is pressed.
  answersAtOnce = false;
  act(() => press('panel-2'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');
  act(() => press('main'));
  await act(async () => {
    finishes[0](false);
    harness.setActiveSource(coin('BTC'));
    finishes[1](true);
  });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  expect(harness.layout.activePanelId).toBe('main');

  // The fourth panel does not take the selection back, and keeps HYPE.
  setPreset('4');
  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'main',
  );
});

it('leaves a hidden panel its token when the host never followed to it', async () => {
  const finishes: ((switched: boolean) => void)[] = [];
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: () =>
      new Promise((resolve) => {
        finishes.push(resolve);
      }),
  });
  const click = (testId: string) => {
    act(() => {
      fireEvent.click(screen.getByTestId(testId));
    });
  };

  // The host is still on BTC, the first panel's, when the pressed panel is
  // hidden and another one is pressed.
  act(() => press('panel-4'));
  click('preset-2h');
  act(() => press('panel-2'));
  await act(async () => {
    finishes[0](false);
    harness.setActiveSource(coin('ETH'));
    finishes[1](true);
  });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');

  click('preset-4');
  // Not the BTC the first panel was showing.
  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'panel-2',
  );
});

it.each([
  ['before', true],
  ['after', false],
])(
  'leaves a hidden panel its token when the host goes elsewhere, answered %s the layout grows back',
  async (_order, growsFirst) => {
    const finishes: ((switched: boolean) => void)[] = [];
    const harness = renderGrid({
      layout: {
        preset: '4',
        panels: {
          'panel-2': { source: coin('ETH'), indicatorSettings },
          'panel-3': { source: coin('SOL'), indicatorSettings },
          'panel-4': { source: coin('HYPE'), indicatorSettings },
        },
      },
      onSelectPanel: () =>
        new Promise((resolve) => {
          finishes.push(resolve);
        }),
    });
    const setPreset = (preset: '2h' | '4') => {
      act(() => {
        fireEvent.click(screen.getByTestId(`preset-${preset}`));
      });
    };

    // The host is still switching to HYPE when the layout shrinks and the
    // first panel's picker, the host's one on screen, trades DOGE instead.
    act(() => press('panel-4'));
    setPreset('2h');
    act(() => harness.setActiveSource(coin('DOGE')));
    expectScreen({ main: 'DOGE', 'panel-2': 'ETH' }, 'main');

    // The host drops the HYPE switch.
    if (growsFirst) setPreset('4');
    await act(async () => finishes[0](false));
    if (!growsFirst) setPreset('4');

    // DOGE stays with the first panel, and the fourth keeps its HYPE.
    expectScreen(
      { main: 'DOGE', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
      'main',
    );
    expect(harness.layout.activePanelId).toBeUndefined();
  },
);

it('saves the host token with its own panel when the tokens are synced mid-switch', async () => {
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: () => new Promise(() => {}),
  });
  const click = (testId: string) => {
    act(() => {
      fireEvent.click(screen.getByTestId(testId));
    });
  };

  // BTC is still the first panel's while the host has not followed.
  act(() => press('panel-4'));
  click('preset-2h');
  click('sync-symbol');

  expect(harness.layout.panels).toMatchObject({
    main: { source: coin('BTC') },
    'panel-4': { source: coin('HYPE') },
  });
});
