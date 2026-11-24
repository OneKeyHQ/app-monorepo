/**
 * @jest-environment jsdom
 */

import { useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createTradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';
import type {
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeSourceKey } from '../data/getTradingViewNativeSource';

import { TradingViewNativeMultiChart } from './TradingViewNativeMultiChart';
import { TradingViewNativeMultiChartControlsContext } from './TradingViewNativeMultiChartPanelContext';
import { useMultiChartIntervalSync } from './useMultiChartIntervalSync';

import type {
  ITradingViewNativeMultiChartPanel,
  ITradingViewNativeMultiChartProps,
} from './TradingViewNativeMultiChart.types';
import type { ITradingViewNativeMultiChartDrawingTools } from './TradingViewNativeMultiChartPanelContext';

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
    onSyncChange: (option: 'symbol' | 'interval', isSynced: boolean) => void;
    sync: { symbol: boolean; interval: boolean };
  }) => (
    <span data-testid="layout-select">
      <button
        type="button"
        aria-label="symbol sync"
        data-testid="sync-symbol"
        onClick={() => onSyncChange('symbol', !sync.symbol)}
      />
      <button
        type="button"
        aria-label="interval sync"
        data-testid="sync-interval"
        onClick={() => onSyncChange('interval', !sync.interval)}
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
// What each panel's chart got from the grid last, by panel id.
const mockPanels = new Map<string, ITradingViewNativeMultiChartPanel>();
const mockDrawingTools = new Map<
  string,
  ITradingViewNativeMultiChartDrawingTools
>();
// The interval each panel's chart is on. A chart stores it by panel, so one
// mounted anew, e.g. for another token, starts from it.
const mockIntervals = new Map<string, string>();
// Picks an interval in a panel's chart, as the user does in its controls.
const mockPickInterval = new Map<string, (interval: string) => void>();
// Moves a panel's chart to an interval by itself, as when it falls back to
// the one it showed because the data of a new one fails to load.
const mockFallBackInterval = new Map<string, (interval: string) => void>();

function Chart({ panel }: { panel: ITradingViewNativeMultiChartPanel }) {
  const label = `${panel.id}:${getTradingViewNativeSourceKey(panel.source)}`;
  useEffect(() => {
    mockChartMount(label);
    return () => mockChartUnmount(label);
  }, [label]);
  const [interval, setChartInterval] = useState(
    () => mockIntervals.get(panel.id) ?? '60',
  );
  const applyInterval = (next: string) => {
    mockIntervals.set(panel.id, next);
    setChartInterval(next);
  };
  const publishInterval = useMultiChartIntervalSync({
    activeInterval: interval,
    onSyncedIntervalChange: applyInterval,
  });
  mockPickInterval.set(panel.id, (next) => {
    applyInterval(next);
    publishInterval(next);
  });
  mockFallBackInterval.set(panel.id, applyInterval);
  // Stands in for the chart's controls row, as `TradingViewNative` places it.
  const controlsSlot = useContext(TradingViewNativeMultiChartControlsContext);
  mockPanels.set(panel.id, panel);
  if (controlsSlot) mockDrawingTools.set(panel.id, controlsSlot.drawingTools);
  const controls = (
    <span data-testid={`controls-${panel.id}`}>{panel.layoutControl}</span>
  );
  const toolsContainer = controlsSlot?.drawingTools.container;
  return (
    <>
      {controlsSlot ? controlsSlot.renderControls(controls) : controls}
      {/* Stands in for the drawing tools, as the web chart places them. */}
      {toolsContainer
        ? createPortal(
            <span data-testid={`tools-${panel.id}`} />,
            toolsContainer,
          )
        : null}
      {/* A menu the chart opened, rendered elsewhere on the page. */}
      {createPortal(
        <button
          type="button"
          aria-label="Chart menu item"
          data-testid={`menu-${panel.id}`}
        />,
        document.body,
      )}
      <span
        data-testid={`chart-${panel.id}`}
        data-coin={panel.source.kind === 'hyperliquid' ? panel.source.coin : ''}
        data-interval={interval}
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
  // Another writer, e.g. another window, saves a layout.
  replaceLayout: (layout: ITradingViewNativeMultiChartLayout) => void;
  unmount: () => void;
  // Mounts a new grid over the same saved layout and host source.
  remount: () => void;
}

function renderGrid({
  layout: initialLayout = {
    preset: '2h',
    panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
  },
  onSelectPanel,
  deferLayoutWrites = false,
  activeSource: initialActiveSource = coin('BTC'),
  keepsSelectedPanel = false,
  layoutKey,
}: {
  activeSource?: ITradingViewNativeSource;
  // The host keeps the panel selected on its page, as one whose saved layout
  // other pages share.
  keepsSelectedPanel?: boolean;
  layout?: ITradingViewNativeMultiChartLayout;
  layoutKey?: string;
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
    replaceLayout: () => {},
    unmount: () => {},
    remount: () => {},
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
  // The saved layout, the host's source and its selected panel outlive a
  // mounted grid.
  let hostSource = initialActiveSource;
  let hostPanelId: string | undefined;
  let setHostLayout:
    | ((layout: ITradingViewNativeMultiChartLayout) => void)
    | undefined;
  let setHostSource: ((source: ITradingViewNativeSource) => void) | undefined;
  let setHostPanelId: ((panelId: string) => void) | undefined;
  const handleSelectedPanelIdChange = (panelId: string) => {
    hostPanelId = panelId;
    setHostPanelId?.(panelId);
  };
  harness.replaceLayout = (next) => {
    harness.layout = next;
    setHostLayout?.(next);
  };
  harness.flushLayout = (count = sentLayouts.length) => {
    const sent = sentLayouts.splice(0, count).at(-1);
    // As bg sends it back: the way there drops fields set to `undefined`.
    harness.replaceLayout(
      sent ? JSON.parse(JSON.stringify(sent)) : harness.layout,
    );
  };
  harness.setActiveSource = (source) => {
    hostSource = source;
    setHostSource?.(source);
  };
  function Host() {
    const [layout, setLayout] = useState(() => harness.layout);
    const [activeSource, setActiveSource] = useState(() => hostSource);
    const [selectedPanelId, setSelectedPanelId] = useState(() => hostPanelId);
    setHostLayout = setLayout;
    setHostSource = setActiveSource;
    setHostPanelId = setSelectedPanelId;
    return (
      <TradingViewNativeMultiChart
        layout={layout}
        layoutKey={layoutKey}
        onLayoutChange={onLayoutChange}
        activeSource={activeSource}
        {...(keepsSelectedPanel
          ? {
              selectedPanelId,
              onSelectedPanelIdChange: handleSelectedPanelIdChange,
            }
          : {})}
        onSelectPanel={(source) => onSelectPanel(source, harness)}
        defaultIndicatorSettings={indicatorSettings}
        getDefaultPanelSource={() => coin('SOL')}
        renderPanel={renderPanel}
      />
    );
  }
  harness.remount = () => {
    const { unmount } = render(<Host />);
    harness.unmount = () => {
      setHostLayout = undefined;
      setHostSource = undefined;
      setHostPanelId = undefined;
      unmount();
    };
  };
  harness.remount();
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
  mockPanels.clear();
  mockDrawingTools.clear();
  mockIntervals.clear();
  mockPickInterval.clear();
  mockFallBackInterval.clear();
});

// Sizes jsdom does not lay out.
function setWidth(element: Element | null | undefined, width: number) {
  if (!element) throw new OneKeyLocalError('Missing element');
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    value: width,
  });
}

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

