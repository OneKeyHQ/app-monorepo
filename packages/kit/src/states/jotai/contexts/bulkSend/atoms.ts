import type { IToken } from '@onekeyhq/shared/types/token';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextBulkSend,
  withProvider: withBulkSendProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextBulkSend,
  contextAtomMethod,
  withBulkSendProvider,
};

export const { atom: tokenListAtom, use: useTokenListAtom } = contextAtom<
  Record<string, IToken[]>
>({});

export const { atom: tokenListMapAtom, use: useTokenListMapAtom } = contextAtom<
  Record<string, IToken>
>({});
