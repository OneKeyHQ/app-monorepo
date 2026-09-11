import { OneKeyLocalError } from '../../errors';
import {
  SUPABASE_STORAGE_TRANSIENT_ERROR_NAME,
  isRetryableSupabaseAuthError,
} from '../../utils/supabaseAuthErrorUtils';
import secureStorageInstance from '../instance/secureStorageInstance';
import { SECURE_STORAGE_PERMANENT_READ_ERROR_NAME } from '../secureStorage/types';

import { buildSupabaseSealedValueCodec } from './sealedValueCodec';
import { SupabaseStorage } from './SupabaseStorage';

jest.mock('../appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../instance/secureStorageInstance', () => ({
  __esModule: true,
  default: {
    getSecureItem: jest.fn(),
    setSecureItem: jest.fn(),
    removeSecureItem: jest.fn(),
    supportSecureStorageWithoutInteraction: jest.fn(),
  },
}));

// isNative=true so the module-level shouldUseSecureStorage() memoizes TRUE in
// this file's fresh module registry and getItem takes the secure-storage
// path these tests pin down. Kept out of SupabaseStorage.test.ts on purpose:
// that file's tests already memoize the plaintext path.
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  ERuntimeRole: {
    Main: 'main',
    Background: 'background',
    Standalone: 'standalone',
  },
  default: {
    isNative: true,
    isDesktop: false,
    isDev: false,
    runtimeRole: 'standalone',
  },
}));

const mockSecureStorageInstance = jest.mocked(secureStorageInstance);

// the codec is never touched on the secure-storage path; a WebCrypto-less
// plaintext codec keeps the constructor away from real globals
function buildStorage() {
  return new SupabaseStorage({
    sealedValueCodec: buildSupabaseSealedValueCodec({
      cryptoGlobal: null,
      dbName: 'test-supabase-secure-read',
      indexedDBInstance: null,
    }),
  });
}

describe('SupabaseStorage secure-storage read failures', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSecureStorageInstance.supportSecureStorageWithoutInteraction.mockResolvedValue(
      true,
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('maps an adapter-labeled PERMANENT read failure to "no session"', async () => {
    const storage = buildStorage();
    const permanentError = new OneKeyLocalError(
      'failed to decrypt secure item',
    );
    (permanentError as Error).name = SECURE_STORAGE_PERMANENT_READ_ERROR_NAME;
    mockSecureStorageInstance.getSecureItem.mockRejectedValueOnce(
      permanentError,
    );

    // unrecoverable ciphertext, re-obtainable value: "no session" (re-OAuth)
    await expect(storage.getItem('session')).resolves.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('rethrows an unlabeled failure as retryable-transient and never caches it as "no session"', async () => {
    const storage = buildStorage();
    mockSecureStorageInstance.getSecureItem
      .mockRejectedValueOnce(
        new OneKeyLocalError('keychain interaction not allowed'),
      )
      .mockResolvedValueOnce('persisted-session');

    // the slot state is unknown: strict readers must see a retryable
    // rejection, never an "empty" they would run destructive cleanup on
    let thrown: unknown;
    await storage.getItem('session').catch((error: unknown) => {
      thrown = error;
    });
    expect((thrown as Error).name).toBe(SUPABASE_STORAGE_TRANSIENT_ERROR_NAME);
    expect(isRetryableSupabaseAuthError(thrown)).toBe(true);

    // the rejection is evicted from the memoize cache on the next
    // event-loop tick (a resolved null would have been pinned for maxAge):
    // the next read succeeds
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    await expect(storage.getItem('session')).resolves.toBe('persisted-session');
  });
});
