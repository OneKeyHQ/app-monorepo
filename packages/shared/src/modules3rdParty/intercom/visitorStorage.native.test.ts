import { OneKeyLocalError } from '../../errors';

import {
  bindVisitorStorage,
  intercomVisitorStorageKey,
  resetIntercomVisitorStorage,
  visitorStorage,
} from './visitorStorage.native';

const mockReferences = new Map<string, string>();
const mockSecrets = new Map<string, string>();
let mockSequence = 0;
const mockSecureWrite = jest.fn(async (key: string, value: string) => {
  mockSecrets.set(key, value);
});
const mockSecureRemove = jest.fn(async (key: string) => {
  mockSecrets.delete(key);
});

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('../../utils/miscUtils', () => ({
  generateUUID: () => {
    mockSequence += 1;
    return `test-reference-${mockSequence}`;
  },
}));
jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockReferences.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockReferences.set(key, value);
    },
    removeItem: async (key: string) => {
      mockReferences.delete(key);
    },
    secureStorage: {
      getSecureItem: async (key: string) => mockSecrets.get(key) ?? null,
      setSecureItem: (key: string, value: string) =>
        mockSecureWrite(key, value),
      removeSecureItem: (key: string) => mockSecureRemove(key),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReferences.clear();
  mockSecrets.clear();
  mockSecureWrite.mockImplementation(async (key, value) => {
    mockSecrets.set(key, value);
  });
  mockSecureRemove.mockImplementation(async (key) => {
    mockSecrets.delete(key);
  });
});

it('persists only a random reference outside Keychain and restores it on normal restart', async () => {
  const first = await bindVisitorStorage(intercomVisitorStorageKey);
  await first.set('synthetic-visitor-token');
  expect([...mockReferences.values()]).not.toContain('synthetic-visitor-token');
  const restarted = await bindVisitorStorage(intercomVisitorStorageKey);
  expect(await restarted.get()).toBe('synthetic-visitor-token');
  expect(await visitorStorage.get(intercomVisitorStorageKey)).toBe(
    'synthetic-visitor-token',
  );
});

it('does not adopt fixed legacy Keychain entries or entries left by an earlier installation', async () => {
  mockSecrets.set(intercomVisitorStorageKey, 'legacy-visitor');
  expect(await visitorStorage.get(intercomVisitorStorageKey)).toBeNull();
  const old = await bindVisitorStorage(intercomVisitorStorageKey);
  expect(mockSecrets.has(intercomVisitorStorageKey)).toBe(false);
  await old.set('old-installation-token');
  const reference = mockReferences.get(intercomVisitorStorageKey);
  mockReferences.clear();
  expect(await visitorStorage.get(intercomVisitorStorageKey)).toBeNull();
  const fresh = await bindVisitorStorage(intercomVisitorStorageKey);
  expect(mockReferences.get(intercomVisitorStorageKey)).not.toBe(reference);
  expect(await fresh.get()).toBeNull();
  await expect(old.get()).rejects.toThrow(
    'Support visitor installation changed',
  );
});

it('revokes an old binding when the background clears app storage', async () => {
  const old = await bindVisitorStorage(intercomVisitorStorageKey);
  await old.set('old-token');
  mockReferences.clear();
  await expect(old.assertCurrent()).rejects.toThrow(
    'Support visitor installation changed',
  );
  await expect(old.set('late-token')).rejects.toThrow(
    'Support visitor installation changed',
  );
  expect(mockReferences.size).toBe(0);
});

it('removes the reference before Keychain deletion and stays revoked if deletion fails', async () => {
  const old = await bindVisitorStorage(intercomVisitorStorageKey);
  await old.set('old-token');
  mockSecureRemove.mockImplementation(async () => {
    expect(mockReferences.has(intercomVisitorStorageKey)).toBe(false);
    throw new OneKeyLocalError('Keychain unavailable');
  });
  await expect(resetIntercomVisitorStorage()).rejects.toThrow(
    'Keychain unavailable',
  );
  await expect(old.get()).rejects.toThrow(
    'Support visitor installation changed',
  );
  expect(await visitorStorage.get(intercomVisitorStorageKey)).toBeNull();
});

it('erases a late secure write after reset without touching a new visitor or recreating the marker', async () => {
  const old = await bindVisitorStorage(intercomVisitorStorageKey);
  const oldReference = mockReferences.get(intercomVisitorStorageKey);
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockSecureWrite.mockImplementationOnce(async (key, value) => {
    await paused;
    mockSecrets.set(key, value);
  });
  const pending = old.set('late-old-token');
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(mockSecureWrite).toHaveBeenCalledTimes(1);
  await resetIntercomVisitorStorage();
  const fresh = await bindVisitorStorage(intercomVisitorStorageKey);
  await fresh.set('new-token');
  release();
  await expect(pending).rejects.toThrow('Support visitor installation changed');
  expect(oldReference && mockSecrets.has(oldReference)).toBe(false);
  expect(await fresh.get()).toBe('new-token');
  expect(mockReferences.size).toBe(1);
});

it('deletes the active and legacy secure entries during explicit reset', async () => {
  const store = await bindVisitorStorage(intercomVisitorStorageKey);
  await store.set('synthetic-visitor');
  mockSecrets.set(intercomVisitorStorageKey, 'legacy-visitor');
  await resetIntercomVisitorStorage();
  expect(mockReferences.size).toBe(0);
  expect(mockSecrets.size).toBe(0);
});
