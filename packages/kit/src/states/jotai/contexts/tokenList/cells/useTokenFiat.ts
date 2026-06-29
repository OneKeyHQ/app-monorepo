/**
 * TokenList cells — `useTokenFiat($key)` stable seam (spec §3.1, §5).
 *
 * The single, stable hook leaves read per-key fiat through. Phase-1/2 the
 * signature does not change; the底座 (who writes the cell) can be swapped under
 * it. `isAgg` branches to the derived aggregate cell, mirroring the current
 * leaf fallback `tokenListMap[$key] ?? flattenAggregateMap[$key]`,
 * per-key-ified.
 *
 * NOTE (spec §5): this seam is the HOME path only. The TokenSelector
 * `contextTokenListMap` override is NOT migrated here — leaves are NOT wired in
 * Slice 1.
 */
import { useAtomValue } from 'jotai';

import { isAgg } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { useTokenListContextData } from '../atoms';

import { aggCell, cell, meta } from './projection';

const EMPTY_FIAT: ITokenFiat | undefined = undefined;

/**
 * Read the fiat frame for a `$key` from the per-store cell registry. Aggregate
 * keys resolve through the derived `aggCell`; normal keys through `cell`.
 */
export function useTokenFiat($key: string): ITokenFiat | undefined {
  // useTokenListContextData throws when no store is mounted, so `store` is
  // always defined here; the non-null assertion satisfies the optional context
  // type without a runtime branch.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const store = useTokenListContextData().store!;
  // Resolve aggregate identity from the meta cell's stamped field, prefix
  // fallback (spec §4.0). meta() is the lazily-built per-key meta cell.
  const metaValue: IToken | undefined = useAtomValue(meta(store, $key), {
    store,
  });
  const aggregate = isAgg($key, metaValue);

  const fiat = useAtomValue(
    aggregate ? aggCell(store, $key) : cell(store, $key),
    { store },
  );

  return fiat ?? EMPTY_FIAT;
}
