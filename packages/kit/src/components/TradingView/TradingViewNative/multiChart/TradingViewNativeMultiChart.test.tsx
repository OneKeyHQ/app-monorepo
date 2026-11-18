/**
 * @jest-environment jsdom
 */

import { useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { createTradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';
import type {
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeSourceKey } from '../data/getTradingViewNativeSource';

import { TradingViewNativeMultiChart } from './TradingViewNativeMultiChart';
import { TradingViewNativeMultiChartControlsContext } from './TradingViewNativeMultiChartPanelContext';

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
  TradingViewNativeMultiChartLayoutSelect: () => (
    <span data-testid="layout-select" />
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
      <span
        data-testid={`chart-${panel.id}`}
        data-coin={panel.source.kind === 'hyperliquid' ? panel.source.coin : ''}
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
  // Applies the layout writes a split runtime is still sending to bg.
  flushLayout: () => void;
}

function renderGrid({
  layout: initialLayout = {
    preset: '2h',
    panels: { 'panel-2': { source: coin('ETH'), indicatorSettings } },
  },
  onSelectPanel,
  deferLayoutWrites = false,
}: {
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
  };
  function Host() {
    const [layout, setLayout] = useState(initialLayout);
    const [activeSource, setActiveSource] = useState(coin('BTC'));
    harness.layout = layout;
    harness.setActiveSource = setActiveSource;
    const [pending, setPending] = useState<
      Parameters<ITradingViewNativeMultiChartProps['onLayoutChange']>[0][]
    >([]);
    harness.flushLayout = () => {
      setLayout((current) =>
        pending.reduce((value, update) => update(value), current),
      );
      setPending([]);
    };
    return (
      <TradingViewNativeMultiChart
        layout={layout}
        onLayoutChange={(update) => {
          if (deferLayoutWrites) {
            setPending((current) => [...current, update]);
          } else {
            setLayout(update);
          }
        }}
        activeSource={activeSource}
        onSelectPanel={(source) => onSelectPanel(source, harness)}
        defaultIndicatorSettings={indicatorSettings}
        getDefaultPanelSource={() => coin('SOL')}
        renderPanel={renderPanel}
      />
    );
  }
  render(<Host />);
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

  await act(async () => press('panel-2'));

  expectScreen({ main: 'BTC', 'panel-2': 'ETH' }, 'main');
  expect(harness.layout.activePanelId).toBe('main');
  expect(mockChartUnmount).not.toHaveBeenCalled();
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
  expect(harness.layout.activePanelId).toBe('panel-3');
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

it('leaves the selection alone for the selected panel and other buttons', () => {
  const onSelectPanel = jest.fn(async () => true);
  renderGrid({ onSelectPanel });

  press('main');
  press('panel-2', 2);

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
