import { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

import { TabBar } from './TabBar';
import { TabNameContext } from './TabNameContext';

import type { TabProps } from 'react-native-collapsible-tab-view';


const Tab = ({children,name,...props}: TabProps<string>) => {
  return (
      <NativeTabs.Tab {...props} name={name}>
        <TabNameContext.Provider {...props} value={name}>
          {children}
        </TabNameContext.Provider>
      </NativeTabs.Tab>
  );
};

export const Tabs = {
  ...NativeTabs,
  Tab,
  TabBar,
};

export * from './hooks';
