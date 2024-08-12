import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextAccountOverview,
  withProvider: withAccountOverviewProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();

export {
  ProviderJotaiContextAccountOverview,
  contextAtomMethod,
  withAccountOverviewProvider,
};

export const { atom: accountWorthAtom, use: useAccountWorthAtom } =
  contextAtom<{
    worth: string;
    accountId: string;
    initialized: boolean;
  }>({
    worth: '0',
    accountId: '',
    initialized: false,
  });

export const {
  atom: accountOverviewStateAtom,
  use: useAccountOverviewStateAtom,
} = contextAtom<{
  isRefreshing: boolean;
  initialized: boolean;
}>({
  isRefreshing: false,
  initialized: false,
});
