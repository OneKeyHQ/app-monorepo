/* eslint-disable import/first */

jest.mock('electron', () => ({
  session: {
    defaultSession: {
      enableNetworkEmulation: jest.fn(),
      disableNetworkEmulation: jest.fn(),
      closeAllConnections: jest.fn(),
    },
    fromPartition: jest.fn(() => ({
      enableNetworkEmulation: jest.fn(),
      disableNetworkEmulation: jest.fn(),
      closeAllConnections: jest.fn(),
    })),
  },
  webContents: {
    getAllWebContents: jest.fn(() => []),
  },
}));

jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  warn: jest.fn(),
}));

jest.mock(
  '@onekeyhq/shared/src/storage/instance/devSettingSyncStorageInstance',
  () => ({
    devSettingSyncStorage: {
      getBoolean: jest.fn(() => true),
    },
  }),
);

jest.mock('@onekeyhq/shared/src/storage/instance/syncStorageInstance', () => ({
  syncStorage: {
    getBoolean: jest.fn(() => true),
  },
}));

jest.mock('./store', () => ({
  getNetworkThrottle: jest.fn(() => ({
    enabled: true,
    profile: 'slow4g',
  })),
  setNetworkThrottle: jest.fn(),
}));

import { applyDesktopNetworkThrottleToWebContents } from './networkThrottle';

import type { WebContents } from 'electron';

function createSession() {
  return {
    enableNetworkEmulation: jest.fn(),
    disableNetworkEmulation: jest.fn(),
    closeAllConnections: jest.fn(),
  };
}

function createWebContents(targetSession: ReturnType<typeof createSession>) {
  const targetDebugger = {
    attach: jest.fn(),
    detach: jest.fn(),
    isAttached: jest.fn(() => false),
    once: jest.fn(),
    sendCommand: jest.fn(() => Promise.resolve({})),
  };
  return {
    contents: {
      id: 1,
      session: targetSession,
      debugger: targetDebugger,
      getType: jest.fn(() => 'window'),
      getURL: jest.fn(() => 'http://localhost:3001/'),
      isDestroyed: jest.fn(() => false),
      isDevToolsOpened: jest.fn(() => false),
      off: jest.fn(),
      once: jest.fn(),
    },
    targetDebugger,
  };
}

async function waitForDebuggerCommands() {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe('desktop network throttle', () => {
  it('uses URL rules and disables session-wide throttling for dev server contents', async () => {
    const targetSession = createSession();
    const { contents, targetDebugger } = createWebContents(targetSession);

    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
      {
        remoteOnly: true,
      },
    );
    await waitForDebuggerCommands();

    expect(targetSession.disableNetworkEmulation).toHaveBeenCalledTimes(1);
    expect(targetSession.enableNetworkEmulation).not.toHaveBeenCalled();
    expect(targetDebugger.sendCommand).toHaveBeenCalledWith(
      'Network.emulateNetworkConditionsByRule',
      expect.objectContaining({
        offline: false,
        matchedNetworkConditions: expect.arrayContaining([
          expect.objectContaining({
            urlPattern: '*://localhost:*/*',
            latency: 0,
          }),
          expect.objectContaining({
            urlPattern: '',
            latency: 562.5,
          }),
        ]),
      }),
    );
  });

  it('keeps session-wide throttling for non-dev web contents', async () => {
    const targetSession = createSession();
    const { contents, targetDebugger } = createWebContents(targetSession);

    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
    );
    await waitForDebuggerCommands();

    expect(targetSession.enableNetworkEmulation).toHaveBeenCalledWith({
      offline: false,
      latency: 562.5,
      downloadThroughput: 180_000,
      uploadThroughput: 84_375,
    });
    expect(targetDebugger.sendCommand).toHaveBeenCalledWith(
      'Network.emulateNetworkConditionsByRule',
      {
        offline: false,
        matchedNetworkConditions: [],
      },
    );
  });
});
