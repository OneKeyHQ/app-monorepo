import type { ReactElement } from 'react';
import { cloneElement } from 'react';

import { throttle } from 'lodash';
import { StyleSheet, View } from 'react-native';

import { renderToPortal } from '../views/Overlay/RootPortal';

import type { PortalManager } from '../views/Overlay/RootPortal';

export const FULLWINDOW_OVERLAY_PORTAL = 'Root-FullWindowOverlay';

type IOverlayContentRender = (closeOverlay: () => void) => ReactElement;
export const showOverlay = throttle(
  (renderOverlay: IOverlayContentRender) => {
    let portal: PortalManager | null;
    const closeOverlay = () => {
      portal?.destroy();
      portal = null;
    };
    setTimeout(() => {
      const content = (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {renderOverlay(closeOverlay)}
        </View>
      );
      portal = renderToPortal(FULLWINDOW_OVERLAY_PORTAL, content);
    });
    return closeOverlay;
  },
  500,
  {
    leading: true,
    trailing: false,
  },
);

export const showDialog = (render: ReactElement) =>
  showOverlay(
    //
    (closeOverlay) =>
      cloneElement(render, {
        onClose: () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          render.props.onClose?.();
          closeOverlay();
        },
      }),
  );
