import {
  buildDepthChartGeometry,
  getDepthChartLevel,
  getDepthChartLevelAtPrice,
  updateDepthChartDomain,
} from './perpDepthChartGeometry';

describe('Perp depth chart geometry', () => {
  it('uses actual price distances and selects the actionable step on either side of the spread', () => {
    const geometry = buildDepthChartGeometry({
      bids: [
        { price: '99', cumSize: '2' },
        { price: '97', cumSize: '5' },
        { price: '90', cumSize: '8' },
      ],
      asks: [
        { price: '101', cumSize: '1' },
        { price: '120', cumSize: '9' },
      ],
      width: 300,
      height: 90,
    });

    expect(geometry?.bids.levels.map(({ x }) => x)).toEqual([90, 70, 0]);
    expect(geometry?.bids.stroke).toBe('M 90 70 H 70 V 40 H 0 V 10');
    expect(geometry?.asks.stroke).toBe('M 110 80 H 300 V 0');
    expect(getDepthChartLevel(geometry, 71)).toMatchObject({
      side: 'bid',
      level: { price: '99', cumSize: '2' },
    });
    expect(getDepthChartLevel(geometry, 70)).toMatchObject({
      side: 'bid',
      level: { price: '97', cumSize: '5' },
    });
    expect(getDepthChartLevel(geometry, 100)).toBeUndefined();
    expect(getDepthChartLevel(geometry, 299)).toMatchObject({
      side: 'ask',
      level: { price: '101', cumSize: '1' },
    });
    expect(getDepthChartLevel(geometry, 300)).toMatchObject({
      side: 'ask',
      level: { price: '120', cumSize: '9' },
    });
  });

  it('uses a marker for a single available level and drops invalid values', () => {
    const geometry = buildDepthChartGeometry({
      bids: [
        { price: 'broken', cumSize: '5' },
        { price: '50', cumSize: 'Infinity' },
        { price: '40', cumSize: '0.25' },
      ],
      asks: [],
      width: 200,
      height: 120,
    });

    expect(geometry?.midPrice).toBeUndefined();
    expect(geometry?.asks.levels).toEqual([]);
    expect(geometry?.bids.fill).toBeUndefined();
    expect(geometry?.bids.levels).toMatchObject([
      { price: '40', cumSize: '0.25', x: 100, y: 0 },
    ]);
    expect(getDepthChartLevel(geometry, 100)?.level.price).toBe('40');
    expect(getDepthChartLevel(geometry, 80)).toBeUndefined();
  });

  it('selects a nearby single-level marker and leaves the rest of the spread unselectable', () => {
    const bids = [{ price: '99', cumSize: '2' }];
    const asks = [{ price: '101', cumSize: '1' }];
    const geometry = buildDepthChartGeometry({
      bids,
      asks,
      width: 200,
      height: 90,
    });

    expect(getDepthChartLevel(geometry, -4)?.side).toBe('bid');
    expect(getDepthChartLevel(geometry, 196)?.side).toBe('ask');
    expect(getDepthChartLevel(geometry, 20)).toBeUndefined();

    const narrow = buildDepthChartGeometry({
      bids,
      asks,
      width: 12,
      height: 90,
    });
    expect(getDepthChartLevel(narrow, 7)?.side).toBe('ask');
  });

  it('does not plot a crossed book or a book without valid levels', () => {
    expect(
      buildDepthChartGeometry({
        bids: [{ price: '101', cumSize: '2' }],
        asks: [{ price: '100', cumSize: '1' }],
        width: 200,
        height: 120,
      }),
    ).toBeUndefined();
    expect(
      buildDepthChartGeometry({
        bids: [{ price: '0', cumSize: '1' }],
        asks: [{ price: '100', cumSize: '-1' }],
        width: 200,
        height: 120,
      }),
    ).toBeUndefined();
  });

  it('keeps only the valid side when the other side has inconsistent cumulative levels', () => {
    const asks = [
      { price: '100', cumSize: '3' },
      { price: '102', cumSize: '5' },
    ];
    const badBids = [
      [{ price: '98', cumSize: '1' }],
      [{ price: '99', cumSize: '3' }],
      [{ price: '99.5', cumSize: '3' }],
    ];

    for (const tail of badBids) {
      const geometry = buildDepthChartGeometry({
        bids: [{ price: '99', cumSize: '2' }, ...tail],
        asks,
        width: 200,
        height: 120,
      });

      expect(geometry?.bids.levels).toEqual([]);
      expect(geometry?.asks.levels).toHaveLength(2);
      expect(geometry?.midPrice).toBeUndefined();
    }
  });
});

