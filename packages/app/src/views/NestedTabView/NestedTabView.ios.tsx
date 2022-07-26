import React, { FC } from 'react';

import NativeNestedTabView from './NativeNestedTabView';
import { NativeNestedTabViewProps } from './types';

type NestedTabViewProps = {
  renderHeader?: () => React.ReactNode;
} & NativeNestedTabViewProps;

const NestedTabView: FC<NestedTabViewProps> = ({
  defaultIndex,
  headerHeight,
  values,
  renderHeader,
  scrollEnabled,
  style,
  tabViewStyle,
  onChange,
  children,
}) => (
  <NativeNestedTabView
    values={values}
    onChange={onChange}
    defaultIndex={defaultIndex}
    headerHeight={headerHeight}
    scrollEnabled={scrollEnabled}
    style={style}
    tabViewStyle={tabViewStyle}
  >
    {renderHeader?.()}
    {children}
  </NativeNestedTabView>
);

export default NestedTabView;
