import { getDataWindowSnapshot } from './dataWindow';

const points = [
  { t: 1_700_000_000, o: 10, h: 15, l: 8, c: 12, v: 100 },
  { t: 1_700_000_060, o: 12, h: 18, l: 11, c: 15, v: 250 },
];

it('uses the crosshair candle and its aligned indicator values, falling back to the latest candle', () => {
  const options = {
    points,
    subIndicatorPanes: [],
    indicatorSeries: [
      {
        key: 'MA7',
        indicator: 'MA' as const,
        kind: 'line' as const,
        paint: 'indicatorCyanStroke' as const,
        values: [11, 14],
        legendLabel: 'MA 7',
      },
    ],
  };
  const selected = getDataWindowSnapshot({ ...options, pointIndex: 0 });
  expect(selected?.time).toBe(points[0].t);
  expect(
    selected?.groups[0].rows.find((row) => row.name === 'Close')?.value,
  ).toBe(12);
  expect(selected?.groups[1].rows[0].value).toBe(11);
  const latest = getDataWindowSnapshot({ ...options, pointIndex: null });
  expect(latest?.time).toBe(points[1].t);
  expect(latest?.historical).toBe(false);
  expect(
    latest?.groups[0].rows.find((row) => row.name === 'Change %')?.value,
  ).toBe(25);
  expect(latest?.groups[1].rows[0].value).toBe(14);
  expect(
    getDataWindowSnapshot({ ...options, points: [], pointIndex: null }),
  ).toBeNull();
});
