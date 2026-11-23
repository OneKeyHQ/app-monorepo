// cspell:ignore macd

import {
  getTradingViewNativeSubIndicatorPaneLayouts,
  getTradingViewNativeSubIndicatorPaneStackLayout,
} from '../utils/subIndicatorRender';
import { createTradingViewNativeSubIndicatorRenderSnapshots } from '../utils/subIndicatorRender/pipeline';

import {
  arrangeIndicatorPanes,
  getIndicatorPaneResizeHeights,
  parseIndicatorPanePreferences,
  setIndicatorPaneHeights,
} from './model';

const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
  configs: [
    { id: 'volume', indicator: 'VOL' },
    { id: 'macd', indicator: 'MACD' },
    { id: 'rsi', indicator: 'RSI' },
  ],
  points: [],
}).map(({ pane }) => pane);

// Three stacked panes of 60, 40 and 100px ending at y = 500.
const stack = [
  { id: 'volume', top: 300, bottom: 360, height: 60 },
  { id: 'macd', top: 360, bottom: 400, height: 40 },
  { id: 'rsi', top: 400, bottom: 500, height: 100 },
];

describe('getIndicatorPaneResizeHeights', () => {
  it('scales every pane together when the first boundary moves', () => {
    expect(
      getIndicatorPaneResizeHeights({
        delta: -100,
        index: 0,
        minimumTop: 96,
        panes: stack,
      }),
    ).toEqual({ volume: 90, macd: 60, rsi: 150 });
    expect(
      getIndicatorPaneResizeHeights({
        delta: 10,
        index: 0,
        minimumTop: 96,
        panes: stack,
      }),
    ).toEqual({ volume: 57, macd: 38, rsi: 95 });
  });

  it('keeps shrinking the taller panes once the smallest reaches the minimum', () => {
    // 'macd' stops at the minimum; the other two share what is left.
    expect(
      getIndicatorPaneResizeHeights({
        delta: 40,
        index: 0,
        minimumTop: 96,
        panes: stack,
      }),
    ).toEqual({ volume: 46.5, macd: 36, rsi: 77.5 });
    // The stack stops when every pane is at the minimum.
    expect(
      getIndicatorPaneResizeHeights({
        delta: 400,
        index: 0,
        minimumTop: 96,
        panes: stack,
      }),
    ).toEqual({ volume: 36, macd: 36, rsi: 36 });
  });

  it('leaves the price chart its minimum height', () => {
    const heights = getIndicatorPaneResizeHeights({
      delta: -1000,
      index: 0,
      minimumTop: 96,
      panes: stack,
    });
    expect(
      (heights?.volume ?? 0) + (heights?.macd ?? 0) + (heights?.rsi ?? 0),
    ).toBeCloseTo(500 - 96);
  });

  it('only trades height between neighbours on any other boundary', () => {
    expect(
      getIndicatorPaneResizeHeights({
        delta: 30,
        index: 2,
        minimumTop: 96,
        panes: stack,
      }),
    ).toEqual({ volume: 60, macd: 70, rsi: 70 });
    // The pane above keeps its minimum height.
    expect(
      getIndicatorPaneResizeHeights({
        delta: -100,
        index: 2,
        minimumTop: 96,
        panes: stack,
      }),
    ).toEqual({ volume: 60, macd: 36, rsi: 104 });
  });

  it('does nothing for a stack already squeezed below the minimum', () => {
    expect(
      getIndicatorPaneResizeHeights({
        delta: -20,
        index: 0,
        minimumTop: 96,
        panes: [{ id: 'volume', top: 470, bottom: 500, height: 30 }],
      }),
    ).toBeUndefined();
  });

  it('locks every boundary of a chart too short for the minimum heights', () => {
    // 90px for three panes: the chart splits them equally.
    const tooShort = [
      { id: 'volume', top: 96, bottom: 126, height: 30 },
      { id: 'macd', top: 126, bottom: 156, height: 30 },
      { id: 'rsi', top: 156, bottom: 186, height: 30 },
    ];
    for (const index of [0, 1, 2]) {
      for (const delta of [-10, 10]) {
        expect(
          getIndicatorPaneResizeHeights({
            delta,
            index,
            minimumTop: 96,
            panes: tooShort,
          }),
        ).toBeUndefined();
      }
    }
  });

  it('resizes a pane measured a hair under the minimum and saves the minimum', () => {
    const hair = 3e-14;
    const measured = [
      { id: 'volume', top: 96, bottom: 196, height: 100 },
      { id: 'macd', top: 196, bottom: 232 - hair, height: 36 - hair },
    ];
    const shrunk = getIndicatorPaneResizeHeights({
      delta: 20,
      index: 0,
      minimumTop: 96,
      panes: measured,
    });
    expect(shrunk?.volume).toBeCloseTo(80);
    expect(shrunk?.macd).toBe(36);
    const traded = getIndicatorPaneResizeHeights({
      delta: 10,
      index: 1,
      minimumTop: 96,
      panes: measured,
    });
    // 'macd' has nothing to give up, so the boundary stays.
    expect(traded?.volume).toBeCloseTo(100);
    expect(traded?.macd).toBe(36);
  });
});

