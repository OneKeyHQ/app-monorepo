import { selectPerpMetasByDex } from './perpMetaSelection';

function buildMeta(firstCoin: string) {
  return { universe: [{ name: firstCoin }] };
}

// Hyperliquid returns one meta per perp dex index. Only slot 0 (main) and the
// registered sub-dex slots matter here; the rest stand in for dexs we do not
// support, so their names are placeholders.
function buildAllMetas({
  slot8,
}: {
  slot8: string;
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
  ];
}

describe('perpMetaSelection', () => {
  it('picks main and registered sub dexs by their hyperliquid index', () => {
    const result = selectPerpMetasByDex(
      buildAllMetas({ slot8: 'para:TOTAL2' }),
    );

    expect(result).toHaveLength(3);
    expect(result[0]?.universe[0].name).toBe('BTC');
    expect(result[1]?.universe[0].name).toBe('xyz:XYZ100');
    expect(result[2]?.universe[0].name).toBe('para:TOTAL2');
  });

  it('leaves a slot undefined when the server has not deployed that dex yet', () => {
    const result = selectPerpMetasByDex([buildMeta('BTC'), buildMeta('xyz:X')]);

    expect(result).toHaveLength(3);
    expect(result[1]?.universe[0].name).toBe('xyz:X');
    expect(result[2]).toBeUndefined();
  });

  it('returns an empty array when the server returns nothing', () => {
    expect(selectPerpMetasByDex([])).toEqual([]);
  });

  it('drops a slot whose universe does not carry the expected prefix', () => {
    const shifted = selectPerpMetasByDex(
      buildAllMetas({ slot8: 'other8:A' }),
    );

    expect(shifted[1]?.universe[0].name).toBe('xyz:XYZ100');
    expect(shifted[2]).toBeUndefined();
  });
});
