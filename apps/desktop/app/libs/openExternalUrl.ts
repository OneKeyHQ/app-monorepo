import { shell } from 'electron';
import logger from 'electron-log/main';

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

    await shell.openExternal(url);
  } catch {
    logger.warn('[setWindowOpenHandler] unable to open external url');
  }
}
