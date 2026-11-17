import { mergePerpDexSlots, selectPerpMetasByDex } from './perpMetaSelection';

function buildMeta(firstCoin: string) {
  return { universe: [{ name: firstCoin }] };
}

// One meta per perp dex index; unregistered slots use placeholder names.
function buildAllMetas({
  slot8,
  slot10 = 'io:AAPL',
}: {
  slot8: string;
  slot10?: string;
}): ReturnType<typeof buildMeta>[] {
  return [
    buildMeta('BTC'),
    buildMeta('xyz:XYZ100'),
    buildMeta('other2:A'),
    buildMeta('other3:A'),
    buildMeta('other4:A'),
    buildMeta('other5:A'),
    buildMeta('other6:A'),
    buildMeta('other7:A'),
    buildMeta(slot8),
    buildMeta('other9:A'),
    buildMeta(slot10),
  ];
}

describe('perpMetaSelection', () => {
  it('picks main and registered sub dexs by their hyperliquid index', () => {
    const result = selectPerpMetasByDex(
      buildAllMetas({ slot8: 'para:TOTAL2' }),
    );

    expect(result).toHaveLength(4);
    expect(result[0]?.universe[0].name).toBe('BTC');
    expect(result[1]?.universe[0].name).toBe('xyz:XYZ100');
    expect(result[2]?.universe[0].name).toBe('para:TOTAL2');
    expect(result[3]?.universe[0].name).toBe('io:AAPL');
  });

  it('leaves a slot undefined when the server has not deployed that dex yet', () => {
    const result = selectPerpMetasByDex([buildMeta('BTC'), buildMeta('xyz:X')]);

    expect(result).toHaveLength(4);
    expect(result[1]?.universe[0].name).toBe('xyz:X');
    expect(result[2]).toBeUndefined();
    expect(result[3]).toBeUndefined();
  });

  it('returns an empty array when the server returns nothing', () => {
    expect(selectPerpMetasByDex([])).toEqual([]);
  });

  it('drops a slot whose universe does not carry the expected prefix', () => {
    const shifted = selectPerpMetasByDex(
      buildAllMetas({ slot8: 'other8:A', slot10: 'other10:A' }),
    );

    expect(shifted[1]?.universe[0].name).toBe('xyz:XYZ100');
    expect(shifted[2]).toBeUndefined();
    expect(shifted[3]).toBeUndefined();
  });
});

describe('mergePerpDexSlots', () => {
  // A main-only response used to flatten both sub-dex slots to empty while the
  // padded length still made the cache look complete, so `xyz:NVDA` stopped
  // resolving until some later refresh happened to succeed.
  it('keeps the previous slot for a dex the response omitted', () => {
    const merged = mergePerpDexSlots(
      [['BTC'], undefined, undefined],
      [['BTC'], ['xyz:NVDA'], ['para:UNITREE']],
    );

    expect(merged).toEqual([['BTC'], ['xyz:NVDA'], ['para:UNITREE']]);
  });

  it('lets a present slot overwrite the previous one', () => {
    const merged = mergePerpDexSlots(
      [['BTC', 'ETH'], ['xyz:AAPL'], undefined],
      [['BTC'], ['xyz:NVDA'], ['para:UNITREE']],
    );

    expect(merged).toEqual([['BTC', 'ETH'], ['xyz:AAPL'], ['para:UNITREE']]);
  });

  it('leaves a slot undefined when there is nothing to fall back to', () => {
    expect(mergePerpDexSlots([['BTC'], undefined], undefined)).toEqual([
      ['BTC'],
      undefined,
    ]);
  });
});
