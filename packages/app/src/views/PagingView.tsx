import React from 'react';

import { UIManager, findNodeHandle } from 'react-native';

import NativePagingView, { getViewManagerConfig } from './NativePagingView';
import { PagingViewManagerProps } from './types';

type PagingViewProps = {
  renderHeader: () => React.ReactElement | null;
  renderTabBar: () => React.ReactElement | null;
} & PagingViewManagerProps;

export class PagingView extends React.Component<PagingViewProps> {
  private PagerView = React.createRef<typeof NativePagingView>();

  public setPageIndex = (selectedPage: number) => {
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
