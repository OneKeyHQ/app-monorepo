import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextHistoryList,
  withProvider: withHistoryListProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextHistoryList,
  contextAtomMethod,
  withHistoryListProvider,
};

export const { atom: searchKeyAtom, use: useSearchKeyAtom } =
  contextAtom<string>('');
