import type { FC } from 'react';

import { StyleSheet, View } from 'react-native';
import { RootSiblingPortal } from 'react-native-root-siblings';
import { FullWindowOverlay } from 'react-native-screens';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const OverlayContainer: FC<{ useFullWindowForIOS?: boolean }> = ({
  useFullWindowForIOS,
  ...props
}) => {
  const Container =
    useFullWindowForIOS && platformEnv.isNativeIOS
      ? FullWindowOverlay
      : RootSiblingPortal;
  return (
    <Container style={StyleSheet.absoluteFill}>
      <View
        testID="OverlayContainer-View"
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
        {...props}
      />
    </Container>
  );
};
