import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';
import appStorage from '../../storage/appStorage';
import { generateUUID } from '../../utils/miscUtils';

export const intercomVisitorStorageKey = `onekey-support-visitor-v1-${process.env.INTERCOM_APP_ID || 'vbbj4ssb'}`;

export async function withVisitorSessionLock(
  key: string,
  operation: () => Promise<void>,
) {
  if (platformEnv.isDesktop) return operation();
  const locks = globalThis.navigator?.locks;
  if (locks) return locks.request(key, operation);
  if (platformEnv.isExtension)
    throw new OneKeyLocalError('Support session coordination is unavailable');
  return operation();
}

function visitorValueKey(key: string, reference: string) {
  if (reference.startsWith(`${key}-ref-`) && /^[\w.-]+$/.test(reference))
    return `${reference}-session`;
  try {
    const legacy: unknown = JSON.parse(reference);
    if (
      legacy &&
      typeof legacy === 'object' &&
      'anonymousId' in legacy &&
      typeof legacy.anonymousId === 'string' &&
      legacy.anonymousId.length <= 512
    )
      return `${key}-legacy-${encodeURIComponent(legacy.anonymousId)}`;
  } catch {
    // A corrupt visitor is discarded when support is explicitly opened.
  }
  return undefined;
}

export const visitorStorage = {
  async get(key: string) {
    const reference = await appStorage.getItem(key);
    const valueKey = reference && visitorValueKey(key, reference);
    if (!valueKey) return null;
    const value = await appStorage.getItem(valueKey);
    if ((await appStorage.getItem(key)) !== reference) return null;
    return value ?? (reference?.startsWith('{') ? reference : null);
  },
  async remove(key: string) {
    const reference = await appStorage.getItem(key);
    await appStorage.removeItem(key);
    const valueKey = reference && visitorValueKey(key, reference);
    if (valueKey) await appStorage.removeItem(valueKey);
  },
};

export async function bindVisitorStorage(key: string) {
  let reference = await appStorage.getItem(key);
  let valueKey = reference && visitorValueKey(key, reference);
  if (!reference || !valueKey) {
    reference = `${key}-ref-${generateUUID()}`;
    valueKey = `${reference}-session`;
    await appStorage.setItem(key, reference);
  }
  const boundReference = reference;
  const boundValueKey = valueKey;
  const assertCurrent = async () => {
    // Extension UI windows and bg use separate JS heaps over one IndexedDB.
    // The immutable shared reference revokes every old client after a clear.
    if ((await appStorage.getItem(key)) !== boundReference)
      throw new OneKeyLocalError('Support visitor installation changed');
  };
  return {
    assertCurrent,
    async get() {
      await assertCurrent();
      const value = await appStorage.getItem(boundValueKey);
      await assertCurrent();
      // Keep a pre-upgrade visitor as a read-only reference. Migrating it by
      // rewriting the root after an asynchronous read could resurrect it
      // across a concurrent reset in another extension runtime.
      return value ?? (boundReference.startsWith('{') ? boundReference : null);
    },
    async set(value: string) {
      await assertCurrent();
      await appStorage.setItem(boundValueKey, value);
      try {
        await assertCurrent();
      } catch (error) {
        await appStorage.removeItem(boundValueKey).catch(() => undefined);
        throw error;
      }
    },
  };
}

export const resetIntercomVisitorStorage = () =>
  visitorStorage.remove(intercomVisitorStorageKey);
