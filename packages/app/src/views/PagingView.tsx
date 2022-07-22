import React from 'react';

import { UIManager, findNodeHandle } from 'react-native';

import NestedTabView, { getViewManagerConfig } from './NestedTabView';
import { PagingViewManagerProps } from './types';

type PagingViewProps = {
  renderHeader: () => React.ReactElement | null;
} & PagingViewManagerProps;

export class PagingView extends React.Component<PagingViewProps> {
  private PagerView = React.createRef<typeof NestedTabView>();

  public setPageIndex = (selectedPage: number) => {
    UIManager.dispatchViewManagerCommand(
      findNodeHandle(this),
      getViewManagerConfig().Commands.setPageIndex,
      [selectedPage],
    );
  };

  override render() {
    const {
      defaultIndex,
      headerHeight,
      values,
      renderHeader,
      scrollEnabled,
      style,
      tabViewStyle,
      onChange,
      children,
    } = this.props;
    return (
      <NestedTabView
        values={values}
        onChange={onChange}
        ref={this.PagerView as any}
        defaultIndex={defaultIndex}
        headerHeight={headerHeight}
        scrollEnabled={scrollEnabled}
        style={style}
        tabViewStyle={tabViewStyle}
      >
        {renderHeader()}
        {children}
      </NestedTabView>
    );
  }
}

export default PagingView;
