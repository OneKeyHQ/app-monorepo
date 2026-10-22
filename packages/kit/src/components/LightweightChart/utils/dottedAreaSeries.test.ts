import { createDottedAreaSeriesPaneView } from './dottedAreaSeries';

import type { IDottedAreaData } from './dottedAreaSeries';
import type {
  Coordinate,
  ICustomSeriesPaneRenderer,
  PaneRendererCustomData,
  Time,
} from 'lightweight-charts';

function renderRange(visibleRange: { from: number; to: number } | null) {
  const pane = createDottedAreaSeriesPaneView();
  const context = {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    clip: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
  };
  // Outside the visible range, the library retains coordinates from before resize.
  const data: PaneRendererCustomData<Time, IDottedAreaData> = {
    bars: [100, 0, 80, 300].map((x, index) => ({
      x,
      time: index,
      originalData: { time: index as Time, value: index + 10 },
      barColor: '#008000',
    })),
    visibleRange,
    barSpacing: 80,
    conflationFactor: 1,
  };
  pane.update(data, {
    ...pane.defaultOptions(),
    patternSpacing: 1000,
  });
  const renderer = pane.renderer();
  const target = {
    useBitmapCoordinateSpace: (draw: (scope: unknown) => void) =>
      draw({
        context,
        horizontalPixelRatio: 1,
        verticalPixelRatio: 1,
        bitmapSize: { width: 160, height: 100 },
      }),
  } as unknown as Parameters<ICustomSeriesPaneRenderer['draw']>[0];
  renderer.draw(target, (price) => price as Coordinate, false);
  return context;
}

describe('dotted area resize', () => {
  it('keeps stale coordinates out of the line and fill after the visible range changes', () => {
    const context = renderRange({ from: 1, to: 3 });
    expect(context.moveTo.mock.calls).toEqual([
      [0, 100],
      [0, 11],
    ]);
    expect(context.lineTo.mock.calls).toEqual([
      [0, 11],
      [80, 12],
      [80, 100],
      [80, 12],
    ]);
    // The last visible point is not the actual series tail.
    expect(context.arc).not.toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      5.5,
      0,
      Math.PI * 2,
    );
  });

  it('draws the tail marker only when the series tail is in the visible range', () => {
    const context = renderRange({ from: 2, to: 4 });
    expect(context.arc).toHaveBeenCalledWith(300, 13, 5.5, 0, Math.PI * 2);
  });

  it('does not draw retained coordinates when no points are visible', () => {
    const context = renderRange(null);
    expect(context.stroke).not.toHaveBeenCalled();
    expect(context.clip).not.toHaveBeenCalled();
    expect(context.arc).not.toHaveBeenCalled();
  });
});
