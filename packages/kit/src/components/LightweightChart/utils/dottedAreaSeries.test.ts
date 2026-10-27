import { createDottedAreaSeriesPaneView } from './dottedAreaSeries';

import type { IDottedAreaData } from './dottedAreaSeries';
import type {
  Coordinate,
  ICustomSeriesPaneRenderer,
  PaneRendererCustomData,
  Time,
} from 'lightweight-charts';

function renderRange(
  visibleRange: { from: number; to: number } | null,
  logicalTimes = [0, 1, 2, 3],
) {
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
      time: logicalTimes[index],
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
  it('rebuilds neighboring coordinates so the line and fill reach the pane edges', () => {
    const context = renderRange({ from: 1, to: 3 });
    expect(context.moveTo.mock.calls).toEqual([
      [-80, 100],
      [-80, 10],
    ]);
    expect(context.lineTo.mock.calls).toEqual([
      [-80, 10],
      [0, 11],
      [80, 12],
      [160, 13],
      [160, 100],
      [0, 11],
      [80, 12],
      [160, 13],
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

  it('draws crossing segments when only one point is visible', () => {
    const context = renderRange({ from: 1, to: 2 });
    expect(context.moveTo).toHaveBeenCalledWith(-80, 10);
    expect(context.lineTo).toHaveBeenCalledWith(80, 12);
    expect(context.stroke).toHaveBeenCalledTimes(1);
  });

  it('uses logical time gaps when rebuilding neighboring coordinates', () => {
    const context = renderRange({ from: 1, to: 3 }, [0, 3, 4, 7]);
    expect(context.moveTo).toHaveBeenCalledWith(-240, 10);
    expect(context.lineTo).toHaveBeenCalledWith(320, 13);
  });

  it('draws the tail marker only when the series tail is in the visible range', () => {
    const context = renderRange({ from: 2, to: 4 });
    expect(context.arc).toHaveBeenCalledWith(300, 13, 5.5, 0, Math.PI * 2);
  });

  it.each([null, { from: 2, to: 2 }])(
    'does not draw retained coordinates when no points are visible (%j)',
    (range) => {
      const context = renderRange(range);
      expect(context.stroke).not.toHaveBeenCalled();
      expect(context.clip).not.toHaveBeenCalled();
      expect(context.arc).not.toHaveBeenCalled();
    },
  );
});
