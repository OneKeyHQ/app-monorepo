import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import appStorage from '../appStorage';
import secureStorageInstance from '../instance/secureStorageInstance';

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

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isDesktop: false,
    isDev: false,
  },
}));

const mockAppStorage = jest.mocked(appStorage);
const mockSecureStorageInstance = jest.mocked(secureStorageInstance);

describe('SupabaseStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStorageInstance.supportSecureStorageWithoutInteraction.mockResolvedValue(
      false,
    );
  });

  it('clears local inflight cache before setItem retries a write', async () => {
    const storage = new SupabaseStorage();
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    mockAppStorage.getItem
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('fresh');
    mockAppStorage.setItem.mockRejectedValueOnce(new Error('write failed'));

    await expect(storage.getItem('session')).resolves.toBe('stale');
    await expect(storage.setItem('session', 'next')).rejects.toThrow(
      'write failed',
    );
    await expect(storage.getItem('session')).resolves.toBe('fresh');

    expect(mockAppStorage.getItem).toHaveBeenCalledTimes(2);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.SupabaseStorageCacheCleared,
      expect.anything(),
    );
  });

  it('clears local inflight cache before removeItem retries a write', async () => {
    const storage = new SupabaseStorage();
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    mockAppStorage.getItem
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('fresh');
    mockAppStorage.removeItem.mockRejectedValueOnce(new Error('remove failed'));

    await expect(storage.getItem('session')).resolves.toBe('stale');
    await expect(storage.removeItem('session')).rejects.toThrow(
      'remove failed',
    );
    await expect(storage.getItem('session')).resolves.toBe('fresh');

    expect(mockAppStorage.getItem).toHaveBeenCalledTimes(2);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.SupabaseStorageCacheCleared,
      expect.anything(),
    );
  });
});
