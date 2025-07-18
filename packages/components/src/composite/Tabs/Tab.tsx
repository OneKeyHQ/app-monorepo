import { TabNameContext } from './TabNameContext';

import type { TabProps } from 'react-native-collapsible-tab-view';

export function Tab<TabName extends string>({
  name,
  children,
}: TabProps<TabName>) {
  return (
    <TabNameContext.Provider value={name}>{children}</TabNameContext.Provider>
  );
}
