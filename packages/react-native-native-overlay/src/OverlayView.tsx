import { useCallback, useMemo } from 'react';

import { StyleSheet, View, useWindowDimensions } from 'react-native';

import NativeOverlay from './NativeOverlayNativeComponent';
import { isBlockingLevel } from './OverlayLevels';
import { useOverlayController } from './useOverlayController';

import type { IOverlayViewProps } from './OverlayViewTypes';
import type { NativeSyntheticEvent } from 'react-native';

const DEFAULT_BACKDROP_COLOR = 'rgba(0, 0, 0, 0.4)';

const styles = StyleSheet.create({
  // The host view itself never draws; native moves its child into the
  // level host, so it only needs a zero-size slot in the caller's tree.
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
});

export function OverlayView(props: IOverlayViewProps) {
  const {
    level = 'modal',
    presentation = 'center',
    backdrop,
    blocking,
    dismissOnBackPress,
    children,
    testID,
  } = props;
  const controller = useOverlayController(props);
  const { width, height } = useWindowDimensions();
  const {
    entry,
    mounted,
    presented,
    animation,
    onHostPresented,
    onHostDismissed,
    onHostRequestDismiss,
  } = controller;

  const animationConfig = useMemo(() => JSON.stringify(animation), [animation]);
  const isBlocking = blocking ?? isBlockingLevel(level);

  const onDismissed = useCallback(() => onHostDismissed(), [onHostDismissed]);
  const onRequestDismiss = useCallback(
    (event: NativeSyntheticEvent<{ reason: string }>) => {
      onHostRequestDismiss(
        event.nativeEvent.reason === 'backdrop' ? 'backdrop' : 'back',
      );
    },
    [onHostRequestDismiss],
  );

  if (!mounted || !entry) {
    return null;
  }

  return (
    <NativeOverlay
      style={styles.host}
      visible={presented}
      level={level}
      presentation={presentation}
      stackOrder={entry.seq}
      blocking={isBlocking}
      dismissOnBackPress={dismissOnBackPress ?? isBlocking}
      dismissOnBackdropPress={backdrop ? !!backdrop.dismissOnPress : false}
      backdropColor={
        backdrop ? (backdrop.color ?? DEFAULT_BACKDROP_COLOR) : undefined
      }
      animationConfig={animationConfig}
      onPresented={onHostPresented}
      onDismissed={onDismissed}
      onRequestDismiss={onRequestDismiss}
      testID={testID}
    >
      <View
        collapsable={false}
        pointerEvents="box-none"
        style={{ width, height }}
      >
        {children}
      </View>
    </NativeOverlay>
  );
}
