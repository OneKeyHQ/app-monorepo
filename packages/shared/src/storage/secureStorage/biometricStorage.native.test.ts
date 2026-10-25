/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import {
  canUseBiometricAuthentication,
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';

import storage from './index.native';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  canUseBiometricAuthentication: jest.fn(),
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe('native authenticated secure storage adapter', () => {
  beforeEach(() => jest.resetAllMocks());

  it('checks SecureStore biometric eligibility without reading an item', async () => {
    jest.mocked(canUseBiometricAuthentication).mockReturnValue(false);
    expect(await storage.supportSecureStorageWithBiometrics?.()).toBe(false);
    expect(getItemAsync).not.toHaveBeenCalled();
    jest.mocked(canUseBiometricAuthentication).mockReturnValue(true);
    expect(await storage.supportSecureStorageWithBiometrics?.()).toBe(true);
  });

  it('uses the same isolated service for authenticated writes, reads and deletion', async () => {
    const keychainService = 'synthetic-backup-service';
    const authenticationPrompt = 'Verify backup password';
    await storage.setSecureItemWithBiometrics(
      'synthetic-key-ref',
      'synthetic-key',
      { keychainService, authenticationPrompt },
    );
    expect(setItemAsync).toHaveBeenCalledWith(
      'synthetic-key-ref',
      'synthetic-key',
      {
        keychainAccessible: 6,
        keychainService,
        requireAuthentication: true,
        authenticationPrompt,
      },
    );
    expect(getItemAsync).not.toHaveBeenCalled();
    await storage.getSecureItemWithBiometrics?.('synthetic-key-ref', {
      authenticationPrompt,
      keychainService,
    });
    expect(getItemAsync).toHaveBeenCalledWith('synthetic-key-ref', {
      authenticationPrompt,
      keychainAccessible: 6,
      keychainService,
      requireAuthentication: true,
    });
    await storage.removeSecureItem('synthetic-key-ref', { keychainService });
    expect(deleteItemAsync).toHaveBeenCalledWith('synthetic-key-ref', {
      keychainAccessible: 6,
      keychainService,
    });
  });

  it('propagates authentication failures without retrying or writing', async () => {
    jest.mocked(getItemAsync).mockRejectedValueOnce(new Error('cancelled'));
    await expect(
      storage.getSecureItemWithBiometrics?.('synthetic-ref'),
    ).rejects.toThrow('cancelled');
    expect(getItemAsync).toHaveBeenCalledTimes(1);
    expect(setItemAsync).not.toHaveBeenCalled();
  });
});
