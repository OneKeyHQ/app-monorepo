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
    sendCommand: jest.fn<Promise<object>, [string, unknown?]>(() =>
      Promise.resolve({}),
    ),
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

    // An empty rule list resets the throttling controller, so it must be sent
    // BEFORE the profile; the reverse order measurably drops all throttling
    // while the applied state claims slow4g.
    const methods = targetDebugger.sendCommand.mock.calls.map(
      ([method]) => method,
    );
    expect(
      methods.indexOf('Network.emulateNetworkConditionsByRule'),
    ).toBeLessThan(methods.lastIndexOf('Network.emulateNetworkConditions'));
  });

  it('falls back to full debugger throttling when remote-only rules fail', async () => {
    const targetSession = createSession();
    const { contents, targetDebugger } = createWebContents(targetSession);
    targetDebugger.sendCommand.mockImplementation((method) => {
      if (method === 'Network.emulateNetworkConditionsByRule') {
        return Promise.reject(new Error('Unsupported method'));
      }
      return Promise.resolve({});
    });

    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
      {
        remoteOnly: true,
      },
    );
    await waitForDebuggerCommands();

    // The rule path resets emulation to the disabled profile first, so the
    // fallback must re-send the real profile through the standard command.
    const emulateCalls = targetDebugger.sendCommand.mock.calls.filter(
      ([method]) => method === 'Network.emulateNetworkConditions',
    );
    expect(emulateCalls.at(-1)?.[1]).toEqual({
      offline: false,
      latency: 562.5,
      downloadThroughput: 180_000,
      uploadThroughput: 84_375,
    });

    // A second apply must not repeat the failing rule command.
    const callsAfterFallback = targetDebugger.sendCommand.mock.calls.length;
    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
    );
    await waitForDebuggerCommands();
    expect(targetDebugger.sendCommand).toHaveBeenCalledTimes(
      callsAfterFallback,
    );
  });

  it('keeps the dev server bypass when the fallback itself fails', async () => {
    const targetSession = createSession();
    const { contents, targetDebugger } = createWebContents(targetSession);
    targetDebugger.sendCommand.mockImplementation((method) =>
      method === 'Network.enable'
        ? Promise.resolve({})
        : Promise.reject(new Error('Unsupported method')),
    );

    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
      {
        remoteOnly: true,
      },
    );
    await waitForDebuggerCommands();

    // The failure is scoped to this webContents; other web contents on the
    // same session must keep the loopback bypass, so a later apply still
    // takes the remote-only path.
    const { contents: sibling, targetDebugger: siblingDebugger } =
      createWebContents(targetSession);
    applyDesktopNetworkThrottleToWebContents(sibling as unknown as WebContents);
    await waitForDebuggerCommands();

    expect(siblingDebugger.sendCommand).toHaveBeenCalledWith(
      'Network.emulateNetworkConditionsByRule',
      expect.objectContaining({
        matchedNetworkConditions: expect.arrayContaining([
          expect.objectContaining({ urlPattern: '*://localhost:*/*' }),
        ]),
      }),
    );
  });

  it('keeps standard throttling when URL rule cleanup is unsupported', async () => {
    const targetSession = createSession();
    const { contents, targetDebugger } = createWebContents(targetSession);
    targetDebugger.sendCommand.mockImplementation((method) => {
      if (method === 'Network.emulateNetworkConditionsByRule') {
        return Promise.reject(new Error('Unsupported method'));
      }
      return Promise.resolve({});
    });

    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
    );
    await waitForDebuggerCommands();

    expect(targetDebugger.sendCommand).toHaveBeenCalledWith(
      'Network.emulateNetworkConditions',
      {
        offline: false,
        latency: 562.5,
        downloadThroughput: 180_000,
        uploadThroughput: 84_375,
      },
    );

    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
    );
    await waitForDebuggerCommands();

    expect(targetDebugger.sendCommand).toHaveBeenCalledTimes(3);
  });
});
