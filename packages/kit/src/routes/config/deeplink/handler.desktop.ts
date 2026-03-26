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
  const cachedDeepLinks =
    globalThis.ONEKEY_DESKTOP_DEEP_LINKS_GETTER?.() ??
    globalThis.ONEKEY_DESKTOP_DEEP_LINKS;
  if (cachedDeepLinks?.length > 0) {
    const links = [...cachedDeepLinks];
    // Clear the original array if it was the legacy global
    if (globalThis.ONEKEY_DESKTOP_DEEP_LINKS) {
      globalThis.ONEKEY_DESKTOP_DEEP_LINKS = [];
    }
    links.forEach((data) => {
      handleDeepLinkUrl(data);
    });
  }
};
