import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

const checkExtUIOpen = () => {
  const currentExtOrigin = chrome.runtime.getURL('');
  const { ports } = backgroundApiProxy.bridgeExtBg;
  const oneKeyUIPort = Object.values(ports).filter(
    (port) => port.name === 'onekey@EXT_PORT_UI_TO_BG',
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
