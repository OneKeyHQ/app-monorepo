import { ipcMessageKeys } from '../config';

import { findAllowedDeepLinkArg, isAllowedDeepLinkUrl } from './deepLink';

type ILoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

type IDeepLinkWindowLike = {
  webContents: {
    send: (channel: string, payload?: unknown) => void;
  };
};

type ISecondInstanceWindowLike = {
  isMinimized: () => boolean;
  restore: () => void;
};

export type IDesktopOpenUrlEventData = {
  url?: string;
  argv?: string[];
  isColdStartup?: boolean;
  platform?: string;
};

export type IDeepLinkEventLike = {
  preventDefault: () => void;
};

export interface IDeepLinkHandlerDeps {
  logger: ILoggerLike;
  getSafelyMainWindow: () => IDeepLinkWindowLike | undefined;
  showMainWindow: () => void;
  getIsAppReady: () => boolean;
  setAppReady: (ready: boolean) => void;
  hasMainWindow: () => boolean;
  emitter: {
    once: (event: 'ready', listener: () => void) => void;
  };
}

export function createDeepLinkHandler(deps: IDeepLinkHandlerDeps) {
  return function handleDeepLinkUrl(
    event: IDeepLinkEventLike | null,
    url: string,
    argv?: string[],
    isColdStartup?: boolean,
  ) {
    // Validate deep link scheme and syntax before forwarding to renderer.
    // Never log raw deep link URLs as they may contain pairing keys or tokens.
    if (!url || !isAllowedDeepLinkUrl(url)) {
      deps.logger.warn('[DeepLink] Rejected URL with unknown or unsafe scheme');
      return;
    }

    // Only forward the validated deep link URL; never pass raw process.argv
    // (which contains executable paths, Electron switches, or untrusted args).
    const eventData: IDesktopOpenUrlEventData = {
      url,
      argv: argv ? [url] : undefined,
      isColdStartup,
      platform: process.platform,
    };

    const sendEventData = () => {
      const safelyMainWindow = deps.getSafelyMainWindow();
      if (safelyMainWindow) {
        deps.showMainWindow();

        // Cold startup: cache the deep link for later processing
        if (!deps.getIsAppReady()) {
          safelyMainWindow.webContents.send(
            ipcMessageKeys.OPEN_DEEP_LINK_URL,
            eventData,
          );
        }

        // Hot startup: send directly to registered listener
        safelyMainWindow.webContents.send(
          ipcMessageKeys.EVENT_OPEN_URL,
          eventData,
        );
      }

      deps.setAppReady(true);
    };
    if (deps.getIsAppReady() && deps.hasMainWindow()) {
      sendEventData();
    } else {
      deps.emitter.once('ready', () => sendEventData());
    }

    if (event) {
      event.preventDefault();
    }
  };
}

export function createSecondInstanceHandler(deps: {
  logger: ILoggerLike;
  getPlatform: () => NodeJS.Platform;
  getSafelyMainWindow: () => ISecondInstanceWindowLike | undefined;
  showMainWindow: () => void;
  handleDeepLinkUrl: (
    event: null,
    url: string,
    argv: string[],
    isColdStartup: boolean,
  ) => void;
}) {
  return function handleSecondInstance(event: unknown, argv: string[]) {
    const deeplinkingUrl = findAllowedDeepLinkArg(argv);
    // Omit raw `argv` and `deeplinkingUrl` from logs so sensitive deep-link
    // parameters (e.g. WalletConnect `symKey` or voucher codes) are not persisted.
    deps.logger.info('Second instance launched, focusing existing window', {
      platform: deps.getPlatform(),
      hasDeepLink: Boolean(deeplinkingUrl),
    });

    const safelyMainWindow = deps.getSafelyMainWindow();
    if (safelyMainWindow) {
      // Restore window if minimized
      if (safelyMainWindow.isMinimized()) {
        safelyMainWindow.restore();
      }

      // Handle deep link arguments for all platforms
      if (deeplinkingUrl) {
        // handleDeepLinkUrl internally calls showMainWindow(), so we don't need to call it separately
        deps.handleDeepLinkUrl(null, deeplinkingUrl, argv, false); // isColdStartup=false for second instance
      } else {
        // No deep link, just show and focus the window
        deps.showMainWindow();
      }
    }
  };
}
