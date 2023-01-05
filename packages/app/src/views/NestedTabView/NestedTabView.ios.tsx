import type { FC, ReactNode } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import NativeNestedTabView from './NativeNestedTabView';

import type { NativeNestedTabViewProps } from './types';

type NestedTabViewProps = {
  renderHeader?: () => ReactNode;
} & NativeNestedTabViewProps;

const NestedTabView: FC<NestedTabViewProps> = ({
  renderHeader,
  children,
  ...rest
}) => {
  const pan = Gesture.Pan();
  return (
    <GestureDetector gesture={pan}>
      <NativeNestedTabView {...rest}>
        {renderHeader?.()}
        {children}
      </NativeNestedTabView>
    </GestureDetector>
  );
};
// eslint-disable-next-line react/no-unused-class-component-methods
// public setPageIndex = (selectedPage: number) => {
//   UIManager.dispatchViewManagerCommand(
//     findNodeHandle(this),
//     getViewManagerConfig().Commands.setPageIndex,
//     [selectedPage],
//   );
// };

export default NestedTabView;
