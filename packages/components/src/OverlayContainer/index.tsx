import type { FC } from 'react';

import { StyleSheet, View } from 'react-native';

import { PortalEntry } from '@onekeyhq/kit/src/views/Overlay/RootPortal';

import type { StyleProp, ViewStyle } from 'react-native';

const OverlayContainer: FC<{
  useFullWindowForIOS?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ useFullWindowForIOS, style, ...props }) => {
  const content = (
    <View
      // testID="OverlayContainer-View"
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, style]}
      {...props}
    />
  );
  return <PortalEntry target="Root-FullWindowOverlay">{content}</PortalEntry>;
};
export default OverlayContainer;
