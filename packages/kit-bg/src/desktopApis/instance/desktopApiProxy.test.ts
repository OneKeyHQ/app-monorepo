import { getDesktopIpcCallContext } from '@onekeyhq/shared/src/errors/utils/electronIpcError';

import desktopApiProxy from './desktopApiProxy';

/*
yarn jest packages/kit-bg/src/desktopApis/instance/desktopApiProxy.test.ts
*/

jest.mock('@onekeyhq/shared/src/platformEnvLite', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));

describe('desktopApiProxy errors', () => {
  const bridgeCall = jest.fn();

  beforeEach(() => {
    bridgeCall.mockReset();
    (
      globalThis as unknown as { desktopApiBridge: { call: typeof bridgeCall } }
    ).desktopApiBridge = { call: bridgeCall };
  });

  afterEach(() => {
    delete (globalThis as { desktopApiBridge?: unknown }).desktopApiBridge;
  });

  it('keeps the failing module/method on an unwrapped main-process error', async () => {
    bridgeCall.mockRejectedValue(
      new Error(
        "Error invoking remote method 'DESKTOP_API_CALL': Error: Keychain is locked",
      ),
    );

    const error: unknown = await desktopApiProxy.storage
      .secureGetItemAsync('onekey-supabase-session-key')
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      name: 'UnwrappedIpcError',
      message: 'Keychain is locked',
    });
    expect(getDesktopIpcCallContext(error)).toEqual({
      ipcModule: 'storage',
      ipcMethod: 'secureGetItemAsync',
    });
    // Only the call name is recorded, never its params.
    expect(JSON.stringify(error)).not.toContain('onekey-supabase-session-key');
  });

  it('keeps the call context on errors raised before reaching the main process', async () => {
    bridgeCall.mockRejectedValue(new Error('An object could not be cloned.'));

    const error: unknown = await desktopApiProxy.storage
      .secureSetItemAsync('key', 'value')
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ message: 'An object could not be cloned.' });
    expect(getDesktopIpcCallContext(error)).toEqual({
      ipcModule: 'storage',
      ipcMethod: 'secureSetItemAsync',
    });
  });

  it('returns results unchanged', async () => {
    bridgeCall.mockResolvedValue(true);

    await expect(
      desktopApiProxy.storage.isSecureStorageAvailable(),
    ).resolves.toBe(true);
    expect(bridgeCall).toHaveBeenCalledWith(
      'storage',
      'isSecureStorageAvailable',
    );
  });
});