it('returns the selection when a token shown early is dropped for the previous one', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    // As the trade instrument does: the token shows at once and the answer
    // comes once the switch has landed.
    onSelectPanel: (source, { setActiveSource }) => {
      setActiveSource(source);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const saved = harness.layout;

  await act(async () => press('panel-2'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');
  expect(harness.layout).toBe(saved);

  // BTC is picked elsewhere, e.g. in the favorites bar, which drops the ETH
  // switch.
  act(() => harness.setActiveSource(coin('BTC')));
  await act(async () => finish(false));

  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  expect(harness.layout).toBe(saved);
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
  // the panel's own controls: a style list, a tool button, a menu it opened.
  fireEvent.keyDown(chart, { key: 'Tab' });
  fireEvent.keyDown(chart, { key: 'Enter', metaKey: true });
  for (const control of ['menu', 'style', 'tool']) {
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

it('leaves the selection alone for a menu a panel opened elsewhere', () => {
  const onSelectPanel = jest.fn(async () => true);
  renderGrid({ onSelectPanel });

  // The menu reaches the panel through React only.
  fireEvent.pointerDown(screen.getByTestId('menu-panel-2'), { button: 0 });

  expect(onSelectPanel).not.toHaveBeenCalled();
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
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

it('shows the selected panel drawing tools once, at the left of the grid', async () => {
  renderGrid({
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  const column = screen.getByTestId('trading-view-multi-chart-drawing-tools');
  const expectTools = (id: string) => {
    expect(
      screen.getAllByTestId(/^tools-/).map((node) => node.dataset.testid),
    ).toEqual([`tools-${id}`]);
    expect(column.contains(screen.getByTestId(`tools-${id}`))).toBe(true);
  };
  // The column is beside the panels, not in one.
  expect(getPanel('main').contains(column)).toBe(false);
  expectTools('main');

  await act(async () => press('panel-2'));

  expectTools('panel-2');
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('keeps a layout change still on its way to a split runtime for a selection answered after the grid is gone', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    layoutKey: 'pending-preset',
    deferLayoutWrites: true,
    onSelectPanel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });

  // The preset grows while the host is switching, and the grid goes before
  // bg has sent the new preset back.
  act(() => press('panel-2'));
  act(() => {
    fireEvent.click(screen.getByTestId('preset-4'));
  });
  harness.unmount();

  // The switch lands before that, on the snapshot bg sent last.
  await act(async () => {
    harness.setActiveSource(coin('ETH'));
    finish(true);
  });
  act(() => harness.flushLayout());
  expect(harness.layout).toMatchObject({
    preset: '4',
    activePanelId: 'panel-2',
    panels: { main: { source: coin('BTC') } },
  });
});

it('keeps the token the host panel saved when the tokens are synced while a selection is on its way', async () => {
  const finishes: Array<(switched: boolean) => void> = [];
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        main: { source: coin('BTC') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('@107'), indicatorSettings },
      },
    },
    onSelectPanel: async (source, { setActiveSource }) => {
      if (source.kind === 'hyperliquid' && source.coin === '@107') {
        return new Promise<boolean>((resolve) => {
          finishes.push(resolve);
        });
      }
      setActiveSource(source);
      return true;
    },
  });

  // A spot chart is selected and its metadata takes a while. Meanwhile the
  // layout shrinks, the page trades DOGE and the tokens are synced: the first
  // panel, which shows the trade token in place of the hidden one, saves it.
  act(() => press('panel-4'));
  act(() => {
    fireEvent.click(screen.getByTestId('preset-2h'));
  });
  act(() => harness.setActiveSource(coin('DOGE')));
  act(() => {
    fireEvent.click(screen.getByTestId('sync-symbol'));
  });
  expect(harness.layout.panels.main?.source).toEqual(coin('DOGE'));

  // Selecting another chart keeps it, and so does the late answer.
  await act(async () => press('panel-2'));
  expect(harness.layout.panels.main?.source).toEqual(coin('DOGE'));
  await act(async () => finishes.forEach((finish) => finish(false)));
  expect(harness.layout.panels.main?.source).toEqual(coin('DOGE'));

  act(() => {
    fireEvent.click(screen.getByTestId('sync-symbol'));
  });
  expect(screen.getByTestId('chart-main').dataset.coin).toBe('DOGE');
});

it('saves no older token over the host panel when a selection on its way lands after the tokens are synced', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        main: { source: coin('BTC') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('@107'), indicatorSettings },
      },
    },
    onSelectPanel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });

  act(() => press('panel-4'));
  act(() => {
    fireEvent.click(screen.getByTestId('preset-2h'));
  });
  act(() => harness.setActiveSource(coin('DOGE')));
  act(() => {
    fireEvent.click(screen.getByTestId('sync-symbol'));
  });

  await act(async () => finish(true));
  expect(harness.layout.panels.main?.source).toEqual(coin('DOGE'));
});

