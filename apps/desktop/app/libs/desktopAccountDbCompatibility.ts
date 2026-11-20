import { createHash } from 'crypto';
import { readFileSync, statSync } from 'fs';
import path from 'path';

// A renderer build emits this asset only when it understands the account
// schema. OTA metadata signs the asset along with the renderer.
export const DESKTOP_ACCOUNT_DB_COMPATIBILITY_FILE =
  'account-db-compatibility.txt';
export const DESKTOP_ACCOUNT_DB_COMPATIBILITY_VERSION = 22;
export const DESKTOP_ACCOUNT_DB_COMPATIBILITY_CONTENT = `${DESKTOP_ACCOUNT_DB_COMPATIBILITY_VERSION}\n`;

export function readDesktopAccountDbCompatibility(
  rendererDirectory: string,
): number | undefined {
  try {
    const marker = path.join(
      rendererDirectory,
      DESKTOP_ACCOUNT_DB_COMPATIBILITY_FILE,
    );
    const stat = statSync(marker);
    if (
      !stat.isFile() ||
      stat.size !== DESKTOP_ACCOUNT_DB_COMPATIBILITY_CONTENT.length
    )
      return undefined;
    return readFileSync(marker, 'utf8') ===
      DESKTOP_ACCOUNT_DB_COMPATIBILITY_CONTENT
      ? DESKTOP_ACCOUNT_DB_COMPATIBILITY_VERSION
      : undefined;
  } catch {
    return undefined;
  }
}

export function getEmbeddedDesktopAccountDbCompatibility(isPackaged: boolean) {
  if (!isPackaged) return undefined;
  // The main process runs from app/dist. Never consult the downloaded
  // renderer, userData, renderer process.env, or selected bundle metadata.
  return readDesktopAccountDbCompatibility(path.join(__dirname, '..', 'build'));
}

export function hasCompatibleDesktopAccountDbBundle(
  rendererDirectory: string,
  metadata: Readonly<Record<string, string>>,
): boolean {
  const expectedHash = createHash('sha512')
    .update(DESKTOP_ACCOUNT_DB_COMPATIBILITY_CONTENT)
    .digest('hex');
  return (
    Object.hasOwn(metadata, DESKTOP_ACCOUNT_DB_COMPATIBILITY_FILE) &&
    metadata[DESKTOP_ACCOUNT_DB_COMPATIBILITY_FILE] === expectedHash &&
    readDesktopAccountDbCompatibility(rendererDirectory) ===
      DESKTOP_ACCOUNT_DB_COMPATIBILITY_VERSION
  );
}
