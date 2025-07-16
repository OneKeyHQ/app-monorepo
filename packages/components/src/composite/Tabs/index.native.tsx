import { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

import { TabBar } from './TabBar';
import { TabNameContext } from './TabNameContext';

import type { TabProps } from 'react-native-collapsible-tab-view';

export const Tab = (props: TabProps<string>) => {
  return (
    // eslint-disable-next-line react/destructuring-assignment
    <TabNameContext.Provider value={props.name}>
      <NativeTabs.Tab {...props} />
    </TabNameContext.Provider>
  );
};

export const Tabs = {
  ...NativeTabs,
  Tab: NativeTabs.Tab,
  TabBar,
};
