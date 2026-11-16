// cspell:ignore macd

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

  it('stops shrinking the stack when its smallest pane reaches the minimum', () => {
    expect(
      getIndicatorPaneResizeHeights({
        delta: 400,
        index: 0,
        minimumTop: 96,
        panes: stack,
      }),
    ).toEqual({ volume: 54, macd: 36, rsi: 90 });
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

  it('still trades height between neighbours when a distant pane is squeezed', () => {
    // A chart too short for its panes: only 'volume' fell below the minimum.
    const squeezed = [
      { id: 'volume', top: 96, bottom: 120, height: 24 },
      { id: 'macd', top: 120, bottom: 198, height: 78 },
      { id: 'rsi', top: 198, bottom: 276, height: 78 },
    ];
    const resize = (index: number) =>
      getIndicatorPaneResizeHeights({
        delta: 10,
        index,
        minimumTop: 96,
        panes: squeezed,
      });
    expect(resize(2)).toEqual({ volume: 24, macd: 88, rsi: 68 });
    // Boundaries that would resize the squeezed pane stay locked.
    expect(resize(1)).toBeUndefined();
    expect(resize(0)).toBeUndefined();
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
