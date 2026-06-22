import type {
  IPerpsAssetCtx,
  IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid';
import { XYZ_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import {
  buildPerpsAssetCtxsByDexFromAllDexsSnapshot,
  buildPerpsTokenSelectorInitialList,
} from './tokenSelectorInitialListCache';

function buildUniverse({
  name,
  assetId,
  isDelisted = false,
}: {
  name: string;
  assetId: number;
  isDelisted?: boolean;
}) {
  return {
    name,
    assetId,
    maxLeverage: 10,
    isDelisted,
  } as IPerpsUniverse;
}

function buildAssetCtx(dayNtlVlm: string) {
  return {
    dayNtlVlm,
  } as IPerpsAssetCtx;
}

describe('tokenSelectorInitialListCache', () => {
  it('sorts the fallback list by the default volume snapshot', () => {
    const result = buildPerpsTokenSelectorInitialList({
      assetsByDex: [
        [
          buildUniverse({ name: 'LOW', assetId: 0 }),
          buildUniverse({ name: 'HIGH', assetId: 1 }),
        ],
        [
          buildUniverse({ name: 'XYZ', assetId: XYZ_ASSET_ID_OFFSET }),
          buildUniverse({
            name: 'DELISTED',
            assetId: XYZ_ASSET_ID_OFFSET + 1,
            isDelisted: true,
          }),
        ],
      ],
      assetCtxsByDex: [
        [buildAssetCtx('10'), buildAssetCtx('100')],
        [buildAssetCtx('50')],
      ],
      requireDefaultSortSnapshot: true,
    });

    expect(result.map((item) => item.tokenName)).toEqual([
      'HIGH',
      'XYZ',
      'LOW',
    ]);
  });

  it('does not expose a clickable fallback list without sort data', () => {
    expect(
      buildPerpsTokenSelectorInitialList({
        assetsByDex: [[buildUniverse({ name: 'BTC', assetId: 0 })]],
        requireDefaultSortSnapshot: true,
      }),
    ).toEqual([]);
  });

  it('builds ctx arrays from all-dex snapshot cache data', () => {
    const ctxsByDex = buildPerpsAssetCtxsByDexFromAllDexsSnapshot({
      ctxs: [
        ['', [buildAssetCtx('1')]],
        ['xyz', [buildAssetCtx('2')]],
      ],
    });

    expect(ctxsByDex[0]?.[0]?.dayNtlVlm).toBe('1');
    expect(ctxsByDex[1]?.[0]?.dayNtlVlm).toBe('2');
  });
});
