import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/src-electron/app';
import { ipcMessageKeys } from '@onekeyhq/desktop/src-electron/config';

import type { IRegisterHandler } from './handler.type';

export const registerHandler: IRegisterHandler = (
  handleDeepLinkUrl: (e: IDesktopOpenUrlEventData) => void,
) => {
  const desktopLinkingHandler = (
    event: Event,
    data: IDesktopOpenUrlEventData,
  ) => {
    handleDeepLinkUrl(data);
  };

  try {
    window.desktopApi.removeIpcEventListener(
      ipcMessageKeys.EVENT_OPEN_URL,
      desktopLinkingHandler,
    );
  } catch {
    // noop
  }

  window.desktopApi.addIpcEventListener(
    ipcMessageKeys.EVENT_OPEN_URL,
    desktopLinkingHandler,
  );
  // window.desktopApi.ready();
};
