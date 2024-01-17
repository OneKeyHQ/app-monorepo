import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextTokenList,
  withProvider: withTokenListProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextTokenList,
  withTokenListProvider,
  contextAtomMethod,
};

export const { atom: tokenListAtom, use: useTokenListAtom } = contextAtom<{
  tokens: IAccountToken[];
  keys: string;
}>({
  tokens: [],
  keys: '',
});

export const { atom: riskyTokenListAtom, use: useRiskyTokenListAtom } =
  contextAtom<{
    riskyTokens: IAccountToken[];
    keys: string;
  }>({
    riskyTokens: [],
    keys: '',
  });

export const {
  atom: smallBalanceTokenListAtom,
  use: useSmallBalanceTokenListAtom,
} = contextAtom<{ smallBalanceTokens: IAccountToken[]; keys: string }>({
  smallBalanceTokens: [],
  keys: '',
});

export const { atom: tokenListMapAtom, use: useTokenListMapAtom } =
  contextAtom<{
    [key: string]: ITokenFiat;
  }>({});

export const { atom: riskyTokenListMapAtom, use: useRiskyTokenListMapAtom } =
  contextAtom<{
    [key: string]: ITokenFiat;
  }>({});

export const {
  atom: smallBalanceTokenListMapAtom,
  use: useSmallBalanceTokenListMapAtom,
} = contextAtom<{
  [key: string]: ITokenFiat;
}>({});
