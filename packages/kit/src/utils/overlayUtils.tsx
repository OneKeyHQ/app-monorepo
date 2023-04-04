import type { ReactElement } from 'react';

import { StyleSheet, View } from 'react-native';
import RootSiblings from 'react-native-root-siblings';
import { FullWindowOverlay } from 'react-native-screens';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// export const OverlayContext = createContext({
//   closeOverlay: () => {},
// });
export function showOverlay(
  renderOverlay: (closeOverlay: () => void) => ReactElement,
) {
  let modal: RootSiblings | null;
  const closeOverlay = () => {
    modal?.destroy();
    modal = null;
  };
  const el = platformEnv.isNativeIOS ? (
    <FullWindowOverlay>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {renderOverlay(closeOverlay)}
      </View>
    </FullWindowOverlay>
  ) : (
    renderOverlay(closeOverlay)
  );
  setTimeout(() => {
    modal = new RootSiblings(el);
  });
  return closeOverlay;
}
