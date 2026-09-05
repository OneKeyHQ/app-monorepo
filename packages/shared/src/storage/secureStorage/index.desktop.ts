import { OneKeyLocalError } from '../../errors';

import {
  SECURE_STORAGE_PERMANENT_READ_ERROR_MESSAGE_REGEX,
  SECURE_STORAGE_PERMANENT_READ_ERROR_NAME,
} from './types';

import type { ISecureStorage, ISecureStorageSetOptions } from './types';

const setSecureItem = async (
  key: string,
  data: string,
  _options?: ISecureStorageSetOptions,
) => {
  const r = await globalThis?.desktopApiProxy?.storage?.secureSetItemAsync(
    key,
    data,
  );
  return r;
};

const getSecureItem = async (key: string) => {
  try {
    const v =
      await globalThis?.desktopApiProxy?.storage?.secureGetItemAsync(key);
    return v ?? null;
  } catch (error) {
    // Only `message` crosses the DESKTOP_API_CALL IPC boundary verbatim
    // (makeIpcSafeError in the main process; unwrapElectronIpcError on this
    // side rebuilds the error under its own hardcoded name). Restore the
    // permanent-read label from the message sentinel so consumers
    // (SupabaseStorage) can structurally match it again — without this, a
    // permanently unreadable value would forever classify as transient
    // and its owner could never fall back to re-obtaining it.
    // Matched on the ANCHORED transport shape (bracketed prefix at the
    // start, optionally behind one `<Name>: ` rendering), never the bare
    // name and never a bare `includes`: a message that merely mentions —
    // or a wrapper that embeds — the sentinel must not read as the label,
    // because a false permanent verdict maps a recoverable value to
    // absent.
    const message = (error as Error | undefined)?.message;
    if (
      typeof message === 'string' &&
      SECURE_STORAGE_PERMANENT_READ_ERROR_MESSAGE_REGEX.test(message)
    ) {
      (error as Error).name = SECURE_STORAGE_PERMANENT_READ_ERROR_NAME;
    }
    throw error;
  }
};

const removeSecureItem = async (key: string) =>
  globalThis?.desktopApiProxy?.storage?.secureDelItemAsync(key);

const supportSecureStorage = async () => {
  const available =
    await globalThis?.desktopApiProxy?.storage?.isSecureStorageAvailable?.();
  return available ?? false;
};

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  supportSecureStorage,
  async hasSecureItem(key: string): Promise<boolean> {
    // existence checks keep the historical "unreadable counts as not
    // stored" semantics: getSecureItem now throws on decrypt failure (so
    // record-keeping callers can tell failure from absence), but has-style
    // consumers (e.g. biology-auth enrollment state) treat an unusable
    // value as unusable — re-enrolling overwrites it, which is the healing
    // path for re-obtainable secrets
    try {
      const value = await getSecureItem(key);
      return !!value;
    } catch {
      return false;
    }
  },
  async getCredentialId(): Promise<string | null> {
    return null;
  },
  async resetForPasskeyReEnroll(): Promise<void> {
    return undefined;
  },
  async supportSecureStorageWithoutInteraction(): Promise<boolean> {
    return supportSecureStorage();
  },
  setSecureItemWithBiometrics(_key, _data, _options) {
    // TODO: mac use keychain to set secure item
    throw new OneKeyLocalError('use webauthn/keychain to set secure item');
  },
};

export default storage;
