import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';

import type { IRegisterHandler } from './handler.type';

export const registerHandler: IRegisterHandler = (
  handleDeepLinkUrl: (e: IDesktopOpenUrlEventData) => void,
) => {
  const desktopLinkingHandler = (
    _event: Event,
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

  // Process any cached deep links from cold startup
  if (globalThis.ONEKEY_DESKTOP_DEEP_LINKS?.length > 0) {
    const cachedLinks = [...globalThis.ONEKEY_DESKTOP_DEEP_LINKS];
    globalThis.ONEKEY_DESKTOP_DEEP_LINKS = [];
    cachedLinks.forEach((data) => {
      handleDeepLinkUrl(data);
    });
  }
};
