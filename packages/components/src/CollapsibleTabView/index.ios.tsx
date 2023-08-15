// ios
import { Fragment, forwardRef } from 'react';

import FlatList from '../FlatList';
import { FlatListPlain } from '../FlatListPlain';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';

import { TabContainerNative } from './TabContainerNative';

export const Tabs = {
  Container: forwardRef(TabContainerNative),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: __DEV__ ? ({ children }) => <>{children}</> : Fragment,
  FlatList,
  FlatListPlain,
  ScrollView,
  SectionList,
};
