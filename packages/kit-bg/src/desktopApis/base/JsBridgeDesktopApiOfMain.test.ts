import { ipcMain } from 'electron';

import { CALL_DESKTOP_API_EVENT_NAME } from './consts';
import { JsBridgeDesktopApiOfMain } from './JsBridgeDesktopApiOfMain';

const mockReceive = jest.fn();
jest.mock('electron', () => ({
  ipcMain: new (jest.requireActual<typeof import('events')>(
    'events',
  ).EventEmitter)(),
}));
jest.mock('@onekeyfe/cross-inpage-provider-core', () => ({
  JsBridgeBase: class {
    receive = mockReceive;
  },
}));

test('legacy desktop bridge accepts only the current main window main frame', () => {
  const mainFrame = { origin: 'file://' };
  const priorFunctions = globalThis.$desktopMainAppFunctions;
  Object.assign(globalThis, {
    $desktopMainAppFunctions: {
      getSafelyMainWindow: () => ({ webContents: { id: 12 } }),
    },
  });
  try {
    const bridge = new JsBridgeDesktopApiOfMain();
    expect(bridge).toBeInstanceOf(JsBridgeDesktopApiOfMain);
    ipcMain.emit(
      CALL_DESKTOP_API_EVENT_NAME,
      {
        sender: { id: 99, mainFrame },
        senderFrame: mainFrame,
      },
      {},
    );
    ipcMain.emit(
      CALL_DESKTOP_API_EVENT_NAME,
      {
        sender: { id: 12, mainFrame },
        senderFrame: { origin: 'file://' },
      },
      {},
    );
    expect(mockReceive).not.toHaveBeenCalled();
    ipcMain.emit(
      CALL_DESKTOP_API_EVENT_NAME,
      {
        sender: { id: 12, mainFrame },
        senderFrame: mainFrame,
      },
      {},
    );
    expect(mockReceive).toHaveBeenCalledTimes(1);
  } finally {
    Object.assign(globalThis, { $desktopMainAppFunctions: priorFunctions });
    ipcMain.removeAllListeners();
  }
});
