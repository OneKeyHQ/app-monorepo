import {
  buildDepthChartGeometry,
  getDepthChartHoverSelections,
  getDepthChartLevel,
  getDepthChartLevelAtPrice,
  updateDepthChartDomain,
} from './perpDepthChartGeometry';

describe('Perp depth chart geometry', () => {
  it('compares both sides at the same cursor distance and snaps to real levels', () => {
    const geometry = buildDepthChartGeometry({
      bids: [
        { price: '99', cumSize: '2' },
        { price: '97', cumSize: '6' },
        { price: '90', cumSize: '10' },
      ],
      asks: [
        { price: '101', cumSize: '1' },
        { price: '104', cumSize: '4' },
        { price: '110', cumSize: '20' },
      ],
      referenceMidPrice: 100,
      width: 200,
      height: 100,
    });
    expect(geometry).toBeDefined();
    if (!geometry) return;
    const selections = getDepthChartHoverSelections(geometry, 150);
    expect(selections).toMatchObject([
      { side: 'bid', price: 97, level: { cumSize: '6', x: 70 } },
      { side: 'ask', price: 104, level: { cumSize: '4', x: 140 } },
    ]);
    expect(getDepthChartHoverSelections(geometry, 50)).toEqual(selections);
    expect(getDepthChartHoverSelections(geometry, 100)).toEqual([]);
    expect(getDepthChartHoverSelections(geometry, -1)).toEqual([]);
    expect(getDepthChartHoverSelections(geometry, 201)).toEqual([]);
    expect(getDepthChartHoverSelections(geometry, Number.NaN)).toEqual([]);
  });

  it('selects paired terminal quotes just inside either plot edge', () => {
    const book = {
      bids: [
        { price: '99.9', cumSize: '1' },
        { price: '99.8', cumSize: '2' },
      ],
      asks: [
        { price: '100.1', cumSize: '3' },
        { price: '100.2', cumSize: '4' },
      ],
      referenceMidPrice: 100,
    };
    const geometry = buildDepthChartGeometry({
      ...book,
      domain: updateDepthChartDomain({ ...book, now: 0 }),
      width: 320,
      height: 100,
    });
    expect(geometry).toBeDefined();
    if (!geometry) return;

    for (const x of [0, 0.001, 8, 312, 319.999, 320]) {
      expect(getDepthChartHoverSelections(geometry, x)).toMatchObject([
        { side: 'bid', price: 99.8, level: { cumSize: '2' } },
        { side: 'ask', price: 100.2, level: { cumSize: '4' } },
      ]);
    }
    for (const x of [8.0001, 9, 311, 311.9999]) {
      expect(getDepthChartHoverSelections(geometry, x)).toMatchObject([
        { side: 'bid', price: 99.9, level: { cumSize: '1' } },
        { side: 'ask', price: 100.1, level: { cumSize: '3' } },
      ]);
    }
    for (const x of [-0.001, 160, 320.001]) {
      expect(getDepthChartHoverSelections(geometry, x)).toEqual([]);
    }
    expect(getDepthChartLevelAtPrice(geometry, 100.199)).toMatchObject({
      side: 'ask',
      level: { price: '100.1', cumSize: '3' },
    });
  });

  it('selects a real terminal quote affected by viewport rounding', () => {
    const book = {
      bids: [
        { price: '100.00', cumSize: '1' },
        { price: '99.98', cumSize: '2' },
      ],
      asks: [
        { price: '100.01', cumSize: '3' },
        { price: '100.03', cumSize: '4' },
      ],
      referenceMidPrice: 100.005,
    };
    const input = { ...book, width: 320, height: 100 };
    const geometry = buildDepthChartGeometry({
      ...input,
      domain: updateDepthChartDomain({ ...book, now: 0 }),
    });
    expect(geometry).toBeDefined();
    if (!geometry) return;

    expect(geometry.minPrice).toBeLessThan(99.98);
    expect(geometry.bids.levels.at(-1)?.x).toBe(0);
    expect(getDepthChartHoverSelections(geometry, 319.999)).toMatchObject([
      { side: 'bid', price: 99.98, level: { cumSize: '2' } },
      { side: 'ask', price: 100.03, level: { cumSize: '4' } },
    ]);

    const interior = buildDepthChartGeometry({
      ...input,
      domain: { minPrice: 99.98 - 1e-8, maxPrice: 100.03, maxSize: 5 },
    });
    expect(interior).toBeDefined();
    if (!interior) return;
    expect(interior.bids.levels.at(-1)?.x).toBe(0);
    expect(getDepthChartHoverSelections(interior, 319.999)).toMatchObject([
      { side: 'bid', price: 100, level: { cumSize: '1' } },
      { side: 'ask', price: 100.03, level: { cumSize: '4' } },
    ]);
  });

  it('limits a single-sided edge hit to half the neighboring step width', () => {
    const input = {
      bids: [],
      asks: [
        { price: '100.1', cumSize: '3' },
        { price: '100.2', cumSize: '4' },
      ],
      width: 60,
      height: 100,
    };
    const geometry = buildDepthChartGeometry({
      ...input,
      domain: { minPrice: 99.2, maxPrice: 100.2, maxSize: 4 },
    });
    expect(geometry).toBeDefined();
    if (!geometry) return;

    for (const x of [57, 59.999]) {
      expect(getDepthChartHoverSelections(geometry, x)).toMatchObject([
        { side: 'ask', price: 100.2, level: { cumSize: '4' } },
      ]);
    }
    for (const x of [54, 56.999]) {
      expect(getDepthChartHoverSelections(geometry, x)).toMatchObject([
        { side: 'ask', price: 100.1, level: { cumSize: '3' } },
      ]);
    }
    for (const x of [53.999, 60.001]) {
      expect(getDepthChartHoverSelections(geometry, x)).toEqual([]);
    }

    const withUncoveredEdge = buildDepthChartGeometry({
      ...input,
      domain: { minPrice: 99.2, maxPrice: 100.24, maxSize: 4 },
    });
    expect(withUncoveredEdge).toBeDefined();
    if (!withUncoveredEdge) return;
    expect(getDepthChartHoverSelections(withUncoveredEdge, 59)).toEqual([]);
  });

  it('does not fabricate hover data beyond the opposite side coverage', () => {
    const geometry = buildDepthChartGeometry({
      bids: [
        { price: '99', cumSize: '2' },
        { price: '90', cumSize: '10' },
      ],
      asks: [
        { price: '101', cumSize: '1' },
        { price: '104', cumSize: '4' },
      ],
      domain: { minPrice: 90, maxPrice: 110, maxSize: 12 },
      referenceMidPrice: 100,
      width: 200,
      height: 100,
    });
    expect(geometry).toBeDefined();
    if (!geometry) return;
    expect(getDepthChartHoverSelections(geometry, 180)).toMatchObject([
      { side: 'bid', price: 99, level: { cumSize: '2' } },
    ]);
  });

  it('hits paired single-level markers within eight pixels from either side', () => {
    const geometry = buildDepthChartGeometry({
      bids: [{ price: '99', cumSize: '2' }],
      asks: [{ price: '101', cumSize: '3' }],
      referenceMidPrice: 100,
      width: 200,
      height: 100,
    });
    expect(geometry).toBeDefined();
    if (!geometry) return;
    const expected = [
      { side: 'bid', price: 99, level: { cumSize: '2' } },
      { side: 'ask', price: 101, level: { cumSize: '3' } },
    ];
    for (const x of [-8, 8, 192, 208]) {
      expect(getDepthChartHoverSelections(geometry, x)).toMatchObject(expected);
    }
    for (const x of [-9, 9, 100, 191, 209]) {
      expect(getDepthChartHoverSelections(geometry, x)).toEqual([]);
    }
  });

  it('smooths both sides through every real level without overshooting neighboring sizes', () => {
    const geometry = buildDepthChartGeometry({
      bids: [
        { price: '99', cumSize: '1' },
        { price: '98', cumSize: '20' },
        { price: '95', cumSize: '21' },
        { price: '90', cumSize: '22' },
      ],
      asks: [
        { price: '101', cumSize: '2' },
        { price: '103', cumSize: '3' },
        { price: '104', cumSize: '25' },
        { price: '110', cumSize: '26' },
      ],
      referenceMidPrice: 100,
      width: 1000,
      height: 500,
    });
    expect(geometry).toBeDefined();
    for (const side of [geometry?.bids, geometry?.asks]) {
      const curves = Array.from(
        (side?.stroke ?? '').matchAll(
          /C ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/g,
        ),
      );
      expect(curves).toHaveLength(3);
      curves.forEach((curve, index) => {
        const [cp1x, cp1y, cp2x, cp2y, x, y] = curve.slice(1).map(Number);
        const start = side?.levels[index];
        const end = side?.levels[index + 1];
        expect(start).toBeDefined();
        expect(end).toBeDefined();
        if (!start || !end) return;
        expect(x).toBeCloseTo(end.x, 3);
        expect(y).toBeCloseTo(end.y, 3);
        for (let step = 0; step <= 10; step += 1) {
          const t = step / 10;
          const u = 1 - t;
          const sample = (a: number, b: number, c: number, d: number) =>
            u ** 3 * a + 3 * u ** 2 * t * b + 3 * u * t ** 2 * c + t ** 3 * d;
          const sampleX = sample(start.x, cp1x, cp2x, x);
          const sampleY = sample(start.y, cp1y, cp2y, y);
          expect(sampleX).toBeGreaterThanOrEqual(
            Math.min(start.x, end.x) - 0.001,
          );
          expect(sampleX).toBeLessThanOrEqual(Math.max(start.x, end.x) + 0.001);
          expect(sampleY).toBeGreaterThanOrEqual(
            Math.min(start.y, end.y) - 0.001,
          );
          expect(sampleY).toBeLessThanOrEqual(Math.max(start.y, end.y) + 0.001);
        }
      });
    }
  });

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
    expect(geometry?.bids.stroke).toMatch(/^M 90 70 C .+ 70 40 C .+ 0 10$/);
    expect(geometry?.asks.stroke).toMatch(/^M 110 80 C .+ 300 0$/);
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

  it('joins both curves at the midpoint baseline without inventing selectable spread levels', () => {
    const geometry = buildDepthChartGeometry({
      bids: [
        { price: '99', cumSize: '4' },
        { price: '97', cumSize: '8' },
      ],
      asks: [
        { price: '101', cumSize: '1' },
        { price: '103', cumSize: '10' },
      ],
      referenceMidPrice: 100,
      width: 300,
      height: 100,
    });
    expect(geometry?.toX(100)).toBe(150);
    expect(geometry?.bids.stroke).toMatch(/^M 150 100 H 100 V 60 C .+ 0 20$/);
    expect(geometry?.asks.stroke).toMatch(/^M 150 100 H 200 V 90 C .+ 300 0$/);
    expect(geometry?.bids.levels).toHaveLength(2);
    expect(geometry?.asks.levels).toHaveLength(2);
    for (const price of [99.5, 100, 100.5]) {
      expect(getDepthChartLevelAtPrice(geometry, price)).toBeUndefined();
    }
    expect(getDepthChartLevel(geometry, 150)).toBeUndefined();
    expect(getDepthChartLevelAtPrice(geometry, 99)?.level.cumSize).toBe('4');
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
  const fineBook = (count: number) => ({
    bids: Array.from({ length: count }, (_, index) => ({
      price: (1638.6 - index * 0.1).toFixed(1),
      cumSize: String(index + 1),
    })),
    asks: Array.from({ length: count }, (_, index) => ({
      price: (1638.7 + index * 0.1).toFixed(1),
      cumSize: String(index + 1),
    })),
    referenceMidPrice: 1638.65,
  });

  it('fits all twenty full-precision levels into the default viewport', () => {
    const input = fineBook(20);
    const domain = updateDepthChartDomain({ ...input, now: 0 });
    const geometry = buildDepthChartGeometry({
      ...input,
      domain,
      width: 1000,
      height: 500,
    });
    expect(domain?.minPrice).toBeCloseTo(1636.7);
    expect(domain?.maxPrice).toBeCloseTo(1640.6);
    expect(geometry?.bids.levels).toHaveLength(20);
    expect(geometry?.asks.levels).toHaveLength(20);
    expect(geometry?.bids.levels.at(-1)?.x).toBeCloseTo(0);
    expect(geometry?.asks.levels.at(-1)?.x).toBeCloseTo(1000);
  });

  it('removes margins as coverage contracts and preserves manual zoom', () => {
    const initial = updateDepthChartDomain({ ...fineBook(20), now: 0 });
    const minor = updateDepthChartDomain({
      ...fineBook(19),
      previous: initial,
      now: 100,
    });
    expect(minor?.minPrice).toBeCloseTo(1636.8);
    expect(minor?.maxPrice).toBeCloseTo(1640.5);
    const sparse = updateDepthChartDomain({
      ...fineBook(10),
      previous: minor,
      now: 200,
    });
    expect(sparse?.maxPrice).toBeCloseTo(1639.6);
    const expanded = updateDepthChartDomain({
      ...fineBook(20),
      previous: sparse,
      now: 300,
    });
    expect(expanded?.maxPrice).toBeCloseTo(1640.6);
    const zoomed = updateDepthChartDomain({
      ...fineBook(20),
      previous: expanded,
      wheelDelta: -240,
      now: 400,
    });
    expect(zoomed?.isZoomed).toBe(true);
    const update = updateDepthChartDomain({
      ...fineBook(20),
      previous: zoomed,
      now: 500,
    });
    expect(update?.priceRangeRatio).toBe(zoomed?.priceRangeRatio);
    const restored = updateDepthChartDomain({
      ...fineBook(20),
      previous: update,
      wheelDelta: 240,
      now: 600,
    });
    expect(restored?.isZoomed).toBe(false);
    expect(restored?.maxPrice).toBeCloseTo(1640.6);
  });

  it('fills both edges of a centered viewport when side coverage differs', () => {
    const fullBook = fineBook(20);
    const input = { ...fullBook, bids: fullBook.bids.slice(0, 16) };
    const previous = updateDepthChartDomain({ ...fullBook, now: 0 });
    const domain = updateDepthChartDomain({ ...input, previous, now: 100 });
    const geometry = buildDepthChartGeometry({
      ...input,
      domain,
      width: 1000,
      height: 500,
    });

    expect(domain?.minPrice).toBeCloseTo(1637.1);
    expect(domain?.maxPrice).toBeCloseTo(1640.2);
    expect(geometry?.toX(input.referenceMidPrice)).toBeCloseTo(500);
    expect(geometry?.bids.levels.at(-1)?.x).toBeCloseTo(0);
    expect(geometry?.asks.levels.at(-1)?.x).toBeCloseTo(1000);
    expect(geometry?.asks.levels.at(-1)?.price).toBe('1640.2');
  });

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

  it('keeps the live mid centered as prices move in either direction', () => {
    const initial = updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice: 100,
      now: 0,
    });
    expect(initial).toMatchObject({
      minPrice: 99.75,
      maxPrice: 100.25,
      maxSize: 14,
    });

    const drift = updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice: 100.1,
      now: 10,
      previous: initial,
    });
    expect(drift?.minPrice).toBeCloseTo(99.849_75);
    expect(drift?.maxPrice).toBeCloseTo(100.350_25);

    const shifted = updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice: 100.21,
      now: 20,
      previous: drift,
    });
    expect(shifted?.minPrice).toBeCloseTo(99.959_475);
    expect(shifted?.maxPrice).toBeCloseTo(100.460_525);
    let previous = shifted;
    for (const mid of [100.15, 100, 99.9, 99.8]) {
      const domain = updateDepthChartDomain({
        bids,
        asks,
        referenceMidPrice: mid,
        previous,
        now: 30,
      });
      const geometry = buildDepthChartGeometry({
        bids,
        asks,
        referenceMidPrice: mid,
        domain,
        width: 1000,
        height: 500,
      });
      expect(geometry?.toX(mid)).toBeCloseTo(500);
      previous = domain;
    }
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

  it('recovers a single-sided book outside the last anchored window', () => {
    const previous = updateDepthChartDomain({
      bids,
      asks,
      referenceMidPrice: 100,
      now: 0,
    });
    const input = {
      bids: [
        { price: '95', cumSize: '2' },
        { price: '94', cumSize: '12' },
      ],
      asks: [],
    };
    const domain = updateDepthChartDomain({ ...input, previous, now: 1 });
    expect(domain).toMatchObject({
      minPrice: 94,
      maxPrice: 95,
      isZoomed: false,
    });
    expect(domain?.anchorMid).toBeUndefined();
    const geometry = buildDepthChartGeometry({
      ...input,
      domain,
      width: 360,
      height: 120,
    });
    expect(geometry?.bids.levels).toHaveLength(2);
    expect(geometry?.midPrice).toBeUndefined();
  });

  it('recovers both sides of a spread wider than the standard window', () => {
    const input = {
      bids: [
        { price: '99', cumSize: '2' },
        { price: '98', cumSize: '12' },
      ],
      asks: [
        { price: '101', cumSize: '1' },
        { price: '102', cumSize: '10' },
      ],
      referenceMidPrice: 100,
    };
    const domain = updateDepthChartDomain({ ...input, now: 0 });
    const geometry = buildDepthChartGeometry({
      ...input,
      domain,
      width: 360,
      height: 120,
    });
    expect(geometry?.bids.levels).toHaveLength(2);
    expect(geometry?.asks.levels).toHaveLength(2);
    expect(geometry?.toX(100)).toBe(180);
    expect(domain?.isZoomed).toBe(false);
  });

  it('zooms within observed coverage and returns to the default view', () => {
    const thinAsks = [
      asks[0],
      { price: '100.08', cumSize: '5' },
      { price: '100.16', cumSize: '10' },
    ];
    const input = {
      bids: [bids[0], { price: '99.88', cumSize: '12' }, bids[2]],
      asks: thinAsks,
      referenceMidPrice: 100,
      now: 0,
    };
    const previous = updateDepthChartDomain(input);
    const near = updateDepthChartDomain({
      ...input,
      previous,
      wheelDelta: -100,
    });
    expect(near?.maxPrice).toBeCloseTo(100 + 0.16 * Math.exp(-0.25));
    expect(near?.minPrice).toBeCloseTo(100 - 0.16 * Math.exp(-0.25));
    const nextSnapshot = updateDepthChartDomain({
      ...input,
      asks,
      previous: near,
      referenceMidPrice: 100.01,
    });
    expect(nextSnapshot?.priceRangeRatio).toBe(near?.priceRangeRatio);
    expect(nextSnapshot?.anchorMid).toBe(100.01);

    const full = updateDepthChartDomain({
      ...input,
      previous: nextSnapshot,
      wheelDelta: 100,
    });
    expect(full?.minPrice).toBeCloseTo(99.84);
    expect(full?.maxPrice).toBeCloseTo(100.16);
    expect(
      updateDepthChartDomain({ ...input, previous: full, wheelDelta: 100 }),
    ).toBe(full);
  });

  it.each([0.15, 0.2])(
    'clears manual zoom after the default price range contracts to ±%s',
    (offset) => {
      const input = { bids, asks, referenceMidPrice: 100, now: 0 };
      const near = updateDepthChartDomain({
        ...input,
        previous: updateDepthChartDomain(input),
        wheelDelta: -240,
      });
      expect(near?.isZoomed).toBe(true);
      const thin = {
        ...input,
        bids: [
          bids[0],
          { price: '99.9', cumSize: '7' },
          { price: String(100 - offset), cumSize: '12' },
        ],
        asks: [
          asks[0],
          { price: '100.1', cumSize: '5' },
          { price: String(100 + offset), cumSize: '10' },
        ],
      };
      const viewport = updateDepthChartDomain({ ...thin, previous: near });
      expect(viewport?.priceRangeRatio).toBe(near?.priceRangeRatio);
      const restored = updateDepthChartDomain({
        ...thin,
        previous: viewport,
        wheelDelta: 100,
      });
      expect(restored?.isZoomed).toBe(false);
      expect(restored?.priceRangeRatio).toBeCloseTo(offset / 100);
      expect(
        updateDepthChartDomain({
          ...thin,
          previous: restored,
          wheelDelta: 100,
        }),
      ).toBe(restored);
    },
  );

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
    expect(settled?.maxSize).toBe(14);
    expect(settled?.shrinkAt).toBeUndefined();
  });

  it.each([0.001_05, 1.05, 12, 1050, 1_050_000])(
    'fills most of the height with a visible peak of %s',
    (peak) => {
      const domain = updateDepthChartDomain({
        bids: [{ price: '99.9', cumSize: String(peak / 2) }],
        asks: [{ price: '100.1', cumSize: String(peak) }],
        referenceMidPrice: 100,
        now: 0,
      });
      expect(domain).toBeDefined();
      const fillRatio = peak / (domain?.maxSize ?? 1);
      expect(fillRatio).toBeGreaterThanOrEqual(0.8);
      expect(fillRatio).toBeLessThanOrEqual(1 / 1.1);
    },
  );

  it('shrinks after a sustained drop but keeps the scale for small fluctuations', () => {
    const input = {
      bids: [{ price: '99.9', cumSize: '500' }],
      asks: [{ price: '100.1', cumSize: '1400' }],
      referenceMidPrice: 100,
    };
    const initial = updateDepthChartDomain({ ...input, now: 0 });
    expect(initial?.maxSize).toBe(1600);
    const stable = updateDepthChartDomain({
      ...input,
      asks: [{ price: '100.1', cumSize: '1300' }],
      previous: initial,
      now: 100,
    });
    expect(stable).toBe(initial);
    const reduced = { ...input, asks: [{ price: '100.1', cumSize: '1050' }] };
    const pending = updateDepthChartDomain({
      ...reduced,
      previous: stable,
      now: 200,
    });
    expect(pending?.maxSize).toBe(1600);
    expect(pending?.shrinkAt).toBeDefined();
    const settled = updateDepthChartDomain({
      ...reduced,
      previous: pending,
      now: 2000,
    });
    expect(settled?.maxSize).toBe(1200);
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
    expect(geometry?.bids.stroke).toMatch(/^M 120 120 H 60 V 100 C .+ 0 100$/);
    expect(geometry?.asks.stroke).toMatch(
      /^M 120 120 H 180 V 110 C .+ 300 80 C .+ 360 80$/,
    );
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
    if (!geometry) return;
    for (const [x, plotPrice] of [
      [359.999, 103],
      [360, 104],
    ]) {
      expect(getDepthChartHoverSelections(geometry, x)).toMatchObject([
        {
          side: 'ask',
          price: 103,
          level: { price: '103', plotPrice, cumSize: '4' },
        },
      ]);
    }

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
    if (!askWindow) return;
    expect(
      getDepthChartHoverSelections(askWindow, askWindow.toX(102.25)),
    ).toMatchObject([
      {
        side: 'ask',
        price: 102,
        level: { plotPrice: 102, price: '101', cumSize: '1' },
      },
    ]);
    expect(
      getDepthChartHoverSelections(askWindow, askWindow.toX(103.25)),
    ).toMatchObject([
      { side: 'ask', price: 103, level: { price: '103', cumSize: '4' } },
    ]);
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
