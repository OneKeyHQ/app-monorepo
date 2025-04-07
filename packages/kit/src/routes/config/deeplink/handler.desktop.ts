import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';

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
    globalThis.desktopApi.removeIpcEventListener(
      ipcMessageKeys.EVENT_OPEN_URL,
      desktopLinkingHandler,
    );
  } catch {
    // noop
  }

  globalThis.desktopApi.addIpcEventListener(
    ipcMessageKeys.EVENT_OPEN_URL,
    desktopLinkingHandler,
  );
  // window.desktopApi.ready();
};