it('selects a panel with a token picked in it, decided by that one switch', async () => {
  const answers: Array<(switched: boolean) => void> = [];
  const asked: string[] = [];
  const harness = renderGrid({
    layout: {
      preset: '2h',
      panels: {
        main: { source: coin('BTC') },
        'panel-2': { source: coin('@107'), indicatorSettings },
      },
    },
    onSelectPanel: (source) => {
      asked.push(source.kind === 'hyperliquid' ? source.coin : '');
      return new Promise((resolve) => {
        answers.push(resolve);
      });
    },
  });

  // Opening the spot chart's picker presses the chart, which asks for its
  // token; before its metadata is in, the trade token is picked in the list.
  act(() => press('panel-2'));
  act(() => mockPanels.get('panel-2')?.selectSource(coin('BTC')));

  // The panel takes it at once, and the host is asked to drop the spot switch.
  expectScreen({ main: 'BTC', 'panel-2': 'BTC' }, 'panel-2');
  expect(asked).toEqual(['@107', 'BTC']);
  await act(async () => {
    answers[0](false);
    answers[1](true);
  });

  expectScreen({ main: 'BTC', 'panel-2': 'BTC' }, 'panel-2');
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-2',
    panels: { main: { source: coin('BTC') } },
  });
});

it('keeps a token picked in a panel out of its saved layout when another selection lands instead', async () => {
  const answers: Array<(switched: boolean) => void> = [];
  const harness = renderGrid({
    layout: {
      preset: '3',
      activePanelId: 'panel-2',
      panels: {
        main: { source: coin('BTC') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
      },
    },
    activeSource: coin('ETH'),
    onSelectPanel: (source, { setActiveSource }) => {
      // The host shows a token at once, before it has switched to it.
      setActiveSource(source);
      return new Promise((resolve) => {
        answers.push(resolve);
      });
    },
  });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL' }, 'panel-2');

  // DOGE is picked in the selected ETH chart, and SOL's chart is selected
  // before the host got to DOGE.
  act(() => mockPanels.get('panel-2')?.selectSource(coin('DOGE')));
  await act(async () => press('panel-3'));
  // The chart left behind shows what it had, not a token it never got.
  expectScreen({ main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL' }, 'panel-3');

  // The host drops the switch to DOGE for the one to SOL, which lands.
  await act(async () => {
    answers[0](false);
    answers[1](true);
  });

  expectScreen({ main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL' }, 'panel-3');
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-3',
    panels: { 'panel-2': { source: coin('ETH') } },
  });
});

it('leaves a panel its own token when a token picked in it never lands and another panel is selected', async () => {
  const answers: Array<(switched: boolean) => void> = [];
  const harness = renderGrid({
    layout: {
      preset: '3',
      panels: {
        main: { source: coin('BTC') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
      },
    },
    onSelectPanel: (source, { setActiveSource }) => {
      setActiveSource(source);
      return new Promise((resolve) => {
        answers.push(resolve);
      });
    },
  });

  // DOGE is picked in the ETH chart, which the first chart was selected
  // before; then SOL's chart, before the host got to DOGE.
  act(() => mockPanels.get('panel-2')?.selectSource(coin('DOGE')));
  await act(async () => press('panel-3'));
  await act(async () => {
    answers[0](false);
    answers[1](true);
  });

  // The first chart keeps the token it traded, the second its own.
  expectScreen({ main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL' }, 'panel-3');
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-3',
    panels: {
      main: { source: coin('BTC') },
      'panel-2': { source: coin('ETH') },
    },
  });
});

it('waits for a switch on its way to the token picked in a panel instead of asking again', async () => {
  const answers: Array<(switched: boolean) => void> = [];
  const asked: string[] = [];
  const harness = renderGrid({
    onSelectPanel: (source, { setActiveSource }) => {
      asked.push(source.kind === 'hyperliquid' ? source.coin : '');
      // The host shows a perp token before its switch has landed.
      setActiveSource(source);
      return new Promise((resolve) => {
        answers.push(resolve);
      });
    },
  });

  // Opening the ETH chart's picker presses the chart; ETH is picked while
  // the host still loads it.
  act(() => press('panel-2'));
  act(() => mockPanels.get('panel-2')?.selectSource(coin('ETH')));

  expect(asked).toEqual(['ETH']);
  expect(harness.layout.activePanelId).toBeUndefined();
  await act(async () => answers[0](true));
  expect(harness.layout.activePanelId).toBe('panel-2');
});

it('returns a selection that waited for a switch on its way when that switch fails', async () => {
  let fail: () => void = () => {};
  const harness = renderGrid({
    onSelectPanel: (source, { setActiveSource }) => {
      setActiveSource(source);
      return new Promise((resolve) => {
        fail = () => {
          // The page goes back to the token it showed.
          setActiveSource(coin('BTC'));
          resolve(false);
        };
      });
    },
  });

  act(() => press('panel-2'));
  act(() => mockPanels.get('panel-2')?.selectSource(coin('ETH')));
  await act(async () => fail());

  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  expect(harness.layout.activePanelId).toBeUndefined();
});

it.each([
  ['lands', true],
  ['fails', false],
])(
  'decides a selection made in a newer grid of the layout by the switch an older one asked for, when it %s',
  async (_, switched) => {
    let finish: (result: boolean) => void = () => {};
    const onSelectPanel = jest.fn(
      (source: ITradingViewNativeSource, { setActiveSource }: IHarness) => {
        setActiveSource(source);
        return new Promise<boolean>((resolve) => {
          finish = (result) => {
            // A failed switch puts the page back on the token it showed.
            if (!result) setActiveSource(coin('BTC'));
            resolve(result);
          };
        });
      },
    );
    const harness = renderGrid({
      layoutKey: `newer-selection-${String(switched)}`,
      layout: {
        preset: '2h',
        sync: { symbol: true },
        panels: { 'panel-2': { source: coin('SOL'), indicatorSettings } },
      },
      onSelectPanel,
    });
    const saved = harness.layout;

    // ETH is picked in the first chart, and the page crosses the breakpoint
    // twice while the host loads it.
    act(() => mockPanels.get('main')?.selectSource(coin('ETH')));
    harness.unmount();
    harness.remount();
    // Every chart shows ETH already, but the switch to it is still on its
    // way: selecting the second chart waits for that switch.
    await act(async () => press('panel-2'));
    expectScreen({ main: 'ETH', 'panel-2': 'ETH' }, 'panel-2');
    expect(harness.layout).toBe(saved);
    expect(onSelectPanel).toHaveBeenCalledTimes(1);

    await act(async () => finish(switched));
    if (switched) {
      expect(harness.layout.activePanelId).toBe('panel-2');
    } else {
      // The first chart stays the selected one.
      expectScreen({ main: 'BTC', 'panel-2': 'BTC' }, 'main');
      expect(harness.layout).toBe(saved);
    }
  },
);

it('asks again for the token of a panel selected again after the switch to it was superseded', async () => {
  const answers: Array<(switched: boolean) => void> = [];
  const asked: string[] = [];
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
      asked.push(source.kind === 'hyperliquid' ? source.coin : '');
      // The host shows a token before its switch has landed.
      setActiveSource(source);
      return new Promise((resolve) => {
        answers.push(resolve);
      });
    },
  });
  const charts = {
    main: 'BTC',
    'panel-2': 'ETH',
    'panel-3': 'SOL',
    'panel-4': 'HYPE',
  };

  // panel-2 is selected again while the host heads for SOL, before the
  // switch to ETH has been turned down.
  act(() => press('panel-2'));
  act(() => press('panel-3'));
  act(() => press('panel-2'));
  expect(asked).toEqual(['ETH', 'SOL', 'ETH']);

  // The switches it superseded are turned down first.
  await act(async () => {
    answers[0](false);
    answers[1](false);
  });
  expectScreen(charts, 'panel-2');
  await act(async () => answers[2](true));
  expectScreen(charts, 'panel-2');
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-2',
    panels: {
      main: { source: coin('BTC') },
      'panel-3': { source: coin('SOL') },
    },
  });
});