describe('Perp depth chart domain', () => {
  const bids = [
    { price: '99.95', cumSize: '2' },
    { price: '99.8', cumSize: '12' },
    { price: '99.6', cumSize: '100' },
  ];
  const asks = [
    { price: '100.05', cumSize: '1' },
    { price: '100.2', cumSize: '10' },
    { price: '100.4', cumSize: '200' },
  ];

  it('anchors to the live mid and moves the window only near an edge', () => {
    const initial = updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice: 100,
      priceStep: 0.01,
      now: 0,
    });
    expect(initial).toMatchObject({
      minPrice: 99.75,
      maxPrice: 100.25,
      maxSize: 20,
    });

    const drift = updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice: 100.1,
      priceStep: 0.01,
      now: 10,
      previous: initial,
    });
    expect(drift?.minPrice).toBe(99.75);
    expect(drift?.maxPrice).toBe(100.25);

    const shifted = updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice: 100.21,
      priceStep: 0.01,
      now: 20,
      previous: drift,
    });
    expect(shifted?.minPrice).toBeCloseTo(99.959_475);
    expect(shifted?.maxPrice).toBeCloseTo(100.460_525);
  });

  it('uses only known book prices until a real midpoint becomes available', () => {
    const input = { bids, asks, width: 360, height: 120 };
    const fallback = updateDepthChartDomain({ bids, asks, now: 0 });
    const fallbackGeometry = buildDepthChartGeometry({
      ...input,
      domain: fallback,
    });
    expect(fallbackGeometry?.midPrice).toBeUndefined();
    expect(fallback?.minPrice).toBe(99.6);
    expect(fallback?.maxPrice).toBe(100.4);

    const anchored = updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice: 100,
      now: 100,
      previous: fallback,
    });
    const missingMid = updateDepthChartDomain({
      bids,
      asks,
      now: 200,
      previous: anchored,
    });
    expect(missingMid?.minPrice).toBe(99.75);
    expect(missingMid?.maxPrice).toBe(100.25);
    expect(
      buildDepthChartGeometry({ ...input, domain: missingMid })?.midPrice,
    ).toBeUndefined();
  });

  it('zooms within observed coverage and returns to the default view', () => {
    const thinAsks = [asks[0], { price: '100.16', cumSize: '10' }];
    const input = {
      bids: [bids[0], { price: '99.88', cumSize: '12' }, bids[2]],
      asks: thinAsks,
      referenceMidPrice: 100,
      priceStep: 0.01,
      now: 0,
    };
    const previous = updateDepthChartDomain(input);
    const near = updateDepthChartDomain({
      ...input,
      previous,
      wheelDelta: -100,
    });
    expect(near?.maxPrice).toBeCloseTo(100.16);
    expect(near?.minPrice).toBeCloseTo(99.84);
    const nextSnapshot = updateDepthChartDomain({
      ...input,
      asks,
      previous: near,
      referenceMidPrice: 100.01,
    });
    expect(nextSnapshot?.minPrice).toBe(near?.minPrice);
    expect(nextSnapshot?.maxPrice).toBe(near?.maxPrice);

    const full = updateDepthChartDomain({
      ...input,
      previous: nextSnapshot,
      wheelDelta: 100,
    });
    expect(full?.minPrice).toBe(99.75);
    expect(full?.maxPrice).toBe(100.25);
    expect(
      updateDepthChartDomain({ ...input, previous: full, wheelDelta: 100 }),
    ).toBe(full);
  });

  it('keeps two levels visible at the tightest zoom and ignores unusable zoom-in requests', () => {
    const input = { bids, asks, referenceMidPrice: 100, now: 0 };
    const previous = updateDepthChartDomain(input);
    const near = updateDepthChartDomain({
      ...input,
      previous,
      wheelDelta: -1000,
    });
    expect(near?.minPrice).toBeCloseTo(99.8);
    expect(near?.maxPrice).toBeCloseTo(100.2);
    expect(
      updateDepthChartDomain({ ...input, previous: near, wheelDelta: -500 }),
    ).toBe(near);
    expect(
      updateDepthChartDomain({
        ...input,
        asks: [],
        previous,
        wheelDelta: -100,
      }),
    ).toBe(previous);
    expect(updateDepthChartDomain({ ...input, previous, wheelDelta: 0 })).toBe(
      previous,
    );
    expect(
      updateDepthChartDomain({
        ...input,
        asks: [],
        previous: near,
        wheelDelta: 100,
      })?.maxPrice,
    ).toBe(100.25);
  });

  it('expands immediately and carries a shrink deadline across fresh snapshots', () => {
    const input = { bids, asks, referenceMidPrice: 100 };
    const initial = updateDepthChartDomain({ ...input, now: 0 });
    const bigger = updateDepthChartDomain({
      ...input,
      asks: [{ price: '100.05', cumSize: '35' }],
      now: 10,
      previous: initial,
    });
    expect(bigger?.maxSize).toBe(40);

    const pending = updateDepthChartDomain({
      ...input,
      now: 100,
      previous: bigger,
    });
    expect(pending?.maxSize).toBe(40);
    expect(pending?.shrinkAt).toBeGreaterThan(100);

    const fresh = updateDepthChartDomain({
      ...input,
      now: 1000,
      previous: pending,
    });
    expect(fresh?.shrinkAt).toBe(pending?.shrinkAt);
    expect(fresh?.maxSize).toBe(40);

    const rebounded = updateDepthChartDomain({
      ...input,
      asks: [{ price: '100.05', cumSize: '35' }],
      now: 1100,
      previous: fresh,
    });
    expect(rebounded?.shrinkAt).toBeUndefined();

    const settled = updateDepthChartDomain({
      ...input,
      now: 3000,
      previous: fresh,
    });
    expect(settled?.maxSize).toBe(20);
    expect(settled?.shrinkAt).toBeUndefined();
  });

  it('clips known steps at both window edges without reaching beyond measured prices', () => {
    const input = {
      bids: [
        { price: '99', cumSize: '2' },
        { price: '97', cumSize: '6' },
        { price: '95', cumSize: '9' },
      ],
      asks: [
        { price: '101', cumSize: '1' },
        { price: '103', cumSize: '4' },
        { price: '105', cumSize: '8' },
      ],
      width: 360,
      height: 120,
    };
    const geometry = buildDepthChartGeometry({
      ...input,
      referenceMidPrice: 100,
      domain: { minPrice: 98, maxPrice: 104, maxSize: 12 },
    });
    expect(geometry?.midPrice).toBe(100);
    expect(geometry?.bids.stroke).toBe('M 60 100 H 0 V 100');
    expect(geometry?.asks.stroke).toBe('M 180 110 H 300 V 80 H 360 V 80');
    expect(getDepthChartLevelAtPrice(geometry, 98)).toMatchObject({
      price: 98,
      level: { price: '99', cumSize: '2' },
    });
    expect(getDepthChartLevelAtPrice(geometry, 100)).toBeUndefined();
    expect(getDepthChartLevelAtPrice(geometry, 104)).toMatchObject({
      price: 104,
      level: { price: '103', cumSize: '4' },
    });
    expect(getDepthChartLevelAtPrice(geometry, 104.1)).toBeUndefined();

    const askWindow = buildDepthChartGeometry({
      ...input,
      domain: { minPrice: 102, maxPrice: 106, maxSize: 12 },
    });
    expect(askWindow?.midPrice).toBeUndefined();
    expect(askWindow?.bids.levels).toEqual([]);
    expect(getDepthChartLevelAtPrice(askWindow, 102)).toMatchObject({
      price: 102,
      level: { price: '101', cumSize: '1' },
    });
    expect(getDepthChartLevelAtPrice(askWindow, 105.1)).toBeUndefined();
  });

  it('keeps the live cumulative amount at the same selected price after a depth update', () => {
    const domain = { minPrice: 98, maxPrice: 104, maxSize: 12 };
    const input = { bids: [], width: 360, height: 120, domain };
    const original = buildDepthChartGeometry({
      ...input,
      asks: [
        { price: '101', cumSize: '1' },
        { price: '103', cumSize: '4' },
      ],
    });
    const updated = buildDepthChartGeometry({
      ...input,
      asks: [
        { price: '101', cumSize: '1' },
        { price: '102', cumSize: '5' },
        { price: '103', cumSize: '7' },
      ],
    });

    expect(getDepthChartLevelAtPrice(original, 102.5)?.level.cumSize).toBe('1');
    expect(getDepthChartLevelAtPrice(updated, 102.5)).toMatchObject({
      side: 'ask',
      price: 102.5,
      level: { price: '102', cumSize: '5' },
    });
    expect(getDepthChartLevelAtPrice(updated, 101.5)?.level.cumSize).toBe('1');
    expect(getDepthChartLevelAtPrice(updated, 103.1)).toBeUndefined();
  });
});
