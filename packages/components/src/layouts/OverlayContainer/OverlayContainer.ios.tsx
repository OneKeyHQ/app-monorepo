import { useSyncExternalStore } from 'react';

import { StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import {
  getRequestedNativeStorageRecovery,
  subscribeNativeStorageRecovery,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';

import type { IOverlayContainerProps } from './type';

const styles = StyleSheet.create({
  visible: StyleSheet.absoluteFill,
  hidden: { display: 'none' },
});

export function OverlayContainer({
  children,
  bringToFrontToken,
}: IOverlayContainerProps) {
  const recovering = Boolean(
    useSyncExternalStore(
      subscribeNativeStorageRecovery,
      getRequestedNativeStorageRecovery,
    ),
  );
  return (
    <FullWindowOverlay bringToFrontToken={bringToFrontToken}>
      {/* These children live in a native window, outside the retained App's
          hidden root view. Hide them too while the public repair modal is up,
          preserving component/navigation state for a side-effect-free Back. */}
      <View
        style={recovering ? styles.hidden : styles.visible}
        pointerEvents={recovering ? 'none' : 'box-none'}
        accessibilityElementsHidden={recovering}
        collapsable={false}
      >
        {children}
      </View>
    </FullWindowOverlay>
  );
}
