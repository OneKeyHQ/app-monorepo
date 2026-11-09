import { OneKeyLocalError } from '../../errors';
import appStorage from '../../storage/appStorage';
import { generateUUID } from '../../utils/miscUtils';

export const intercomVisitorStorageKey = `onekey-support-visitor-v1-${process.env.INTERCOM_APP_ID || 'vbbj4ssb'}`;

function isSecureReference(key: string, reference: string | null) {
  return (
    !!reference &&
    reference.startsWith(`${key}-`) &&
    /^[\w.-]+$/.test(reference)
  );
}

export const visitorStorage = {
  async get(key: string) {
    const reference = await appStorage.getItem(key);
    if (!reference || !isSecureReference(key, reference)) return null;
    const value = await appStorage.secureStorage.getSecureItem(reference);
    return (await appStorage.getItem(key)) === reference ? value : null;
  },
  async remove(key: string) {
    let reference: string | null = null;
    try {
      reference = await appStorage.getItem(key);
    } finally {
      // The shared storage reference revokes main-runtime clients before the
      // background removes their Keychain entry during App Reset.
      await appStorage.removeItem(key);
    }
    await Promise.all([
      appStorage.secureStorage.removeSecureItem(key),
      reference && isSecureReference(key, reference)
        ? appStorage.secureStorage.removeSecureItem(reference)
        : undefined,
    ]);
  },
};

export async function bindVisitorStorage(key: string) {
  let reference = await appStorage.getItem(key);
  if (!reference || !isSecureReference(key, reference)) {
    // The legacy fixed key may belong to an earlier installation. Never adopt
    // it without an installation-scoped reference in app storage.
    await appStorage.secureStorage.removeSecureItem(key);
    reference = `${key}-${generateUUID()}`;
    await appStorage.setItem(key, reference);
  }
  const secureKey = reference;
  const assertCurrent = async () => {
    // Native main/bg have separate JS heaps. Read the background-owned store,
    // not the main runtime's synchronous settings mirror or a JS cache.
    if ((await appStorage.getItem(key)) !== secureKey)
      throw new OneKeyLocalError('Support visitor installation changed');
  };
  return {
    assertCurrent,
    async get() {
      await assertCurrent();
      const value = await appStorage.secureStorage.getSecureItem(secureKey);
      await assertCurrent();
      return value;
    },
    async set(value: string) {
      await assertCurrent();
      await appStorage.secureStorage.setSecureItem(secureKey, value);
      try {
        await assertCurrent();
      } catch (error) {
        // A late write can only touch this revoked reference, never a newly
        // created visitor. Best-effort erase it without recreating the marker.
        await appStorage.secureStorage
          .removeSecureItem(secureKey)
          .catch(() => undefined);
        throw error;
      }
    },
  };
}

export const resetIntercomVisitorStorage = () =>
  visitorStorage.remove(intercomVisitorStorageKey);
