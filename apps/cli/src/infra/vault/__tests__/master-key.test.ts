// eslint-disable-next-line jest/no-mocks-import
import { createKeychainStorageMock } from '../../../__mocks__/keychain-storage.mock';
import {
  createMasterKey,
  deleteMasterKey,
  deriveVaultKeyFromMasterKey,
  readMasterKey,
} from '../master-key';
import { MASTER_KEY_ACCOUNT } from '../paths';

const FIXED_MASTER_KEY = Buffer.alloc(32, 0xaa);

describe('master-key helpers', () => {
  it('creates a 32-byte master key and persists the keychain payload', async () => {
    const keychainStorage = createKeychainStorageMock();
    const generatedMasterKey = Buffer.from(FIXED_MASTER_KEY);

    const masterKey = await createMasterKey({
      keychainStorage,
      now: () => 123,
      randomBytes: () => generatedMasterKey,
    });

    expect(masterKey).toEqual(FIXED_MASTER_KEY);
    expect(masterKey).toBe(generatedMasterKey);
    const stored = await keychainStorage.get(MASTER_KEY_ACCOUNT);
    expect(JSON.parse(stored?.toString('utf8') ?? '{}')).toEqual({
      createdAt: 123,
      masterKeyBase64: FIXED_MASTER_KEY.toString('base64'),
      schemaVersion: 1,
    });
  });

  it('reads an existing master key', async () => {
    const keychainStorage = createKeychainStorageMock();
    await createMasterKey({
      keychainStorage,
      randomBytes: () => Buffer.from(FIXED_MASTER_KEY),
    });

    await expect(readMasterKey({ keychainStorage })).resolves.toEqual(
      FIXED_MASTER_KEY,
    );
  });

  it('returns null when the master key does not exist', async () => {
    const keychainStorage = createKeychainStorageMock();

    await expect(readMasterKey({ keychainStorage })).resolves.toBeNull();
  });

  it('deletes the master-key account', async () => {
    const keychainStorage = createKeychainStorageMock([
      [MASTER_KEY_ACCOUNT, Buffer.from('payload')],
    ]);

    await deleteMasterKey({ keychainStorage });

    await expect(keychainStorage.get(MASTER_KEY_ACCOUNT)).resolves.toBeNull();
  });

  it('uses only get/set/delete keychain methods', async () => {
    const keychainStorage = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      list: jest.fn(),
    };

    await createMasterKey({
      keychainStorage,
      randomBytes: () => Buffer.from(FIXED_MASTER_KEY),
    });
    await readMasterKey({ keychainStorage });
    await deleteMasterKey({ keychainStorage });

    expect(keychainStorage.get).toHaveBeenCalledTimes(1);
    expect(keychainStorage.set).toHaveBeenCalledTimes(1);
    expect(keychainStorage.delete).toHaveBeenCalledTimes(1);
    expect(keychainStorage.list).not.toHaveBeenCalled();
  });

  it('wipes the master key after deriving the vault key', () => {
    const secureWipeSpy = jest.fn((buffer: Buffer) => {
      buffer.fill(0);
    });
    const masterKey = Buffer.from(FIXED_MASTER_KEY);

    const vaultKey = deriveVaultKeyFromMasterKey(masterKey, secureWipeSpy);

    expect(vaultKey).toHaveLength(32);
    expect(secureWipeSpy).toHaveBeenCalledWith(masterKey);
    expect([...masterKey].every((byte) => byte === 0)).toBe(true);
  });
});