it('returns to the last saved panel when a switch asked while another was on its way fails', async () => {
  const answers: Array<(switched: boolean) => void> = [];
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
      setActiveSource(source);
      return new Promise((resolve) => {
        answers.push(resolve);
      });
    },
  });
  const saved = harness.layout;

  // panel-3 is selected while the host still heads for ETH.
  act(() => press('panel-2'));
  act(() => press('panel-3'));
  await act(async () => answers[0](false));
  // The switch to SOL fails, and the page goes back to the token it showed
  // before either switch.
  await act(async () => {
    harness.setActiveSource(coin('BTC'));
    answers[1](false);
  });

  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'main',
  );
  expect(harness.layout).toBe(saved);
});

it('keeps building on its own write when another window saves the same revision first', () => {
  const harness = renderGrid({
    layoutKey: 'same-revision',
    deferLayoutWrites: true,
    onSelectPanel: async () => true,
  });
  const initial = harness.layout;

  // Four charts, on their way to bg.
  act(() => {
    fireEvent.click(screen.getByTestId('preset-4'));
  });
  // Another window wrote over the same layout, and bg sends its write back
  // before this one.
  act(() =>
    harness.replaceLayout({
      ...initial,
      sync: { crosshair: true },
      revision: 1,
      writeId: 'other-window',
    }),
  );
  // A sync option changes before this window's write is back.
  act(() => {
    fireEvent.click(screen.getByTestId('sync-symbol'));
  });
  act(() => harness.flushLayout());

  expect(harness.layout).toMatchObject({
    preset: '4',
    sync: { symbol: true },
  });
});

it('builds on a newer layout another window saved over a write the grid kept when it went', () => {
  const harness = renderGrid({
    layoutKey: 'other-window',
    deferLayoutWrites: true,
    onSelectPanel: async () => true,
  });

  // Four charts, and the grid goes before bg has sent that back.
  act(() => {
    fireEvent.click(screen.getByTestId('preset-4'));
  });
  harness.unmount();
  act(() => harness.flushLayout());
  const { revision = 0 } = harness.layout;
  // Another window's grid then saves three charts.
  act(() =>
    harness.replaceLayout({
      ...harness.layout,
      preset: '3',
      revision: revision + 1,
    }),
  );

  // Back on this page, a sync option changes.
  harness.remount();
  act(() => {
    fireEvent.click(screen.getByTestId('sync-symbol'));
  });
  act(() => harness.flushLayout());
  expect(harness.layout).toMatchObject({
    preset: '3',
    sync: { symbol: true },
  });
});

