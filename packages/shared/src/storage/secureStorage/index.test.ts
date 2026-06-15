const mockWebStorageRecords = new Map<string, string>();

const mockWebStorageGetItem = jest.fn(
  async (key: string) => mockWebStorageRecords.get(key) ?? null,
);
const mockWebStorageSetItem = jest.fn(async (key: string, value: string) => {
  mockWebStorageRecords.set(key, value);
});
const mockWebStorageRemoveItem = jest.fn(async (key: string) => {
  mockWebStorageRecords.delete(key);
});
const mockWebStorageGetAllKeys = jest.fn(async () => [
  ...mockWebStorageRecords.keys(),
]);

const mockAuthenticateWithPrf = jest.fn();
const mockAuthenticateWithPrfDiscoverable = jest.fn();
const mockRegisterPrfCredential = jest.fn();
const mockUnwrapMasterKey = jest.fn();
const mockDecryptWithMasterKey = jest.fn();

jest.mock('../instance/webStorageInstance', () => ({
  webStorage: {
    getAllKeys: mockWebStorageGetAllKeys,
    getItem: mockWebStorageGetItem,
    removeItem: mockWebStorageRemoveItem,
    setItem: mockWebStorageSetItem,
  },
}));

jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      servicePassword: {
        clearCachedPrfMasterKey: jest.fn(async () => undefined),
        getCachedPrfMasterKey: jest.fn(async () => null),
        setCachedPrfMasterKey: jest.fn(async () => undefined),
      },
    },
  },
}));

jest.mock('./webauthnPrf', () => ({
  PRF_CREDENTIAL_ID_KEY: '$secure_prf_credential_id$',
  PRF_SALT_KEY: '$secure_prf_salt$',
  TRANSPORT_DESCRIPTIONS: {
    ble: 'Bluetooth Security Key',
    hybrid: 'Phone or Tablet',
    internal: 'Touch ID / Face ID / Windows Hello',
    nfc: 'NFC Security Key',
    usb: 'USB Security Key',
  },
  WRAPPED_MASTER_KEY_KEY: '$secure_wrapped_master_key$',
  authenticateWithPrf: mockAuthenticateWithPrf,
  authenticateWithPrfDiscoverable: mockAuthenticateWithPrfDiscoverable,
  decryptWithMasterKey: mockDecryptWithMasterKey,
  encryptWithMasterKey: jest.fn(async () => 'encrypted'),
  generateMasterKey: jest.fn(() => new Uint8Array([3])),
  getTransportDescription: jest.fn(() => 'Touch ID / Face ID / Windows Hello'),
  isPrfSupported: jest.fn(async () => true),
  registerPrfCredential: mockRegisterPrfCredential,
  unwrapMasterKey: mockUnwrapMasterKey,
  wrapMasterKey: jest.fn(async () => 'wrapped-next'),
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isExtension: true,
    isExtensionBackground: false,
  },
}));

describe('secureStorage WebAuthn PRF storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebStorageRecords.clear();
    mockAuthenticateWithPrf.mockResolvedValue({
      prfKey: new Uint8Array([1]),
    });
    mockUnwrapMasterKey.mockResolvedValue(new Uint8Array([2]));
    mockDecryptWithMasterKey.mockResolvedValue('password');
  });

  it('reads existing biometric password with the stored credential only', async () => {
    const { default: secureStorage } = await import('./index');
    mockWebStorageRecords.set('$secure$:password', 'encrypted-password');
    mockWebStorageRecords.set('$secure_prf_credential_id$', 'credential-id');
    mockWebStorageRecords.set('$secure_prf_salt$', 'stored-salt');
    mockWebStorageRecords.set('$secure_wrapped_master_key$', 'wrapped-master');

    await expect(secureStorage.getSecureItem('password')).resolves.toBe(
      'password',
    );

    expect(mockAuthenticateWithPrf).toHaveBeenCalledWith({
      credentialId: 'credential-id',
      salt: 'stored-salt',
    });
    expect(mockAuthenticateWithPrfDiscoverable).not.toHaveBeenCalled();
    expect(mockRegisterPrfCredential).not.toHaveBeenCalled();
  });

  it('does not discover or register a different passkey while reading existing encrypted data', async () => {
    const { default: secureStorage } = await import('./index');
    mockWebStorageRecords.set('$secure$:password', 'encrypted-password');
    mockWebStorageRecords.set('$secure_wrapped_master_key$', 'wrapped-master');

    await expect(secureStorage.getSecureItem('password')).rejects.toThrow(
      'Failed to authenticate with WebAuthn for secure storage',
    );

    expect(mockAuthenticateWithPrfDiscoverable).not.toHaveBeenCalled();
    expect(mockRegisterPrfCredential).not.toHaveBeenCalled();
    expect(mockUnwrapMasterKey).not.toHaveBeenCalled();
    expect(mockDecryptWithMasterKey).not.toHaveBeenCalled();
  });
});
