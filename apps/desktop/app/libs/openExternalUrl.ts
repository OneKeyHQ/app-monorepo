import { shell } from 'electron';
import logger from 'electron-log/main';

import { MAC_APP_STORE_DOWNLOAD_LINK } from '@onekeyhq/shared/src/config/appConfig';

export async function openExternalUrl(url: string): Promise<void> {
  try {
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
