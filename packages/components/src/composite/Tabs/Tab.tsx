import { createContext, useContext } from 'react';

import type { TabProps } from 'react-native-collapsible-tab-view';

export const TabNameContext = createContext<string>('');
export const useCurrentTabName = () => {
  return useContext(TabNameContext);
};

export function Tab<TabName extends string>({
  name,
  children,
}: TabProps<TabName>) {
  return (
    <TabNameContext.Provider value={name}>{children}</TabNameContext.Provider>
  );
}
