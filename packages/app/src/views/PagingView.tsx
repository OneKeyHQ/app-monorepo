import React, { ComponentProps, FC, RefObject, useRef, useState } from 'react';

import { ValidationMap } from 'prop-types';
import {
  NativeModules,
  Platform,
  UIManager,
  View,
  findNodeHandle,
} from 'react-native';

import { Box } from '@onekeyhq/components';

import NativePagingView, {
  PagerViewViewManagerType,
  getViewManagerConfig,
} from './NativePagingView';
import { PagingViewManagerProps } from './types';

type PagingViewProps = {
  renderHeader: () => React.ReactElement | null;
  renderTabBar: () => React.ReactElement | null;
} & PagingViewManagerProps;

// const PagingView: FC<PagingViewProps> = ({
//   defaultIndex,
//   headerHeight,
//   children,
//   renderHeader,
//   renderTabBar,
// }) => {
//   console.log('');

//   return (
//     <NativePagingView defaultIndex={defaultIndex} headerHeight={headerHeight}>
//       {renderHeader()}
//       {renderTabBar()}
//       <Box>{children}</Box>
//     </NativePagingView>
//   );
// };

export class PagingView extends React.Component<PagingViewProps> {
  private PagerView = React.createRef<typeof NativePagingView>();

  public setPageIndex = (selectedPage: number) => {
    console.log('setPageIndex = ', selectedPage);
    UIManager.dispatchViewManagerCommand(
      findNodeHandle(this),
      getViewManagerConfig().Commands.setPageIndex,
      [selectedPage],
    );
  };

  override render() {
    const { defaultIndex, headerHeight, renderHeader, renderTabBar, children } =
      this.props;
    return (
      <NativePagingView
        ref={this.PagerView as any}
        defaultIndex={defaultIndex}
        headerHeight={headerHeight}
      >
        {renderHeader()}
        {renderTabBar()}
        {children}
      </NativePagingView>
    );
  }
}

export default PagingView;
