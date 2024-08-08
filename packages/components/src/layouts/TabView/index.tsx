import { forwardRef } from 'react';

import {
  PageContentView,
  PageManager,
  SelectedLabel,
} from '@onekeyfe/react-native-tab-page-view';
import { withStaticProperties } from 'tamagui';

import { Header } from './Header';
import { Page } from './Page';
import { TabComponent } from './StickyTabComponent';

export const Tab = withStaticProperties(forwardRef(TabComponent), {
  Header,
  Page,
  Manager: PageManager,
  Content: PageContentView,
  SelectedLabel,
});

export { renderNestedScrollView, NestedScrollView } from './NestedScrollView';
export { useTabIsRefreshingFocused } from './RefreshingFocused';
export { useTabScrollViewRef } from './StickyTabComponent';
export type { ITabPageProps } from './StickyTabComponent/types';
