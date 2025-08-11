import { Container } from './Container';
import { List } from './List';
import { ScrollView } from './ScrollView';
import { Tab } from './Tab';
import { TabBar, TabBarItem } from './TabBar';

import type { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

export const Tabs = {
  Container,
  Tab,
  Lazy: (children: React.ReactNode) => children,
  List,
  FlatList: List,
  ScrollView,
  SectionList: List,
  FlashList: List,
  MasonryFlashList: List,
  TabBar,
  TabBarItem,
} as unknown as typeof NativeTabs & {
  TabBar: typeof TabBar;
  TabBarItem: typeof TabBarItem;
};

export * from './hooks';

export { startViewTransition } from './utils';
