import { SPOT_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import {
  buildCoinFromSearchAssetType,
  getDexAssetIdOffset,
  getDexIndexByAssetId,
  getDexIndexByCoin,
  isPerpsUniverseCacheComplete,
  normalizeDexCoin,
  toAssetId,
  toCtxIndex,
} from './perpsDexUtils';

describe('perpsDexUtils', () => {
  it('maps local dex index to the hyperliquid assetId offset', () => {
    expect(getDexAssetIdOffset(0)).toBe(0);
    expect(getDexAssetIdOffset(1)).toBe(110_000);
    expect(getDexAssetIdOffset(2)).toBe(180_000);
  });

  it('falls back to the main dex offset for unknown dex index', () => {
    expect(getDexAssetIdOffset(99)).toBe(0);
    expect(getDexAssetIdOffset(-1)).toBe(0);
  });

  it('resolves the local dex index from a prefixed coin', () => {
    expect(getDexIndexByCoin('BTC')).toBe(0);
    expect(getDexIndexByCoin('xyz:NVDA')).toBe(1);
    expect(getDexIndexByCoin('para:UNITREE')).toBe(2);
  });

  it('does not treat an unregistered prefix as a sub dex', () => {
    expect(getDexIndexByCoin('flx:TSLA')).toBe(0);
  });

  it('resolves the local dex index from an assetId range', () => {
    expect(getDexIndexByAssetId(0)).toBe(0);
    expect(getDexIndexByAssetId(231)).toBe(0);
    expect(getDexIndexByAssetId(110_000)).toBe(1);
    expect(getDexIndexByAssetId(110_104)).toBe(1);
    expect(getDexIndexByAssetId(180_000)).toBe(2);
    expect(getDexIndexByAssetId(180_019)).toBe(2);
  });

  it('does not classify a spot assetId as a perp dex asset', () => {
    expect(getDexIndexByAssetId(SPOT_ASSET_ID_OFFSET)).toBe(-1);
    expect(getDexIndexByAssetId(SPOT_ASSET_ID_OFFSET + 149)).toBe(-1);
  });

  // Hyperliquid dex indexes are non-contiguous (xyz=1 ... para=8), so the
  // registered offsets leave gaps that belong to dexs we do not support.
  it('rejects an assetId belonging to an unregistered sub dex', () => {
    expect(getDexIndexByAssetId(150_000)).toBe(-1);
    expect(getDexIndexByAssetId(120_000)).toBe(-1);
    expect(getDexIndexByAssetId(190_000)).toBe(-1);
  });

  it('treats a negative sentinel assetId as the main dex', () => {
    expect(getDexIndexByAssetId(-1)).toBe(0);
    expect(toCtxIndex(-1)).toBe(-1);
  });

  it('converts assetId to the per-dex ctx array index', () => {
    expect(toCtxIndex(5)).toBe(5);
    expect(toCtxIndex(110_003)).toBe(3);
    expect(toCtxIndex(180_019)).toBe(19);
  });

  it('honours an explicitly supplied dex index over detection', () => {
    expect(toCtxIndex(180_019, 2)).toBe(19);
    expect(toCtxIndex(7, 0)).toBe(7);
  });

  it('builds the assetId from a local dex index and universe position', () => {
    expect(toAssetId({ dexIndex: 0, index: 5 })).toBe(5);
    expect(toAssetId({ dexIndex: 1, index: 3 })).toBe(110_003);
    expect(toAssetId({ dexIndex: 2, index: 19 })).toBe(180_019);
  });

  it('round-trips assetId through ctx index for every registered dex', () => {
    [0, 1, 2].forEach((dexIndex) => {
      const assetId = toAssetId({ dexIndex, index: 4 });
      expect(getDexIndexByAssetId(assetId)).toBe(dexIndex);
      expect(toCtxIndex(assetId)).toBe(4);
    });
  });

  it('normalizes a sub dex coin without touching its prefix case', () => {
    expect(normalizeDexCoin('para:unitree')).toBe('para:UNITREE');
    expect(normalizeDexCoin('PARA:UNITREE')).toBe('para:UNITREE');
    expect(normalizeDexCoin('xyz:nvda')).toBe('xyz:NVDA');
    expect(normalizeDexCoin('btc')).toBe('BTC');
    expect(normalizeDexCoin('@149')).toBe('@149');
    expect(normalizeDexCoin('')).toBe('');
  });

  it('does not rewrite an unregistered prefix', () => {
    expect(normalizeDexCoin('unsupported:tsla')).toBe('UNSUPPORTED:TSLA');
  });

  // The search API sends the dex prefix verbatim in `assetType` ('perps' for
  // the main DEX), so the client must not assume every non-main result is xyz.
  describe('buildCoinFromSearchAssetType', () => {
    it('keeps the bare symbol for a main dex result', () => {
      expect(
        buildCoinFromSearchAssetType({ assetType: 'perps', name: 'BTC' }),
      ).toBe('BTC');
    });

    it('uses the returned prefix instead of assuming xyz', () => {
      expect(
        buildCoinFromSearchAssetType({ assetType: 'xyz', name: 'NVDA' }),
      ).toBe('xyz:NVDA');
      expect(
        buildCoinFromSearchAssetType({ assetType: 'para', name: 'UNITREE' }),
      ).toBe('para:UNITREE');
    });

    it('rejects a dex the client does not support', () => {
      expect(
        buildCoinFromSearchAssetType({ assetType: 'flx', name: 'TSLA' }),
      ).toBeUndefined();
    });

    it('rejects a missing assetType or name', () => {
      expect(
        buildCoinFromSearchAssetType({ assetType: undefined, name: 'BTC' }),
      ).toBeUndefined();
      expect(
        buildCoinFromSearchAssetType({ assetType: 'perps', name: '' }),
      ).toBeUndefined();
    });
  });

  describe('isPerpsUniverseCacheComplete', () => {
    it('accepts a cache covering every registered dex', () => {
      expect(isPerpsUniverseCacheComplete([[{}], [{}], [{}]])).toBe(true);
    });

    // The bug this guards: a cache written before `para` was registered has
    // only two slots, still looks populated, and silently hides the new dex.
    it('rejects a cache written before a sub dex was registered', () => {
      expect(isPerpsUniverseCacheComplete([[{}], [{}]])).toBe(false);
    });

    // A refresh that only returned the main dex used to leave the sub-dex slots
    // empty, and the reverse — a main-dex fetch failure — must not read as
    // complete either, since nothing else forces a retry on the home surfaces.
    it('rejects a cache whose main dex slot is empty', () => {
      expect(isPerpsUniverseCacheComplete([[], [{}], [{}]])).toBe(false);
    });

    // `[main, xyz, []]` is what a response that omits one dex persists when no
    // previous slot exists to preserve; accepting it would hide that dex.
    it('rejects a cache whose registered sub dex slot is empty', () => {
      expect(isPerpsUniverseCacheComplete([[{}], [{}], []])).toBe(false);
      expect(isPerpsUniverseCacheComplete([[{}], [], [{}]])).toBe(false);
    });

    it('rejects an empty or missing cache', () => {
      expect(isPerpsUniverseCacheComplete([])).toBe(false);
      expect(isPerpsUniverseCacheComplete(undefined)).toBe(false);
      expect(isPerpsUniverseCacheComplete([[], [], []])).toBe(false);
    });

    it('accepts a longer cache so an unknown extra slot is not fatal', () => {
      expect(isPerpsUniverseCacheComplete([[{}], [{}], [{}], [{}]])).toBe(true);
    });
  });
});
