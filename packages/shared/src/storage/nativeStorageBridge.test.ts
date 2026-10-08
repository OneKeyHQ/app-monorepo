import { callNativeStorage } from './nativeStorageBridge';

import type { INativeStorageGlobal } from './nativeStorageTypes';

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeBackgroundThread: false,
    isNativeMainThread: true,
  },
}));

describe('nativeStorageBridge main runtime', () => {
  afterEach(() => {
    delete (globalThis as INativeStorageGlobal).__onekeyNativeStorageCall;
  });

  it('fails closed when the bg transport is not installed', async () => {
    await expect(
      callNativeStorage({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).rejects.toThrow('background storage transport is not installed');
  });

  it('uses the installed bg call without a local storage fallback', async () => {
    const call = jest.fn(async () => 'from-bg');
    (globalThis as INativeStorageGlobal).__onekeyNativeStorageCall = call;

    await expect(
      callNativeStorage<string>({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('from-bg');
    expect(call).toHaveBeenCalledTimes(1);
  });
});
