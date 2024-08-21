import { EXT_UI_TO_BG_PORT_NAME } from '@onekeyhq/shared/types';

import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

const checkExtUIOpen = (bridgeExtBg: JsBridgeExtBackground) => {
  const currentExtOrigin = chrome.runtime.getURL('');
  const { ports } = bridgeExtBg;
  const oneKeyUIPort = Object.values(ports).filter(
    (port) => port.name === EXT_UI_TO_BG_PORT_NAME,
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
