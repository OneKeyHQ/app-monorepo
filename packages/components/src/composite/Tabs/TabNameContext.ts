import { createContext, useContext } from 'react';

export const TabNameContext = createContext<string>('');
export const useTabNameContext = () => {
  return useContext(TabNameContext);
};

// Web already defaults to '' so it never throws outside a provider; expose the
// same hook under the "safe" name used by components (e.g. Table) that may
// render outside a Tabs context.
export const useTabNameContextSafe = useTabNameContext;