it('keeps one collapse state for the drawing tools whichever panel is selected', async () => {
  renderGrid({
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  const isCollapsed = () =>
    [...mockDrawingTools.values()].map((tools) => tools.isCollapsed);
  expect(isCollapsed()).toEqual([false, false]);

  act(() => mockDrawingTools.get('main')?.onCollapsedChange(true));
  expect(isCollapsed()).toEqual([true, true]);

  await act(async () => press('panel-2'));
  expect(mockDrawingTools.get('panel-2')?.isCollapsed).toBe(true);
});

it('keeps the width the price scale of each chart counts from as the tools column collapses', () => {
  renderGrid({ onSelectPanel: async () => true });
  const column = screen.getByTestId('trading-view-multi-chart-drawing-tools');
  const gain = () => mockDrawingTools.get('panel-2')?.getCollapseGain() ?? NaN;

  // Two charts side by side beside an open column: each gains half of it.
  setWidth(column, 48);
  setWidth(column.parentElement, 1048);
  expect(gain()).toBe(24);
  const open = 500 + gain();

  // Once it is collapsed the charts have that width, and gain nothing more.
  setWidth(column, 0);
  expect(open).toBe(524 + gain());
});

it('gives the tools column to the charts that grow as it collapses, not to one held at its minimum width', () => {
  renderGrid({
    layout: {
      preset: '2h',
      sizes: { '2h': { columns: [0.7, 0.3], rows: [1] } },
      panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
    },
    onSelectPanel: async () => true,
  });
  const column = screen.getByTestId('trading-view-multi-chart-drawing-tools');
  const gain = (panelId: string) =>
    mockDrawingTools.get(panelId)?.getCollapseGain() ?? NaN;

  // A 500 px grid beside the open column: the narrow chart is at the 240 px
  // minimum, and stays there once the grid is 548 px wide.
  setWidth(column, 48);
  setWidth(column.parentElement, 548);
  expect(gain('panel-2')).toBe(0);
  // So the wide one goes from 260 px to 308 px.
  expect(gain('main')).toBeCloseTo(48);
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

it('keeps a selection still on its way to a split runtime when the preset changes', async () => {
  const onSelectPanel = async (
    source: ITradingViewNativeSource,
    { setActiveSource }: IHarness,
  ) => {
    setActiveSource(source);
    return true;
  };
  const harness = renderGrid({ deferLayoutWrites: true, onSelectPanel });

  // The host follows to ETH; the selection has not come back from bg when the
  // layout grows to four charts.
  await act(async () => press('panel-2'));
  act(() => {
    fireEvent.click(screen.getByTestId('preset-4'));
  });

  act(() => harness.flushLayout());
  expect(harness.layout).toMatchObject({
    preset: '4',
    activePanelId: 'panel-2',
    panels: { main: { source: coin('BTC') } },
  });

  // A grid mounted afresh, e.g. after another chart mode, shows the same.
  harness.unmount();
  renderGrid({
    layout: harness.layout,
    activeSource: coin('ETH'),
    onSelectPanel,
  });
  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'SOL' },
    'panel-2',
  );
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
    // page's token picker, shown by the first panel, trades DOGE instead.
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

it('lets a selection returned to on a split runtime follow the host', async () => {
  const finishes: ((switched: boolean) => void)[] = [];
  const harness = renderGrid({
    deferLayoutWrites: true,
    layout: {
      preset: '4',
      panels: {
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('SOL'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: (source, { setActiveSource }) => {
      if (source.kind === 'hyperliquid' && source.coin === 'ETH') {
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
    act(() => harness.flushLayout());
  };

  // ETH is traded and its selection is still on its way to bg when the
  // fourth chart is pressed and the layout shrinks.
  await act(async () => press('panel-2'));
  act(() => press('panel-4'));
  setPreset('2h');
  expectScreen({ main: 'ETH', 'panel-2': 'ETH' }, 'main');

  // The page's token picker, shown by the first panel, goes back to BTC and
  // the switch to HYPE is dropped: the selection returns to panel-2.
  act(() => harness.setActiveSource(coin('BTC')));
  await act(async () => finishes[0](false));

  // panel-2 follows the trade, not the ETH it waited for before.
  expectScreen({ main: 'BTC', 'panel-2': 'BTC' }, 'panel-2');
  setPreset('4');
  expectScreen(
    { main: 'BTC', 'panel-2': 'BTC', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'panel-2',
  );
  expect(harness.layout.activePanelId).toBe('panel-2');
});

it('keeps a preset change still on its way to a split runtime when a selection is saved', async () => {
  let finish: (switched: boolean) => void = () => {};
  const harness = renderGrid({
    deferLayoutWrites: true,
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

  // The layout shrinks while the host is switching, and the switch lands
  // before that change has come back from bg.
  act(() => press('panel-4'));
  act(() => {
    fireEvent.click(screen.getByTestId('preset-2h'));
  });
  await act(async () => {
    harness.setActiveSource(coin('HYPE'));
    finish(true);
  });

  // Both writes come back, one after the other.
  act(() => harness.flushLayout(1));
  act(() => harness.flushLayout());
  expect(harness.layout).toMatchObject({
    preset: '2h',
    activePanelId: 'panel-4',
    panels: { main: { source: coin('BTC') } },
  });
  expectScreen({ main: 'HYPE', 'panel-2': 'ETH' }, 'main');
});

it('starts from an outside change once its own writes have come back from a split runtime', async () => {
  const harness = renderGrid({
    deferLayoutWrites: true,
    layout: {
      preset: '2h',
      panels: {
        'panel-2': {
          source: coin('ETH'),
          // Comes back from bg without the field set to `undefined`.
          indicatorSettings: {
            ...indicatorSettings,
            mainIndicators: [
              {
                active: true,
                id: 'MA',
                lines: {},
                opacityColors: undefined,
                parameters: {},
                transparency: 0,
              },
            ],
          },
        },
      },
    },
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });

  await act(async () => press('panel-2'));
  act(() => harness.flushLayout());
  // Another window turns the token sync on.
  act(() =>
    harness.replaceLayout({ ...harness.layout, sync: { symbol: true } }),
  );
  act(() => {
    fireEvent.click(screen.getByTestId('preset-4'));
  });
  act(() => harness.flushLayout());

  expect(harness.layout).toMatchObject({
    preset: '4',
    activePanelId: 'panel-2',
    sync: { symbol: true },
  });
});

it('keeps a token traded past a hidden pending panel with its own panel for the next selection', async () => {
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
  // page's token picker, shown by the first panel, trades DOGE instead.
  act(() => press('panel-4'));
  setPreset('2h');
  act(() => harness.setActiveSource(coin('DOGE')));
  // Another chart is pressed before the HYPE switch is answered.
  act(() => press('panel-2'));
  await act(async () => {
    finishes[0](false);
    harness.setActiveSource(coin('ETH'));
    finishes[1](true);
  });

  // DOGE stays with the first panel, and the fourth keeps its HYPE.
  expectScreen({ main: 'DOGE', 'panel-2': 'ETH' }, 'panel-2');
  setPreset('4');
  expectScreen(
    { main: 'DOGE', 'panel-2': 'ETH', 'panel-3': 'SOL', 'panel-4': 'HYPE' },
    'panel-2',
  );
});

it.each([
  ['without', undefined],
  ['with', 'late-landing'],
])(
  'lands a selection answered after the grid is gone on the layout saved since, %s a layout key',
  async (_, layoutKey) => {
    let finish: (switched: boolean) => void = () => {};
    const harness = renderGrid({
      layoutKey,
      deferLayoutWrites: true,
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

    // The layout shrinks while the host is switching, and the page drops the
    // grid, e.g. below the desktop breakpoint, before bg sends that back.
    act(() => press('panel-4'));
    setPreset('2h');
    harness.unmount();
    act(() => harness.flushLayout());

    // A new grid grows the layout again, which comes back from bg.
    harness.remount();
    setPreset('4');
    act(() => harness.flushLayout());

    // Only now does the switch land.
    await act(async () => {
      harness.setActiveSource(coin('HYPE'));
      finish(true);
    });
    act(() => harness.flushLayout());
    expect(harness.layout).toMatchObject({
      preset: '4',
      activePanelId: 'panel-4',
      panels: { main: { source: coin('BTC') } },
    });
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

it('asks the host for a token picked in the panel that shows it already', async () => {
  const onSelectPanel = jest.fn(
    async (_source: ITradingViewNativeSource, _harness: IHarness) => true,
  );
  const harness = renderGrid({ onSelectPanel });

  // The page can show a token without holding its market, e.g. after another
  // page took that; picking the token again is how the user asks for it.
  await act(async () => mockPanels.get('main')?.selectSource(coin('BTC')));

  expect(onSelectPanel).toHaveBeenCalledTimes(1);
  expect(onSelectPanel).toHaveBeenCalledWith(coin('BTC'), harness);
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
});

it('keeps the panel selected on its page when another page saves a selection', async () => {
  const harness = renderGrid({
    keepsSelectedPanel: true,
    layout: {
      preset: '2h',
      panels: {
        main: { source: coin('SOL') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
      },
    },
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');

  // Another page, e.g. an extension tab on its own token, selects the ETH
  // chart and saves the token its first chart showed.
  act(() =>
    harness.replaceLayout({
      ...harness.layout,
      activePanelId: 'panel-2',
      panels: { ...harness.layout.panels, main: { source: coin('DOGE') } },
      revision: 1,
      writeId: 'other-page',
    }),
  );
  // This page still trades BTC in its first chart.
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  // Also in a grid mounted since.
  harness.unmount();
  harness.remount();
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');

  // Selecting here saves this page's own tokens, not BTC over the ETH chart.
  await act(async () => press('panel-2'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');
  await act(async () => press('main'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  expect(harness.layout).toMatchObject({
    activePanelId: 'main',
    panels: { 'panel-2': { source: coin('ETH') } },
  });
});

it('gives a chart its token when another page saves the selection on it without one', async () => {
  const harness = renderGrid({
    keepsSelectedPanel: true,
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  // This page selects the ETH chart.
  await act(async () => press('panel-2'));
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'panel-2');

  // Another page saves a layout with the first chart selected, which shows
  // that page's token there without storing one.
  act(() =>
    harness.replaceLayout({
      preset: '2h',
      activePanelId: 'main',
      panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
      revision: (harness.layout.revision ?? 0) + 1,
      writeId: 'other-page',
    }),
  );

  // Here the first chart is not the selected one, so it gets a token of its
  // own instead of staying blank; the other page keeps its selection.
  expectScreen({ main: 'SOL', 'panel-2': 'ETH' }, 'panel-2');
  expect(harness.layout).toMatchObject({
    activePanelId: 'main',
    panels: {
      main: { source: coin('SOL') },
      'panel-2': { source: coin('ETH') },
    },
  });

  // New charts are filled the same way.
  act(() => {
    fireEvent.click(screen.getByTestId('preset-4'));
  });
  expect(harness.layout.activePanelId).toBe('main');
  expect(screen.getByTestId('chart-panel-3').dataset.coin).toBe('SOL');
  expect(getPanel('panel-2').dataset.selected).toBe('true');
});

function renderSpotGrid(
  onSelectPanel: Parameters<typeof renderGrid>[0]['onSelectPanel'],
) {
  return renderGrid({
    layout: {
      preset: '3',
      panels: {
        main: { source: coin('SOL') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('@107'), indicatorSettings },
      },
    },
    onSelectPanel,
  });
}

it.each([
  ['lands', true],
  ['fails', false],
])(
  'leaves a selection on its way to its switch when the host turns the next one down before starting, and it %s',
  async (_, switched) => {
    let finish: (result: boolean) => void = () => {};
    const harness = renderSpotGrid((source, { setActiveSource }) => {
      // A spot token whose markets have not loaded is no switch: the host
      // turns it down at once and the switch on its way goes on.
      if (source.kind === 'hyperliquid' && source.coin === '@107') {
        return Promise.resolve(false);
      }
      setActiveSource(source);
      return new Promise<boolean>((resolve) => {
        finish = (result) => {
          if (!result) setActiveSource(coin('BTC'));
          resolve(result);
        };
      });
    });
    const saved = harness.layout;
    const charts = { main: 'BTC', 'panel-2': 'ETH', 'panel-3': '@107' };

    // The spot chart is pressed once the host shows ETH, before it got there.
    act(() => press('panel-2'));
    await act(async () => press('panel-3'));

    // The ETH chart is the selected one again, and nothing is saved yet.
    expectScreen(charts, 'panel-2');
    expect(harness.layout).toBe(saved);

    await act(async () => finish(switched));
    if (switched) {
      expectScreen(charts, 'panel-2');
      expect(harness.layout).toMatchObject({
        activePanelId: 'panel-2',
        panels: {
          main: { source: coin('BTC') },
          'panel-3': { source: coin('@107') },
        },
      });
    } else {
      expectScreen(charts, 'main');
      expect(harness.layout).toBe(saved);
    }
  },
);

it.each([
  ['lands', true],
  ['is turned down', false],
])(
  'keeps a token picked in a panel whose switch lands while the next selection is on its way, which then %s',
  async (_, switched) => {
    const answers = new Map<string, (result: boolean) => void>();
    const harness = renderSpotGrid((source, { setActiveSource }) => {
      const name = source.kind === 'hyperliquid' ? source.coin : '';
      // The host looks a spot token up before its switch begins, and shows
      // a perp token at once.
      if (name !== '@107') setActiveSource(source);
      return new Promise<boolean>((resolve) => {
        answers.set(name, resolve);
      });
    });

    // DOGE is picked in the first chart, and the spot chart is selected
    // before the host got to DOGE.
    act(() => mockPanels.get('main')?.selectSource(coin('DOGE')));
    act(() => press('panel-3'));
    expectScreen(
      { main: 'BTC', 'panel-2': 'ETH', 'panel-3': '@107' },
      'panel-3',
    );

    // The switch to DOGE lands while the host still looks the spot token up.
    await act(async () => answers.get('DOGE')?.(true));
    expectScreen(
      { main: 'DOGE', 'panel-2': 'ETH', 'panel-3': '@107' },
      'panel-3',
    );

    await act(async () => {
      if (switched) harness.setActiveSource(coin('@107'));
      answers.get('@107')?.(switched);
    });
    // The first chart keeps the token it landed on either way.
    expectScreen(
      { main: 'DOGE', 'panel-2': 'ETH', 'panel-3': '@107' },
      switched ? 'panel-3' : 'main',
    );
    if (switched) {
      expect(harness.layout).toMatchObject({
        activePanelId: 'panel-3',
        panels: { main: { source: coin('DOGE') } },
      });
    } else {
      expect(harness.layout.activePanelId ?? 'main').toBe('main');
    }
  },
);

it('leaves a token that never landed out of the layout when two more panels are selected', async () => {
  const answers = new Map<string, (result: boolean) => void>();
  const harness = renderGrid({
    layout: {
      preset: '4',
      panels: {
        main: { source: coin('SOL') },
        'panel-2': { source: coin('ETH'), indicatorSettings },
        'panel-3': { source: coin('@107'), indicatorSettings },
        'panel-4': { source: coin('HYPE'), indicatorSettings },
      },
    },
    onSelectPanel: (source, { setActiveSource }) => {
      const name = source.kind === 'hyperliquid' ? source.coin : '';
      if (name !== '@107') setActiveSource(source);
      return new Promise<boolean>((resolve) => {
        answers.set(name, resolve);
      });
    },
  });

  // DOGE is picked in the ETH chart; then the spot chart is selected, which
  // the host still looks up, and the HYPE chart, which it switches to.
  act(() => mockPanels.get('panel-2')?.selectSource(coin('DOGE')));
  act(() => press('panel-3'));
  act(() => press('panel-4'));
  await act(async () => {
    answers.get('DOGE')?.(false);
    answers.get('@107')?.(false);
    answers.get('HYPE')?.(true);
  });

  expectScreen(
    { main: 'BTC', 'panel-2': 'ETH', 'panel-3': '@107', 'panel-4': 'HYPE' },
    'panel-4',
  );
  expect(harness.layout).toMatchObject({
    activePanelId: 'panel-4',
    panels: {
      main: { source: coin('BTC') },
      'panel-2': { source: coin('ETH') },
    },
  });
});

function expectIntervals(expected: Record<string, string>) {
  for (const [id, interval] of Object.entries(expected)) {
    expect(screen.getByTestId(`chart-${id}`).dataset.interval).toBe(interval);
  }
}

function pickInterval(id: string, interval: string) {
  act(() => mockPickInterval.get(id)?.(interval));
}

// The second panel is the selected one and shows the host's BTC.
const secondPanelSelected: ITradingViewNativeMultiChartLayout = {
  preset: '2h',
  activePanelId: 'panel-2',
  panels: {
    main: { source: coin('ETH') },
    'panel-2': { source: coin('BTC'), indicatorSettings },
  },
};

it('syncs the intervals to the selected panel when the option is turned on', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
  });
  expectScreen({ main: 'ETH', 'panel-2': 'BTC' }, 'panel-2');
  expectIntervals({ main: '1', 'panel-2': '240' });

  fireEvent.click(screen.getByTestId('sync-interval'));
  expectIntervals({ main: '240', 'panel-2': '240' });
  // Saved with the option, for the other pages that show the layout.
  expect(harness.layout).toMatchObject({
    sync: { interval: true },
    intervalSyncStart: '240',
  });

  // From then on a pick in either chart moves both.
  pickInterval('main', '15');
  expectIntervals({ main: '15', 'panel-2': '15' });
  pickInterval('panel-2', '60');
  expectIntervals({ main: '60', 'panel-2': '60' });

  // Off, each chart keeps to itself; on again, the selected one leads again.
  fireEvent.click(screen.getByTestId('sync-interval'));
  expect(harness.layout.intervalSyncStart).toBeUndefined();
  pickInterval('main', '5');
  expectIntervals({ main: '5', 'panel-2': '60' });
  fireEvent.click(screen.getByTestId('sync-interval'));
  expectIntervals({ main: '60', 'panel-2': '60' });
});

it('syncs the intervals at once on the page that turns the option on, before a split runtime has saved it', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
    deferLayoutWrites: true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  expectIntervals({ main: '240', 'panel-2': '240' });
  expect(harness.layout.sync).toBeUndefined();

  act(() => harness.flushLayout());
  expectIntervals({ main: '240', 'panel-2': '240' });
  expect(harness.layout).toMatchObject({
    sync: { interval: true },
    intervalSyncStart: '240',
  });
});

it('keeps the intervals on the chart the option was turned on in when another panel is selected before a split runtime has saved it', async () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
    deferLayoutWrites: true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  await act(async () => press('main'));
  expectScreen({ main: 'ETH', 'panel-2': 'BTC' }, 'main');
  expectIntervals({ main: '240', 'panel-2': '240' });

  act(() => harness.flushLayout());
  expectScreen({ main: 'ETH', 'panel-2': 'BTC' }, 'main');
  expectIntervals({ main: '240', 'panel-2': '240' });
});

it('moves every chart to an interval picked before a split runtime has saved the option, and keeps it', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
    deferLayoutWrites: true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  pickInterval('panel-2', '15');
  expectIntervals({ main: '15', 'panel-2': '15' });
  pickInterval('main', '5');
  expectIntervals({ main: '5', 'panel-2': '5' });

  act(() => harness.flushLayout());
  expectIntervals({ main: '5', 'panel-2': '5' });
  // The other pages got the interval the option was turned on with.
  expect(harness.layout.intervalSyncStart).toBe('240');
});

it('keeps the intervals where they are when the option is pressed again before a split runtime has saved it', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
    deferLayoutWrites: true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  pickInterval('panel-2', '15');
  // The switch still shows the option off, so this press asks for it again.
  fireEvent.click(screen.getByTestId('sync-interval'));
  expectIntervals({ main: '15', 'panel-2': '15' });

  act(() => harness.flushLayout());
  expectIntervals({ main: '15', 'panel-2': '15' });
  expect(harness.layout.intervalSyncStart).toBe('240');
});

it('leaves a chart on the interval it fell back to when a split runtime saves the option', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
    deferLayoutWrites: true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  pickInterval('panel-2', '15');
  // The data of the picked interval fails to load in the chart it was
  // picked in.
  act(() => mockFallBackInterval.get('panel-2')?.('240'));

  act(() => harness.flushLayout());
  expectIntervals({ main: '15', 'panel-2': '240' });
});

it('leaves the intervals synced here alone when the option of another page arrives first', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
    deferLayoutWrites: true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  pickInterval('main', '15');

  // That page turned the option on in a chart on another interval.
  act(() =>
    harness.replaceLayout({
      ...harness.layout,
      sync: { interval: true },
      intervalSyncStart: '60',
    }),
  );
  expectIntervals({ main: '15', 'panel-2': '15' });
});

it('stops syncing the intervals when the option asked for here is lost to a write of another page', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
    deferLayoutWrites: true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  expectIntervals({ main: '240', 'panel-2': '240' });

  // Saved over the write of this grid, without the option.
  act(() => harness.replaceLayout({ ...harness.layout, revision: 9 }));
  pickInterval('main', '5');
  expectIntervals({ main: '5', 'panel-2': '240' });
});

it('syncs the intervals to the chart another page turned the option on in', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '15');
  const harness = renderGrid({ onSelectPanel: async () => true });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');

  // That page had another panel selected, on another interval.
  act(() =>
    harness.replaceLayout({
      ...harness.layout,
      sync: { interval: true },
      intervalSyncStart: '240',
    }),
  );
  expectIntervals({ main: '240', 'panel-2': '240' });
});

it('syncs the intervals to the first panel when the option arrives without an interval', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  const harness = renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
  });

  // Saved by a page that knew no interval to start from.
  act(() =>
    harness.replaceLayout({ ...harness.layout, sync: { interval: true } }),
  );
  expectIntervals({ main: '1', 'panel-2': '1' });
});

it('leaves a synced chart on the interval it fell back to when its panel is selected', async () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  expectIntervals({ main: '240', 'panel-2': '240' });
  act(() => mockFallBackInterval.get('main')?.('1'));

  // Selecting it is no reason to load the shared interval again.
  await act(async () => press('main'));
  expectScreen({ main: 'ETH', 'panel-2': 'BTC' }, 'main');
  expectIntervals({ main: '1', 'panel-2': '240' });
});

it('syncs the intervals to the first panel when it is the selected one', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  renderGrid({ onSelectPanel: async () => true });
  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');

  fireEvent.click(screen.getByTestId('sync-interval'));
  expectIntervals({ main: '1', 'panel-2': '1' });
});

it('keeps the synced intervals where they are when another panel is selected', async () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async (source, { setActiveSource }) => {
      setActiveSource(source);
      return true;
    },
  });
  fireEvent.click(screen.getByTestId('sync-interval'));
  expectIntervals({ main: '240', 'panel-2': '240' });

  await act(async () => press('main'));
  expectScreen({ main: 'ETH', 'panel-2': 'BTC' }, 'main');
  expectIntervals({ main: '240', 'panel-2': '240' });
});

it('hands the synced interval to the panels a larger preset adds', () => {
  mockIntervals.set('main', '1');
  mockIntervals.set('panel-2', '240');
  mockIntervals.set('panel-3', '15');
  renderGrid({
    layout: secondPanelSelected,
    onSelectPanel: async () => true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));

  fireEvent.click(screen.getByTestId('preset-4'));
  expectIntervals({
    main: '240',
    'panel-2': '240',
    'panel-3': '240',
    'panel-4': '240',
  });
});

it('starts a split view that mounts with the intervals synced from the first panel', () => {
  // The first panel's interval is the one a single chart shows and changes,
  // e.g. on a narrower page that has no grid.
  mockIntervals.set('main', '15');
  mockIntervals.set('panel-2', '240');
  renderGrid({
    layout: {
      ...secondPanelSelected,
      sync: { interval: true },
      // What the option was turned on with, some time ago.
      intervalSyncStart: '5',
    },
    onSelectPanel: async () => true,
  });
  expectScreen({ main: 'ETH', 'panel-2': 'BTC' }, 'panel-2');
  expectIntervals({ main: '15', 'panel-2': '15' });
});

it('opens a split view on the interval its single chart shows while the intervals are synced', () => {
  mockIntervals.set('main', '60');
  mockIntervals.set('panel-2', '240');
  renderGrid({
    layout: {
      ...secondPanelSelected,
      preset: '1',
      sync: { interval: true },
      intervalSyncStart: '5',
    },
    onSelectPanel: async () => true,
  });
  // The one chart stands in for the hidden selected panel.
  expect(screen.getByTestId('chart-main').dataset.coin).toBe('BTC');
  expectIntervals({ main: '60' });
  pickInterval('main', '15');

  // The selected panel returns with an older interval of its own.
  fireEvent.click(screen.getByTestId('preset-2h'));
  expectScreen({ main: 'ETH', 'panel-2': 'BTC' }, 'panel-2');
  expectIntervals({ main: '15', 'panel-2': '15' });
});

it('leaves a single chart on its own interval while the intervals are synced', () => {
  mockIntervals.set('main', '60');
  const harness = renderGrid({
    layout: {
      ...secondPanelSelected,
      preset: '1',
      sync: { interval: true },
    },
    onSelectPanel: async () => true,
  });
  pickInterval('main', '15');
  // The chart falls back to another interval by itself, e.g. as its data
  // fails to load, and is then mounted anew for another token.
  mockIntervals.set('main', '240');
  act(() => harness.setActiveSource(coin('SOL')));

  expect(screen.getByTestId('chart-main').dataset.coin).toBe('SOL');
  expectIntervals({ main: '240' });
});

it('opens a split view on the interval of the single chart the option was turned on in', () => {
  mockIntervals.set('main', '60');
  mockIntervals.set('panel-2', '240');
  renderGrid({
    layout: { ...secondPanelSelected, preset: '1' },
    onSelectPanel: async () => true,
  });
  fireEvent.click(screen.getByTestId('sync-interval'));

  fireEvent.click(screen.getByTestId('preset-2h'));
  expectScreen({ main: 'ETH', 'panel-2': 'BTC' }, 'panel-2');
  expectIntervals({ main: '60', 'panel-2': '60' });
});
