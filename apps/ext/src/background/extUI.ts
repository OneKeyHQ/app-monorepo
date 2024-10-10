import { EXT_UI_TO_BG_PORT_NAME } from '@onekeyhq/shared/types';

const setupExtUIEventBase = (onDisconnect: () => void) => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === EXT_UI_TO_BG_PORT_NAME) {
      port.onDisconnect.addListener(onDisconnect);
    }
  });
};

export const setupExtUIEvent = () =>
  setupExtUIEventBase(() => {
    const backgroundApiProxy =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      require('@onekeyhq/kit/src/background/instance/backgroundApiProxy')
        .default as typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
    void backgroundApiProxy.servicePassword.resetPasswordStatus();
  });

export const setupExtUIEventOnPassKeyPage = () =>
  setupExtUIEventBase(() => window.close());
