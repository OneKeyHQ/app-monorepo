import { markPerpsColdStartPerf } from '@onekeyhq/shared/src/performance/perpsColdStartPerf';
import {
  DEX_SEPARATOR,
  SUB_DEX_LIST,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

interface IPerpMetaLike {
  universe?: { name: string }[];
}

// `allPerpMetas()` is indexed by the hyperliquid perp dex index, so a sub-DEX
// must be picked by that index — never by array position after a slice.
// The prefix assertion turns a silent index shift on hyperliquid's side into an
// empty slot instead of a whole dex of mislabelled assets.
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
        // Losing a whole dex is otherwise invisible until users report it.
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

// `selectPerpMetasByDex` pads every registered dex into a slot, so a dex the
// server skipped arrives as `undefined`. Persisting that as empty would destroy
// the last good data while still leaving a full-length — and therefore
// apparently complete — cache behind.
export function mergePerpDexSlots<T>(
  nextByDex: (T | undefined)[],
  previousByDex: readonly (T | undefined)[] | undefined,
): (T | undefined)[] {
  return nextByDex.map((value, dexIndex) => value ?? previousByDex?.[dexIndex]);
}
