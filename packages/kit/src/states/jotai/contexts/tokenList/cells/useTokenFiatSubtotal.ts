import { useMemo } from 'react';

import { atom, useAtomValue } from 'jotai';

import { isAgg } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import { sumFiatValuesFromTokens } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { useTokenListContextData } from '../atoms';

import { aggCell, cell, meta } from './projection';

export function useTokenFiatSubtotal(tokens?: IAccountToken[]): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const store = useTokenListContextData().store!;
  const subtotalAtom = useMemo(
    () =>
      atom((get) => {
        if (!tokens?.length) return '0';
        const map: Record<string, ITokenFiat> = {};
        for (const token of tokens) {
          const aggregate = isAgg(token.$key, get(meta(store, token.$key)));
          const fiat = get(
            aggregate ? aggCell(store, token.$key) : cell(store, token.$key),
          );
          if (fiat) map[token.$key] = fiat;
        }
        return sumFiatValuesFromTokens(tokens, map).toFixed();
      }),
    [store, tokens],
  );

  return useAtomValue(subtotalAtom, { store });
}
