import { FlatList, ScrollView, SectionList } from 'react-native';
import {
  HFlatList,
  HScrollView,
  HSectionList,
} from 'react-native-head-tab-view';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import HeaderTabViewContainer from './HeaderTabViewContainer';

import type {
  FlatListProps,
  ScrollViewProps,
  SectionListProps,
} from 'react-native';
import type { NormalSceneBaseProps } from 'react-native-head-tab-view';

// Typings
export type ScrollableFlatListProps<T = any> = FlatListProps<T> &
  NormalSceneBaseProps;
export type ScrollableSectionListProps<T = any> = SectionListProps<T> &
  NormalSceneBaseProps;
export type ScrollableScrollViewProps = ScrollViewProps & NormalSceneBaseProps;
export type { ZTabViewProps as HeaderTabProps } from 'react-native-tab-view-collapsible-header';

// Components
export const ScrollableFlatList = platformEnv.isNative ? HFlatList : FlatList;
export const ScrollableSectionList = platformEnv.isNative
  ? HSectionList
  : SectionList;
export const ScrollableScrollView = platformEnv.isNative
  ? HScrollView
  : ScrollView;
export default HeaderTabViewContainer;
