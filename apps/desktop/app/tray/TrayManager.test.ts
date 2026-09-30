import { Tray } from 'electron';

import {
  destroyTrayManager,
  initTrayManager,
  setTrayInteractionSuspended,
} from './TrayManager';
import { createTrayWindow } from './trayWindow';

import type { EventEmitter } from 'events';

jest.mock('electron', () => {
  const { EventEmitter: MockEventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  class MockTray extends MockEventEmitter {
    static instances: MockTray[] = [];

    constructor() {
      super();
      MockTray.instances.push(this);
    }

    setToolTip() {}

    isDestroyed() {
      return false;
    }

    destroy() {}
  }
  return {
    Tray: MockTray,
    nativeImage: {
      createFromPath: () => ({ isEmpty: () => false }),
    },
  };
});

jest.mock('electron-is-dev', () => true);
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('./trayIpc', () => ({
  registerTrayIpcHandlers: jest.fn(),
  requestDataFromMainWindow: jest.fn(),
  resetCachedTrayData: jest.fn(),
  sendCachedDataToTrayWindow: jest.fn(),
  setLocked: jest.fn(),
  unregisterTrayIpcHandlers: jest.fn(),
}));
jest.mock('./trayWindow', () => ({
  createTrayWindow: jest.fn(),
  destroyTrayWindow: jest.fn(),
  getTrayWindow: jest.fn(() => null),
  onTrayWindowVisibilityChange: jest.fn(),
  showTrayWindow: jest.fn(),
}));

test('tray clicks cannot create a window during a soft restart', () => {
  const getMainWindow = jest.fn(() => undefined);
  initTrayManager(getMainWindow, jest.fn(), jest.fn());
  const tray = (Tray as unknown as { instances: EventEmitter[] }).instances[0];

  try {
    setTrayInteractionSuspended(true);
    tray.emit('click');
    tray.emit('right-click');
    expect(createTrayWindow).not.toHaveBeenCalled();

    setTrayInteractionSuspended(false);
    tray.emit('click');
    expect(createTrayWindow).toHaveBeenCalledTimes(1);
  } finally {
    setTrayInteractionSuspended(false);
    destroyTrayManager();
  }
});
