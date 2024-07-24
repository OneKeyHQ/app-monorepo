import { forwardRef } from 'react';
import type { ReactElement } from 'react';

import {
  PageContentView,
  PageManager,
  SelectedLabel,
} from '@onekeyfe/react-native-tab-page-view';
// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';
import { withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Header } from './Header';
import { Page } from './Page';
import { TabComponent } from './StickyTabComponent';

import type { ScrollViewProps } from 'react-native';

export const Tab = withStaticProperties(forwardRef(TabComponent), {
  Header,
  Page,
  Manager: PageManager,
  Content: PageContentView,
  SelectedLabel,
});

const renderNestedScrollView = platformEnv.isNativeAndroid
  ? (NestedScrollView as (props: ScrollViewProps) => ReactElement)
  : undefined;

export { renderNestedScrollView, NestedScrollView };
export { useTabIsRefreshingFocused } from './RefreshingFocused';
export { useTabScrollViewRef } from './StickyTabComponent';
export type { ITabPageProps } from './StickyTabComponent/types';
