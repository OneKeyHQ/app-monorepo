import { useCallback, useMemo, useState } from 'react';

import { StyleSheet, View, useWindowDimensions } from 'react-native';

import NativeOverlay from './NativeOverlayNativeComponent';
import { isBlockingLevel } from './OverlayLevels';
import { useOverlayController } from './useOverlayController';

import type {
  IOverlayRequestDismissReason,
  IOverlayViewProps,
} from './OverlayViewTypes';
import type { LayoutChangeEvent, NativeSyntheticEvent } from 'react-native';

const DEFAULT_BACKDROP_COLOR = 'rgba(0, 0, 0, 0.4)';
const DEFAULT_SHEET_MAX_RATIO = 0.92;

const REQUEST_REASONS: Record<string, IOverlayRequestDismissReason> = {
  back: 'back',
  backdrop: 'backdrop',
  pan: 'pan',
};

const styles = StyleSheet.create({
  // The host view never draws: native moves its child into the level host
  // and clips it (zero width) while hidden. The height stays auto on
  // purpose; a fixed 0 makes Yoga measure a fitted sheet's content at most
  // 0 tall, so the sheet would never learn its height.
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
  },
});

export function OverlayView(props: IOverlayViewProps) {
  const {
    level = 'modal',
    presentation = 'center',
    backdrop,
    blocking,
    dismissOnBackPress,
    sheet,
    keepContentMounted = false,
    children,
    testID,
  } = props;
  const isSheet = presentation === 'sheet';
  const controller = useOverlayController(props);
  const { width, height } = useWindowDimensions();
  const {
    entry,
    mounted,
    presented,
    scope,
    hostKey,
    ownerKey,
    animation,
    onHostPresented,
    onHostDismissed,
    onHostRequestDismiss,
  } = controller;

  const [measuredSheetHeight, setMeasuredSheetHeight] = useState(0);
  const maxSheetHeight = sheet?.maxHeight ?? height * DEFAULT_SHEET_MAX_RATIO;
  const sheetHeight = Math.min(
    sheet?.height ?? measuredSheetHeight,
    maxSheetHeight,
  );
  const onSheetLayout = useCallback((event: LayoutChangeEvent) => {
    setMeasuredSheetHeight(event.nativeEvent.layout.height);
  }, []);

  const animationConfig = useMemo(() => JSON.stringify(animation), [animation]);
  const isBlocking = blocking ?? isBlockingLevel(level);

  const onDismissed = useCallback(() => onHostDismissed(), [onHostDismissed]);
  const onRequestDismiss = useCallback(
    (event: NativeSyntheticEvent<{ reason: string }>) => {
      onHostRequestDismiss(REQUEST_REASONS[event.nativeEvent.reason] ?? 'back');
    },
    [onHostRequestDismiss],
  );

  if (!keepContentMounted && (!mounted || !entry)) {
    return null;
  }

  return (
    <NativeOverlay
      style={styles.host}
      // A fitted sheet presents once its content height is known.
      visible={presented && (!isSheet || sheetHeight > 0)}
      level={level}
      scope={scope}
      hostKey={hostKey ?? ''}
      ownerKey={ownerKey ?? ''}
      presentation={presentation}
      stackOrder={entry?.seq ?? 0}
      blocking={isBlocking}
      dismissOnBackPress={dismissOnBackPress ?? isBlocking}
      dismissOnBackdropPress={backdrop ? !!backdrop.dismissOnPress : false}
      backdropColor={
        backdrop ? (backdrop.color ?? DEFAULT_BACKDROP_COLOR) : undefined
      }
      sheetHeight={isSheet ? sheetHeight : 0}
      sheetCornerRadius={sheet?.cornerRadius}
      showHandle={sheet?.showHandle}
      sheetBackgroundColor={sheet?.backgroundColor}
      dismissOnPanDown={sheet?.dismissOnPanDown ?? true}
      animationConfig={animationConfig}
      onPresented={onHostPresented}
      onDismissed={onDismissed}
      onRequestDismiss={onRequestDismiss}
      testID={testID}
    >
      {isSheet ? (
        <View
          collapsable={false}
          onLayout={onSheetLayout}
          style={{
            width,
            height: sheet?.height,
            maxHeight: maxSheetHeight,
            // The host is 0x0; without this Yoga shrinks the content to 0 and
            // a fitted sheet never learns its height.
            flexShrink: 0,
          }}
        >
          {children}
        </View>
      ) : (
        <View
          collapsable={false}
          pointerEvents="box-none"
          style={{ width, height, flexShrink: 0 }}
        >
          {children}
        </View>
      )}
    </NativeOverlay>
  );
}
