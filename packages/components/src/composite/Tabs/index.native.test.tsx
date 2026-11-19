import { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';

import { Tab, Tabs } from './index.native';

jest.mock('react-native-collapsible-tab-view', () => ({
  Tabs: { Tab: () => null, Container: () => null, ScrollView: () => null },
}));
jest.mock('./TabBar', () => ({ TabBar: () => null, TabBarItem: () => null }));
jest.mock('./TabsDraggableFlatList', () => ({
  TabsDraggableFlatList: () => null,
}));
jest.mock('./hooks', () => ({}));
jest.mock('./utils', () => ({}));
jest.mock('./CollapsibleTabContext', () => ({}));
jest.mock('./HeaderScrollGestureWrapper', () => ({}));
jest.mock('./useFocusedTab', () => ({}));

it('preserves the native tab identity required by the container without the legacy entrypoint', () => {
  expect(Tab).toBe(NativeTabs.Tab);
  expect(Tabs).not.toHaveProperty('Tab');
  expect(Tabs.ScrollView).toBe(NativeTabs.ScrollView);
});
