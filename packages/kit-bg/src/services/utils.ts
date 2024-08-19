import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

const checkExtUIOpen = (bridgeExtBg: JsBridgeExtBackground) => {
  const currentExtOrigin = chrome.runtime.getURL('');
  const { ports } = bridgeExtBg;
  const oneKeyUIPort = Object.values(ports).filter(
    (port) =>
      port.name === 'onekey@EXT_PORT_UI_TO_BG' ||
      port.name === 'ONEKEY_SIDE_PANEL',
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
