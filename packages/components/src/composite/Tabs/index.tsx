import { Container } from './Container';
import { List } from './List';
import { ScrollView } from './ScrollView';
import { Tab } from './Tab';

import type { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

export const Tabs = {
  Container,
  Tab,
  Lazy: (children: React.ReactNode) => children,
  FlatList: List,
  ScrollView,
  SectionList: List,
  FlashList: List,
  MasonryFlashList: List,
} as unknown as typeof NativeTabs;
