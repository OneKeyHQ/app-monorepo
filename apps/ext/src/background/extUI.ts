import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EXT_SPARK_SESSION_PORT_NAME_PREFIX,
  EXT_UI_TO_BG_PORT_NAME,
} from '@onekeyhq/shared/types';

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

export const setupExtUIEvent = () => {
  setupExtUIEventBase((_port: chrome.runtime.Port) => {
    const backgroundApiProxy =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      require('@onekeyhq/kit/src/background/instance/backgroundApiProxy')
        .default as typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
    void backgroundApiProxy.servicePassword.resetPasswordStatus();
    void backgroundApiProxy.serviceAccount.resetIndexedAccountAddressCreationState();
  });
  // A page that shows a Spark screen keeps this port open. Closing the page
  // ends its screens without their cleanup, so the background lets go of the
  // sessions that page held.
  chrome.runtime.onConnect.addListener((port) => {
    if (!port.name.startsWith(EXT_SPARK_SESSION_PORT_NAME_PREFIX)) {
      return;
    }
    const pageId = port.name.slice(EXT_SPARK_SESSION_PORT_NAME_PREFIX.length);
    port.onDisconnect.addListener(() => {
      appEventBus.emit(EAppEventBusNames.ExtensionUiPageClosed, { pageId });
    });
  });
};

export const setupExtUIEventOnPassKeyPage = () =>
  setupExtUIEventBase((_port: chrome.runtime.Port) => {
    closeWindow();
  });
