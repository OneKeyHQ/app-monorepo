import { Container } from './Container';
import { List } from './List';
import { Tab } from './Tab';

import type { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

export const Tabs = {
  Container,
  Tab,
  Lazy: () => null,
  FlatList: List,
  ScrollView: () => null,
  SectionList: () => null,
  FlashList: List,
  MasonryFlashList: () => null,
} as unknown as typeof NativeTabs;
