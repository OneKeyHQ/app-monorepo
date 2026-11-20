import { OneKeyLocalError } from '../errors';

import { buildAppStorageFactory } from './appStorageBuildFactory';
import nativeAsyncStorageInstance from './instance/nativeAsyncStorageInstance';
import MockStorage from './MockStorage';
import { callNativeStorage } from './nativeStorageBridge';
import { reportUnsupportedAsyncStorageApi } from './nativeStorageContractViolation';

jest.mock('./nativeStorageBridge', () => ({
  callNativeStorage: jest.fn(),
}));

jest.mock('./nativeStorageContractViolation', () => ({
  reportUnsupportedAsyncStorageApi: jest.fn(
    (property: string) => new OneKeyLocalError(property),
  ),
}));

jest.mock('../travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      persistence: {
        runSync: ({ operation }: { operation: () => unknown }) => operation(),
        run: ({ operation }: { operation: () => Promise<unknown> }) =>
          operation(),
      },
    }),
  },
}));

test('initializes against the native storage Proxy without probing unsupported methods', async () => {
  jest.mocked(callNativeStorage).mockResolvedValueOnce('fixture');
  const storage = buildAppStorageFactory(nativeAsyncStorageInstance);

  expect('patchObjectItem' in storage).toBe(false);
  expect(reportUnsupportedAsyncStorageApi).not.toHaveBeenCalled();
  await expect(storage.getItem('setting')).resolves.toBe('fixture');
  expect(callNativeStorage).toHaveBeenCalledWith({
    scope: 'asyncStorage',
    operation: 'getItem',
    key: 'setting',
  });
});

test('wraps a supported prototype patch method without losing its storage receiver', async () => {
  class PatchableStorage extends MockStorage {
    readonly patch = jest.fn<
      Promise<void>,
      [string, Record<string, unknown>]
    >();
    async patchObjectItem(key: string, patch: Record<string, unknown>) {
      await this.patch(key, patch);
    }
  }

  const implementation = new PatchableStorage();
  const storage = buildAppStorageFactory(implementation);
  expect(storage.patchObjectItem).toEqual(expect.any(Function));
  await storage.patchObjectItem?.('settings', { locale: 'ja-JP' });
  expect(implementation.patch).toHaveBeenCalledWith('settings', {
    locale: 'ja-JP',
  });
});
