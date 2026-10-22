import { JsBridgeDesktopApiOfMain } from './JsBridgeDesktopApiOfMain';

jest.mock('@onekeyfe/cross-inpage-provider-core', () => ({
  JsBridgeBase: class {
    receive = jest.fn();
  },
}));
jest.mock('electron', () => ({ ipcMain: { on: jest.fn() } }));

describe('legacy desktop log archive IPC frame boundary', () => {
  it('applies the main-frame check to JSON string payloads', () => {
    const mainFrame = { origin: 'file://' };
    const mainWindow = { webContents: { id: 7, mainFrame } };
    const previousFunctions = globalThis.$desktopMainAppFunctions;
    globalThis.$desktopMainAppFunctions = {
      getSafelyMainWindow: () => mainWindow,
    } as typeof globalThis.$desktopMainAppFunctions;
    try {
      const bridge = new JsBridgeDesktopApiOfMain();
      const receiveMock = jest.spyOn(bridge, 'receive');
      const on = (
        jest.requireMock('electron') as { ipcMain: { on: jest.Mock } }
      ).ipcMain.on;
      const listener = on.mock.calls.at(-1)?.[1] as (
        event: unknown,
        payload: string,
      ) => void;
      const payload = JSON.stringify({
        type: 'REQUEST',
        data: {
          type: 'DESKTOP_API_IPC_MESSAGE',
          module: 'dev',
          method: 'collectLoggerDigest',
        },
      });
      listener(
        { sender: { id: 7 }, senderFrame: { origin: 'file://' } },
        payload,
      );
      expect(receiveMock).not.toHaveBeenCalled();
      listener(
        { sender: { id: 7 }, senderFrame: { origin: 'file://' } },
        JSON.stringify(payload),
      );
      expect(receiveMock).not.toHaveBeenCalled();
      listener({ sender: { id: 7 }, senderFrame: mainFrame }, payload);
      expect(receiveMock).toHaveBeenCalledWith(
        JSON.parse(payload),
        expect.objectContaining({ origin: 'file://', internal: true }),
      );
      receiveMock.mockClear();
      const arrayModulePayload = JSON.stringify({
        type: 'REQUEST',
        data: {
          type: 'DESKTOP_API_IPC_MESSAGE',
          module: ['dev'],
          method: 'collectLoggerDigest',
        },
      });
      listener(
        { sender: { id: 7 }, senderFrame: mainFrame },
        arrayModulePayload,
      );
      expect(receiveMock).not.toHaveBeenCalled();
    } finally {
      globalThis.$desktopMainAppFunctions = previousFunctions;
    }
  });
});
