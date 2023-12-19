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
  keys: string[];
}>({
  tokens: [],
  keys: [],
});

export const { atom: tokenListMapAtom, use: useTokenListMapAtom } =
  contextAtom<{
    [key: string]: ITokenFiat;
  }>({});
