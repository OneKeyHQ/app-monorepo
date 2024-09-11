import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextTokenList,
  withProvider: withTokenListProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextTokenList,
  contextAtomMethod,
  withTokenListProvider,
};

export const { atom: searchTokenStateAtom, use: useSearchTokenStateAtom } =
  contextAtom<{
    isSearching: boolean;
  }>({
    isSearching: false,
  });

export const {
  atom: tokenSelectorSearchTokenStateAtom,
  use: useTokenSelectorSearchTokenStateAtom,
} = contextAtom<{
  isSearching: boolean;
}>({
  isSearching: false,
});

export const {
  atom: tokenSelectorSearchTokenListAtom,
  use: useTokenSelectorSearchTokenListAtom,
} = contextAtom<{
  tokens: IAccountToken[];
}>({
  tokens: [],
});

export const { atom: searchTokenListAtom, use: useSearchTokenListAtom } =
  contextAtom<{
    tokens: IAccountToken[];
  }>({
    tokens: [],
  });

export const { atom: allTokenListAtom, use: useAllTokenListAtom } =
  contextAtom<{
    tokens: IAccountToken[];
    keys: string;
  }>({
    tokens: [],
    keys: '',
  });

export const { atom: allTokenListMapAtom, use: useAllTokenListMapAtom } =
  contextAtom<{
    [key: string]: ITokenFiat;
  }>({});

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

export const {
  atom: smallBalanceTokensFiatValueAtom,
  use: useSmallBalanceTokensFiatValueAtom,
} = contextAtom<string>('0');

export const { atom: searchKeyAtom, use: useSearchKeyAtom } =
  contextAtom<string>('');

export const {
  atom: tokenSelectorSearchKeyAtom,
  use: useTokenSelectorSearchKeyAtom,
} = contextAtom<string>('');

export const { atom: tokenListStateAtom, use: useTokenListStateAtom } =
  contextAtom<{
    address: string;
    isRefreshing: boolean;
    initialized: boolean;
  }>({
    address: '',
    isRefreshing: true,
    initialized: false,
  });

export const { atom: createAccountStateAtom, use: useCreateAccountStateAtom } =
  contextAtom<{
    token: IAccountToken | null;
    isCreating: boolean;
  }>({
    token: null,
    isCreating: false,
  });
