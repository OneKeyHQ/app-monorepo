import { markPerpsColdStartPerf } from '@onekeyhq/shared/src/performance/perpsColdStartPerf';
import {
  DEX_SEPARATOR,
  SUB_DEX_LIST,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

interface IPerpMetaLike {
  universe?: { name: string }[];
}

// `allPerpMetas()` is indexed by the hyperliquid perp dex index, so a sub-DEX
// must be picked by that index, never by position after a slice. The prefix
// assertion turns an upstream index shift into an empty slot rather than a
// whole dex of mislabelled assets.
export function selectPerpMetasByDex<T extends IPerpMetaLike>(
  allMetas: (T | null | undefined)[],
): (T | undefined)[] {
  if (!allMetas?.length) return [];
  return [
    allMetas[0] ?? undefined,
    ...SUB_DEX_LIST.map((item) => {
      const meta = allMetas[item.hlDexIndex] ?? undefined;
      const firstName = meta?.universe?.[0]?.name;
      if (
        firstName &&
        !firstName.startsWith(`${item.prefix}${DEX_SEPARATOR}`)
      ) {
        // Otherwise invisible until users report missing markets.
        markPerpsColdStartPerf('service_perp_meta_dex_prefix_mismatch', {
          prefix: item.prefix,
          hlDexIndex: item.hlDexIndex,
          firstName,
        });
        return undefined;
      }
      return meta;
    }),
  ];
}

// A dex the server skipped arrives as `undefined`; persisting it as empty would
// destroy the last good data behind a full-length, apparently complete cache.
export function mergePerpDexSlots<T>(
  nextByDex: (T | undefined)[],
  previousByDex: readonly (T | undefined)[] | undefined,
): (T | undefined)[] {
  return nextByDex.map((value, dexIndex) => value ?? previousByDex?.[dexIndex]);
}
