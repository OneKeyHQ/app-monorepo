import { createBeforeQuitHandler } from './appQuitHandlers';
import {
  beginManualUpdateCacheClearInMain,
  releaseManualUpdateCacheClearInMain,
} from './manualUpdateCacheClear';

test('normal quit waits for complete manual cleanup before BLE or window teardown', async () => {
  const quit = jest.fn();
  const teardown = jest.fn();
  const handler = createBeforeQuitHandler({
    app: { quit },
    isMac: true,
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    getDesktopApiAppUpdate: () => ({
      hasPreparedQuitInstall: () => false,
      installOnQuit: async () => false,
    }),
    markAppQuitStarted: teardown,
    unregisterShortcuts: teardown,
    getBleQuitStarted: () => false,
    setBleQuitStarted: teardown,
    getBleQuitReady: () => true,
    setBleQuitReady: teardown,
    getNobleBleInitialization: async () => undefined,
    getTrezorBleSupports: () => new Set(),
    disposeNobleBleSupport: async () => undefined,
    getSafelyMainWindow: () => ({
      close: teardown,
      removeAllListeners: teardown,
    }),
    destroyTrayManager: teardown,
    resetBootFailCountOnGracefulQuit: teardown,
    clearSystemIdleInterval: teardown,
    disposeContextMenu: teardown,
  });
  beginManualUpdateCacheClearInMain();
  const event = { preventDefault: jest.fn() };
  handler(event);
  handler(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(2);
  expect(teardown).not.toHaveBeenCalled();
  expect(quit).not.toHaveBeenCalled();
  releaseManualUpdateCacheClearInMain();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(quit).toHaveBeenCalledTimes(1);
});