// OK-67794: 'volume' was dragged over the whole stack of a split-view panel,
// then 'macd' and 'rsi' were added beside it.
describe('panes added beside one that filled the stack', () => {
  const chartHeight = 300;
  const timeAxisHeight = 24;
  // 300 - 24 (time axis) - 96 (price chart minimum) = 180px of panes.
  const filled = { order: [], heights: { volume: 180 }, referenceHeight: 300 };

  const layOut = (preferences: Parameters<typeof arrangeIndicatorPanes>[1]) => {
    const arranged = arrangeIndicatorPanes(panes, preferences, chartHeight);
    const stackLayout = getTradingViewNativeSubIndicatorPaneStackLayout({
      height: chartHeight,
      paneCount: arranged.length,
      panes: arranged,
      timeAxisHeight,
    });
    return getTradingViewNativeSubIndicatorPaneLayouts({
      panes: arranged,
      stackTop: stackLayout.top,
      stackBottom: stackLayout.bottom,
      startIndex: 0,
      endIndex: 0,
    }).map((layout) => ({
      id: layout.pane.instanceId,
      top: layout.top,
      bottom: layout.bottom,
      height: layout.height,
    }));
  };
  const drag = (index: number, delta: number) =>
    getIndicatorPaneResizeHeights({
      delta,
      index,
      minimumTop: 96,
      panes: layOut(filled),
    });
  /** What the chart shows once the dragged heights are saved and reloaded. */
  const reload = (heights: Record<string, number> | undefined) =>
    layOut(
      parseIndicatorPanePreferences(
        JSON.stringify(
          setIndicatorPaneHeights(filled, heights ?? {}, chartHeight),
        ),
      ),
    ).map((pane) => pane.height);

  it('gives the added panes the minimum height instead of squeezing them below it', () => {
    expect(layOut(filled).map((pane) => pane.height)).toEqual([108, 36, 36]);
  });

  it('shrinks the stack from the boundary under the price chart', () => {
    const heights = drag(0, 30);
    expect(heights).toEqual({ volume: 78, macd: 36, rsi: 36 });
    expect(reload(heights)).toEqual([78, 36, 36]);
    // The price chart is already at its minimum, so the stack cannot grow.
    expect(drag(0, -30)).toEqual({ volume: 108, macd: 36, rsi: 36 });
  });

  it('trades height between the tall pane and the one added under it', () => {
    const heights = drag(1, -30);
    expect(heights).toEqual({ volume: 78, macd: 66, rsi: 36 });
    expect(reload(heights)).toEqual([78, 66, 36]);
  });
});

describe('pane heights follow the chart height', () => {
  it('records the chart height the heights were set at', () => {
    expect(
      setIndicatorPaneHeights(
        { order: [], heights: { rsi: 80 }, referenceHeight: 400 },
        { volume: 120 },
        800,
      ),
    ).toEqual({
      order: [],
      // Heights set earlier are re-measured against the new chart height.
      heights: { rsi: 160, volume: 120 },
      referenceHeight: 800,
    });
  });

  it('keeps a pane at the same share of a taller or shorter chart', () => {
    const preferences = {
      order: [],
      heights: { volume: 120 },
      referenceHeight: 600,
    };
    const heightOf = (chartHeight?: number) =>
      arrangeIndicatorPanes(panes, preferences, chartHeight)[0].preferredHeight;
    expect(heightOf(600)).toBe(120);
    expect(heightOf(300)).toBe(60);
    expect(heightOf(900)).toBe(180);
    // Not measured yet, or saved before heights tracked the chart.
    expect(heightOf(undefined)).toBe(120);
    expect(
      arrangeIndicatorPanes(
        panes,
        { order: [], heights: { volume: 120 } },
        300,
      )[0].preferredHeight,
    ).toBe(120);
    // Panes the user never resized keep the default height.
    expect(
      arrangeIndicatorPanes(panes, preferences, 300)[1].preferredHeight,
    ).toBeUndefined();
  });

  it('restores the reference height and ignores an invalid one', () => {
    expect(
      parseIndicatorPanePreferences(
        JSON.stringify({
          order: [],
          heights: { rsi: 80 },
          referenceHeight: 500,
        }),
      ),
    ).toEqual({ order: [], heights: { rsi: 80 }, referenceHeight: 500 });
    expect(
      parseIndicatorPanePreferences(
        JSON.stringify({ order: [], heights: {}, referenceHeight: -1 }),
      ),
    ).toEqual({ order: [], heights: {} });
  });
});
