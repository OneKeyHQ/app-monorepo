import type { ReactElement } from 'react';
import { cloneElement } from 'react';

import { StyleSheet, View } from 'react-native';
import RootSiblings from 'react-native-root-siblings';
import { FullWindowOverlay } from 'react-native-screens';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// export const OverlayContext = createContext({
//   closeOverlay: () => {},
// });
export function showOverlay(
  renderOverlay: (closeOverlay: () => void) => ReactElement,
  // enable this flag if you are showing a Dialog (based on RNModal)
  withRNModal?: boolean,
) {
  let modal: RootSiblings | null;
  const closeOverlay = () => {
    modal?.destroy();
    modal = null;
  };
  const el =
    // FullWindowOverlay can not be used with RNModal
    !withRNModal && platformEnv.isNativeIOS ? (
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

// Because dialogs are wrapped in RN Modal
// so there are 2 ways to use dialog in overlay:
// 1. showDialog(<Dialog />)
// 2. showOverlay((onClose) => <Dialog onClose={onClose} />, true)
export const showDialog = (render: ReactElement) =>
  showOverlay(
    (onClose) =>
      cloneElement(render, {
        onClose: () => {
          onClose();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          render.props.onClose?.();
        },
      }),
    true,
  );
