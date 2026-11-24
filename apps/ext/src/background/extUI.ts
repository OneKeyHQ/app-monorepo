import { checkExtUIOpen } from '@onekeyhq/kit-bg/src/services/utils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EXT_UI_TO_BG_PORT_NAME } from '@onekeyhq/shared/types';

import { closeWindow } from '../closePasskeyWIndow';

const setupExtUIEventBase = (
  onDisconnect: (port: chrome.runtime.Port) => void,
) => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === EXT_UI_TO_BG_PORT_NAME) {
      port.onDisconnect.addListener(onDisconnect);
    }
  });
};

export const setupExtUIEvent = () =>
  setupExtUIEventBase((_port: chrome.runtime.Port) => {
    const backgroundApiProxy =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      require('@onekeyhq/kit/src/background/instance/backgroundApiProxy')
        .default as typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
    void backgroundApiProxy.servicePassword.resetPasswordStatus();
    void backgroundApiProxy.serviceAccount.resetIndexedAccountAddressCreationState();
    // Closing a window ends its pages without their cleanup. Once the last
    // page is gone, the background lets go of what they held. Checked after
    // the bridge drops this port.
    setTimeout(() => {
      const bridge = backgroundApiProxy.backgroundApi?.bridgeExtBg;
      if (bridge && !checkExtUIOpen(bridge)) {
        appEventBus.emit(EAppEventBusNames.ExtensionUiClosed, undefined);
      }
    }, 0);
  });

export const setupExtUIEventOnPassKeyPage = () =>
  setupExtUIEventBase((_port: chrome.runtime.Port) => {
    closeWindow();
  });
