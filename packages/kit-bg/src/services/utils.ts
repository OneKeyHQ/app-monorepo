import {
  EXT_POP_UP_PORT_NAME,
  SIDE_PANEL_PORT_NAME,
} from '@onekeyhq/shared/types';

import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

const checkExtUIOpen = (bridgeExtBg: JsBridgeExtBackground) => {
  const currentExtOrigin = chrome.runtime.getURL('');
  const { ports } = bridgeExtBg;
  const oneKeyUIPort = Object.values(ports).filter(
    (port) =>
      port.name === SIDE_PANEL_PORT_NAME || port.name === EXT_POP_UP_PORT_NAME,
    // onekey@EXT_PORT_UI_TO_BG/ONEKEY_SIDE_PANEL is constant in extension-bridge-hosted
  );
  if (
    oneKeyUIPort.length > 0 &&
    oneKeyUIPort[0].sender?.origin &&
    currentExtOrigin.includes(oneKeyUIPort[0].sender?.origin)
  ) {
    return true;
  }
  return false;
};

export { checkExtUIOpen };
