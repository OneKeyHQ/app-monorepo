const mockGetSecureItem = jest.fn(async (_key: string) => 'persisted-secret');
const mockHasSecureItem = jest.fn(async (_key: string) => true);
const mockVerifySecureStorageOperational = jest.fn(async () => true);
const mockRunProtectedOperation = jest.fn(
  async <T>({
    onBlocked,
  }: {
    operation: () => T | Promise<T>;
    onBlocked: () => T | Promise<T>;
  }) => onBlocked(),
);

jest.mock('../secureStorage', () => ({
  __esModule: true,
  default: {
    getCredentialId: jest.fn(async () => null),
    getSecureItem: mockGetSecureItem,
    hasSecureItem: mockHasSecureItem,
    removeSecureItem: jest.fn(async () => undefined),
    resetForPasskeyReEnroll: jest.fn(async () => undefined),
    restoreForPasskeyReEnroll: jest.fn(async () => undefined),
    setSecureItem: jest.fn(async () => undefined),
    setSecureItemWithBiometrics: jest.fn(async () => undefined),
    snapshotForPasskeyReEnroll: jest.fn(async () => []),
    supportSecureStorage: jest.fn(async () => true),
    supportSecureStorageWithoutInteraction: jest.fn(async () => true),
    verifySecureStorageOperational: mockVerifySecureStorageOperational,
  },
}));

jest.mock('../../travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      persistence: {
        run: mockRunProtectedOperation,
      },
    }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const secureStorageInstance = require('./secureStorageInstance')
  .default as typeof import('./secureStorageInstance').default;

describe('secureStorageInstance Travel Mode masking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not expose the historical LSE verifier key by string', async () => {
    const verifierKey = 'onekey_lse_secure_storage_v1';

    await expect(
      secureStorageInstance.getSecureItem(verifierKey),
    ).resolves.toBeNull();
    await expect(
      secureStorageInstance.hasSecureItem?.(verifierKey),
    ).resolves.toBe(false);

    expect(mockGetSecureItem).not.toHaveBeenCalled();
    expect(mockHasSecureItem).not.toHaveBeenCalled();
    expect(mockRunProtectedOperation).toHaveBeenCalledTimes(2);
  });

  it('forwards verifySecureStorageOperational in real mode and blocks in travel mode', async () => {
    await expect(
      secureStorageInstance.verifySecureStorageOperational?.(),
    ).resolves.toBe(false);
    expect(mockVerifySecureStorageOperational).not.toHaveBeenCalled();

    mockRunProtectedOperation.mockImplementationOnce(async ({ operation }) =>
      operation(),
    );
    await expect(
      secureStorageInstance.verifySecureStorageOperational?.(),
    ).resolves.toBe(true);
    expect(mockVerifySecureStorageOperational).toHaveBeenCalledTimes(1);
  });
});
