import type { FC, ReactNode } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { withTiming } from 'react-native-reanimated';

import { enableOnPressAnim } from '@onekeyhq/components/src/utils/beforeOnPress';

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
  const native = Gesture.Native();

  const pan = Gesture.Pan()
    .onTouchesDown(() => {
      // enable onPress when fingers down
      enableOnPressAnim.value = 1;
      // console.log('pan onTouchesDown');
    })
    .onTouchesMove(() => {
      // when fingers move,
      // disable the onPress function
      enableOnPressAnim.value = 0;
      // console.log('pan onTouchesMove');
    })
    .onEnd(() => {
      enableOnPressAnim.value = withTiming(1, { duration: 50 });
      // console.log('pan onEnd');
    });

  // the gesture order on android is:
  // finger down ->  native down
  //                 pan down
  //                 tap down
  // longer than 300ms -> tap onFinalize
  // finger move -> native onFinalize
  //                pan move
  //                tap cancel
  // finger up -> pan up
  //              pan onEnd
  //              pan onFinalize
  return (
    <GestureDetector gesture={Gesture.Exclusive(native, pan)}>
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
