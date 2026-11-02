import { shell } from 'electron';
import logger from 'electron-log/main';

import { MAC_APP_STORE_DOWNLOAD_LINK } from '@onekeyhq/shared/src/config/appConfig';

// Reject ASCII control characters (<= 0x20, 0x7f), raw whitespace, and raw double quotes (`"`, 0x22).
// `new URL()` automatically percent-encodes quotes/spaces into `parsed.href`,
// so passing the unencoded `url` to `shell.openExternal(url)` on Windows could
// otherwise forward raw quotes into ShellExecute command templates.
function hasUnsafeExternalUrlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x22 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    if (!url || typeof url !== 'string' || hasUnsafeExternalUrlChars(url)) {
      logger.warn('[setWindowOpenHandler] blocked malformed external url');
      return;
    }

    const parsed = new URL(url);
    // The DApp browser hands OneKey's own Mac App Store listing to the OS
    // (OK-64036); that exact link is the only non-https exception.
    const isOneKeyMacAppStoreLink = parsed.href === MAC_APP_STORE_DOWNLOAD_LINK;
    // Preserve the main-renderer protocol whitelist (SlowMist Desktop-14).
    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'mailto:' &&
      !isOneKeyMacAppStoreLink
    ) {
      logger.warn(
        '[setWindowOpenHandler] blocked non-https url:',
        parsed.protocol,
      );
      return;
    }

    await shell.openExternal(url);
  } catch {
    logger.warn('[setWindowOpenHandler] unable to open external url');
  }
}
