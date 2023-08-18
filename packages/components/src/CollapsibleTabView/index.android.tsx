// android
import { Fragment, forwardRef } from 'react';

// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';

import FlatList from '../FlatList';
import { FlatListPlain } from '../FlatListPlain';
// import ScrollView from '../ScrollView';
import SectionList from '../SectionList';

import { TabContainerNative } from './TabContainerNative';

const renderScrollComponent = (props: any) => <NestedScrollView {...props} />;

function wrapNestedScrollView(Cmp: any) {
  // eslint-disable-next-line react/display-name
  return ({ contentContainerStyle, ...props }: any) => (
    <Cmp
      contentContainerStyle={[contentContainerStyle]}
      {...props}
      renderScrollComponent={renderScrollComponent}
    />
  );
}

export const Tabs = {
  Container: forwardRef(TabContainerNative),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: __DEV__ ? ({ children }) => <>{children}</> : Fragment,
  FlatList: wrapNestedScrollView(FlatList),
  FlatListPlain: wrapNestedScrollView(FlatListPlain),
  // ScrollView,
  ScrollView: NestedScrollView,
  SectionList: wrapNestedScrollView(SectionList),
};
