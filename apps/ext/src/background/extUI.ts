import { EXT_UI_TO_BG_PORT_NAME } from '@onekeyhq/shared/types';

export const setupExtUIEvent = () => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === EXT_UI_TO_BG_PORT_NAME) {
      port.onDisconnect.addListener(() => {
        const backgroundApiProxy: typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          require('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
        void backgroundApiProxy.servicePassword.resetPasswordStatus();
      });
    }
  });
};
