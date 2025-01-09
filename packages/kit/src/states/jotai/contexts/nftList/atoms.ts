import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextNFTList,
  withProvider: withNFTListProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextNFTList, contextAtomMethod, withNFTListProvider };

export const { atom: searchKeyAtom, use: useSearchKeyAtom } =
  contextAtom<string>('');
