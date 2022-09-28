import React from 'react';

import ReactNative, { UIManager } from 'react-native';

import NativeNestedTabView, {
  getViewManagerConfig,
} from './NativeNestedTabView';
import { NativeNestedTabViewProps } from './types';

type NestedTabViewProps = {
  renderHeader?: () => React.ReactNode;
} & NativeNestedTabViewProps;

export class NestedTabView extends React.Component<NestedTabViewProps> {
  private _nativeRef = React.createRef<typeof NativeNestedTabView>();

  public setPageIndex = (selectedPage: number) => {
    UIManager.dispatchViewManagerCommand(
      ReactNative.findNodeHandle(this),
      getViewManagerConfig().Commands.setPageIndex,
      [selectedPage],
    );
  };

  override render() {
    const { renderHeader, children, ...rest } = this.props;
    return (
      // @ts-ignore
      <NativeNestedTabView ref={this._nativeRef} {...rest}>
        {renderHeader?.()}
        {children}
      </NativeNestedTabView>
    );
  }
}

export default NestedTabView;
