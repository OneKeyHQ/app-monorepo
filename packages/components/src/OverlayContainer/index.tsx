import type { FC } from 'react';

import { StyleSheet, View } from 'react-native';
import { RootSiblingPortal } from 'react-native-root-siblings';

import { PortalEntry } from '@onekeyhq/kit/src/views/Overlay/RootPortal';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  if (useFullWindowForIOS && platformEnv.isNativeIOS) {
    return <PortalEntry target="Root-FullWindowOverlay">{content}</PortalEntry>;
  }
  return <RootSiblingPortal>{content}</RootSiblingPortal>;
};
export default OverlayContainer;
