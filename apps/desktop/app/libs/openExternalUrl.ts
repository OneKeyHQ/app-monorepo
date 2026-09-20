import { shell } from 'electron';
import logger from 'electron-log/main';

import { APPLE_SUBSCRIPTION_MANAGEMENT_URL } from '@onekeyhq/shared/src/consts/primeConsts';

export async function openExternalUrl(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    // Preserve the main-renderer protocol whitelist (SlowMist Desktop-14).
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
      logger.warn(
        '[setWindowOpenHandler] blocked non-https url:',
        parsed.protocol,
      );
      return;
    }

    if (
      process.platform === 'darwin' &&
      url.trim() === APPLE_SUBSCRIPTION_MANAGEMENT_URL
    ) {
      try {
        // Open the App Store subscriptions sheet instead of the web login.
        await shell.openExternal(
          'macappstores://apps.apple.com/account/subscriptions',
        );
        return;
      } catch {
        // Keep Apple's HTTPS entry point as a fallback if handoff fails.
      }
    }
    await shell.openExternal(url);
  } catch {
    logger.warn('[setWindowOpenHandler] unable to open external url');
  }
}
