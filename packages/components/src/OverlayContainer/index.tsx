import type { FC } from 'react';

import { StyleSheet, View } from 'react-native';

import { PortalEntry } from '@onekeyhq/kit/src/views/Overlay/RootPortal';

const OverlayContainer: FC<{ useFullWindowForIOS?: boolean }> = ({
  useFullWindowForIOS,
  ...props
}) => {
  const content = (
    <View
      // testID="OverlayContainer-View"
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      {...props}
    />
  );
  return <PortalEntry target="Root-FullWindowOverlay">{content}</PortalEntry>;
};
export default OverlayContainer;
