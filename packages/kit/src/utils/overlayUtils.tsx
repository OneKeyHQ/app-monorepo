import type { ReactElement } from 'react';
import { cloneElement } from 'react';

import { Modal, StyleSheet, View } from 'react-native';
import RootSiblings from 'react-native-root-siblings';
// import { FullWindowOverlay } from 'react-native-screens';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PortalEntry } from '../views/Overlay/RootPortal';

export function showOverlay(
  renderOverlay: (closeOverlay: () => void) => ReactElement,
  // enable this flag if you are showing a Dialog (based on RNModal)
  // withRNModal?: boolean,
) {
  let modal: RootSiblings | null;
  const closeOverlay = () => {
    modal?.destroy();
    modal = null;
  };
  const el = renderOverlay(closeOverlay);
  let useFullWindowOverlay = false;
  if (
    // FullWindowOverlay can only be used on iOS
    platformEnv.isNativeIOS &&
    // FullWindowOverlay can not be used with RNModal
    // !withRNModal &&
    // Addtional detect to exclude RNModal
    el.type !== Modal
    // &&
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    // !el.type?.name?.endsWith?.('Dialog')
  ) {
    useFullWindowOverlay = true;
  }

  const content = (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {el}
    </View>
  );
  setTimeout(() => {
    modal = new RootSiblings(
      useFullWindowOverlay ? (
        <PortalEntry target="Root-FullWindowOverlay">{content}</PortalEntry>
      ) : (
        content
      ),
    );
  });
  return closeOverlay;
}

export const showDialog = (render: ReactElement) =>
  showOverlay((onClose) =>
    cloneElement(render, {
      onClose: () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        render.props.onClose?.();
        onClose();
      },
    }),
  );
