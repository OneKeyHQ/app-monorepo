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

import { session } from 'electron';

import { applyDesktopNetworkThrottleToWebContents } from './networkThrottle';

import type { WebContents } from 'electron';

const mockDefaultSession = session.defaultSession as unknown as {
  enableNetworkEmulation: jest.Mock;
  disableNetworkEmulation: jest.Mock;
  closeAllConnections: jest.Mock;
};

function createWebContents(targetSession: unknown) {
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
  beforeEach(() => {
    mockDefaultSession.enableNetworkEmulation.mockClear();
    mockDefaultSession.disableNetworkEmulation.mockClear();
  });

  it('throttles OneKey origins through URL rules only', async () => {
    const { contents, targetDebugger } = createWebContents(mockDefaultSession);

    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
    );
    await waitForDebuggerCommands();

    // Session-wide emulation would slow everything, including DApp traffic.
    expect(mockDefaultSession.enableNetworkEmulation).not.toHaveBeenCalled();
    expect(mockDefaultSession.disableNetworkEmulation).toHaveBeenCalledTimes(1);

    const ruleCall = targetDebugger.sendCommand.mock.calls.find(
      ([method]) => method === 'Network.emulateNetworkConditionsByRule',
    );
    const rules = (
      ruleCall?.[1] as {
        matchedNetworkConditions: { urlPattern: string; latency: number }[];
      }
    ).matchedNetworkConditions;

    expect(rules).toContainEqual(
      expect.objectContaining({
        urlPattern: '*://*.onekeycn.com/*',
        latency: 562.5,
      }),
    );
    // No catch-all: everything outside the OneKey origins stays at full speed.
    expect(rules.some((rule) => rule.urlPattern === '')).toBe(false);
    // The global profile must stay disabled for the same reason.
    const emulateCall = targetDebugger.sendCommand.mock.calls.find(
      ([method]) => method === 'Network.emulateNetworkConditions',
    );
    expect(emulateCall?.[1]).toEqual({
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  });

  it('leaves DApp webview sessions untouched', async () => {
    const webviewSession = {
      enableNetworkEmulation: jest.fn(),
      disableNetworkEmulation: jest.fn(),
      closeAllConnections: jest.fn(),
    };
    const { contents, targetDebugger } = createWebContents(webviewSession);
    contents.getType = jest.fn(() => 'webview');

    applyDesktopNetworkThrottleToWebContents(
      contents as unknown as WebContents,
    );
    await waitForDebuggerCommands();

    expect(targetDebugger.attach).not.toHaveBeenCalled();
    expect(targetDebugger.sendCommand).not.toHaveBeenCalled();
    expect(webviewSession.enableNetworkEmulation).not.toHaveBeenCalled();
  });
});
