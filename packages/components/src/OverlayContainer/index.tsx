import { FC } from 'react';

import { StyleSheet, View } from 'react-native';
import { RootSiblingPortal } from 'react-native-root-siblings';

export const OverlayContainer: FC = (props) => (
  <RootSiblingPortal>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} {...props} />
  </RootSiblingPortal>
);

// export { Portal } from 'react-native-portalize';
// export { OverlayContainer } from '@react-native-aria/overlays';
// // @ts-ignore
// export { Overlay } from 'native-base/lib/module/components/primitives/Overlay/index.js';
