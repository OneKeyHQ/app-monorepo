import { Component, ReactNode, createRef } from 'react';

import { UIManager, findNodeHandle } from 'react-native';

import NativeNestedTabView, {
  getViewManagerConfig,
} from './NativeNestedTabView';
import { NativeNestedTabViewProps } from './types';

type NestedTabViewProps = {
  renderHeader?: () => ReactNode;
} & NativeNestedTabViewProps;

export class NestedTabView extends Component<NestedTabViewProps> {
  private _nativeRef = createRef<typeof NativeNestedTabView>();

  public setPageIndex = (selectedPage: number) => {
    UIManager.dispatchViewManagerCommand(
      findNodeHandle(this),
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
