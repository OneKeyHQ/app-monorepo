/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

const mockNonDbKdfParams = {
  kdfBackend: 'webcrypto' as const,
  enablePbkdf2Cache: true,
};
const mockBuildKeylessLocalEncryptionKeyWithPassword = jest.fn(
  async () => 'local-password-derived-key',
);
const mockStorageSetItem = jest.fn(async () => undefined);
const mockStorageGetItem = jest.fn(async () => '3q2+7w==');

jest.mock('@onekeyhq/shared/src/appCrypto/modules/pbkdf2', () => ({
  getPbkdf2KdfParamsForNonDbTx: jest.fn(() => mockNonDbKdfParams),
}));

jest.mock('./keylessLocalEncryptionKey', () => ({
  buildKeylessLocalEncryptionKeyWithPassword:
    mockBuildKeylessLocalEncryptionKeyWithPassword,
}));

jest.mock('./keylessStorageUtils', () => ({
  __esModule: true,
  default: {
    storageSetItem: mockStorageSetItem,
    storageGetItem: mockStorageGetItem,
    storageRemoveItem: jest.fn(async () => undefined),
  },
}));

const { ESecretEncryptPayloadFormat } =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/core/src/secret');
const { PBKDF2_CURRENT_NUM_OF_ITERATIONS } =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/src/appCrypto/consts');

const keylessMnemonicPasswordStorage =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./keylessMnemonicPasswordStorage').default;

describe('keylessMnemonicPasswordStorage KDF policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageGetItem.mockResolvedValue('3q2+7w==');
  });

  test('writes new local payloads with the full password-hardening KDF outside DB transactions', async () => {
    const encryptString = jest.fn(async () => 'deadbeef');
    const backgroundApi = {
      servicePassword: {
        encryptString,
      },
    } as any;

    await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorageWithPassword(
      {
        ownerId: 'owner-id',
        mnemonicPassword: 'mnemonic-password',
        password: 'encoded-password',
        backgroundApi,
      },
    );

    expect(encryptString).toHaveBeenCalledWith({
      ...mockNonDbKdfParams,
      password: 'local-password-derived-key',
      data: 'mnemonic-password',
      dataEncoding: 'utf8',
      allowRawPassword: true,
      format: ESecretEncryptPayloadFormat.v2,
      iterations: PBKDF2_CURRENT_NUM_OF_ITERATIONS,
    });
    expect(mockStorageSetItem).toHaveBeenCalledWith(
      expect.any(String),
      '3q2+7w==',
    );
  });

  test('reads using the iteration count stored in the payload', async () => {
    const decryptString = jest.fn(async () => 'mnemonic-password');
    const backgroundApi = {
      servicePassword: {
        decryptString,
      },
    } as any;

    await expect(
      keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorageWithPassword(
        {
          ownerId: 'owner-id',
          password: 'encoded-password',
          backgroundApi,
        },
      ),
    ).resolves.toBe('mnemonic-password');

    expect(decryptString).toHaveBeenCalledWith({
      ...mockNonDbKdfParams,
      password: 'local-password-derived-key',
      data: '3q2+7w==',
      dataEncoding: 'base64',
      resultEncoding: 'utf8',
      allowRawPassword: true,
    });
  });
});
