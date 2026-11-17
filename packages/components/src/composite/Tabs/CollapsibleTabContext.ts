// Web: re-export TabsContext so that CollapsibleTabContext consumers
// read the same value provided by the web Tabs.Container.
export { TabsContext as CollapsibleTabContext } from './context';
export { TabNameContext as CollapsibleTabNameContext } from './TabNameContext';

export type { ContextType as ICollapsibleTabContextType } from 'react-native-collapsible-tab-view/src/types';
