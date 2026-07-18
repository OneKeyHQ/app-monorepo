import { EXT_UI_TO_BG_PORT_NAME } from '@onekeyhq/shared/types';

import {
  EXTENSION_FOREGROUND_RESET_DEADLINE_MS,
  commitExtensionForegrounds,
  createExtensionForegroundConnectionTracker,
  prepareAndCommitExtensionForegrounds,
  quiesceExtensionForegrounds,
  resumeExtensionForegrounds,
} from './utils';

import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

function buildPort(name = EXT_UI_TO_BG_PORT_NAME) {
  const disconnectListeners = new Set<() => void>();
  const port = {
    name,
    onDisconnect: {
      addListener: (listener: () => void) => disconnectListeners.add(listener),
      removeListener: (listener: () => void) =>
        disconnectListeners.delete(listener),
    },
  } as unknown as chrome.runtime.Port;
  return {
    disconnect: () => disconnectListeners.forEach((listener) => listener()),
    port,
  };
}

describe('quiesceExtensionForegrounds', () => {
  it('awaits every connected extension UI and ignores non-UI ports', async () => {
    let acknowledgeFirst: (() => void) | undefined;
    const firstAcknowledgement = new Promise<void>((resolve) => {
      acknowledgeFirst = resolve;
    });
    const request = jest
      .fn()
      .mockReturnValueOnce(firstAcknowledgement)
      .mockResolvedValueOnce(undefined);
    const uiOne = buildPort();
    const uiTwo = buildPort();
    const bridgeExtBg = {
      ports: {
        'content-script': { name: 'onekey@EXT_PORT_CS_TO_BG' },
        'ui-one': uiOne.port,
        'ui-two': uiTwo.port,
      },
      request,
    } as unknown as JsBridgeExtBackground;

    let completed = false;
    const quiesce = quiesceExtensionForegrounds({ bridgeExtBg }).then(
      (portIds) => {
        completed = true;
        return portIds;
      },
    );
    await Promise.resolve();
    expect(completed).toBe(false);

    acknowledgeFirst?.();
    await expect(quiesce).resolves.toEqual(['ui-one', 'ui-two']);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ remoteId: 'ui-one' }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ remoteId: 'ui-two' }),
    );
  });

  it('fails closed when the extension foreground bridge is unavailable', async () => {
    await expect(
      quiesceExtensionForegrounds({ bridgeExtBg: null }),
    ).rejects.toThrow('Extension foreground bridge is not ready');
  });

  it('fails closed on the production deadline when a connected UI does not acknowledge reset', async () => {
    jest.useFakeTimers();
    const uiOne = buildPort();
    const bridgeExtBg = {
      ports: {
        'ui-one': uiOne.port,
      },
      request: jest.fn(() => new Promise(() => undefined)),
    } as unknown as JsBridgeExtBackground;

    try {
      const resetError = quiesceExtensionForegrounds({ bridgeExtBg }).catch(
        (error: unknown) => error as Error,
      );
      jest.advanceTimersByTime(EXTENSION_FOREGROUND_RESET_DEADLINE_MS);
      await expect(resetError).resolves.toThrow(
        'Extension foreground reset deadline exceeded: ui-one',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('gives ports discovered later only the remaining deadline budget', async () => {
    jest.useFakeTimers();
    let acknowledgeFirst: (() => void) | undefined;
    const firstAcknowledgement = new Promise<void>((resolve) => {
      acknowledgeFirst = resolve;
    });
    const uiOne = buildPort();
    const uiTwo = buildPort();
    const ports: Record<string, chrome.runtime.Port> = {
      'ui-one': uiOne.port,
    };
    const request = jest.fn(
      ({ remoteId }: { remoteId?: string | number | null }) =>
        remoteId === 'ui-one'
          ? firstAcknowledgement
          : new Promise(() => undefined),
    );
    const bridgeExtBg = { ports, request } as unknown as JsBridgeExtBackground;

    try {
      const quiesce = quiesceExtensionForegrounds({ bridgeExtBg });
      const resetError = quiesce.catch((error: unknown) => error as Error);
      jest.advanceTimersByTime(EXTENSION_FOREGROUND_RESET_DEADLINE_MS - 1000);
      ports['ui-two'] = uiTwo.port;
      acknowledgeFirst?.();
      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(999);
      await Promise.resolve();
      jest.advanceTimersByTime(1);
      await expect(resetError).resolves.toThrow(
        'Extension foreground reset deadline exceeded: ui-two',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('includes a UI that connects while earlier acknowledgements are pending', async () => {
    let acknowledgeFirst: (() => void) | undefined;
    const firstAcknowledgement = new Promise<void>((resolve) => {
      acknowledgeFirst = resolve;
    });
    const uiOne = buildPort();
    const uiTwo = buildPort();
    const ports: Record<string, chrome.runtime.Port> = {
      'ui-one': uiOne.port,
    };
    const request = jest.fn(
      ({ remoteId }: { remoteId?: string | number | null }) =>
        remoteId === 'ui-one'
          ? firstAcknowledgement
          : Promise.resolve(undefined),
    );
    const bridgeExtBg = {
      ports,
      request,
    } as unknown as JsBridgeExtBackground;

    const quiesce = quiesceExtensionForegrounds({ bridgeExtBg });
    await Promise.resolve();
    ports['ui-two'] = uiTwo.port;
    acknowledgeFirst?.();

    await expect(quiesce).resolves.toEqual(['ui-one', 'ui-two']);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('treats a disconnected UI as quiesced instead of waiting for timeout', async () => {
    const uiOne = buildPort();
    const ports: Record<string, chrome.runtime.Port> = {
      'ui-one': uiOne.port,
    };
    const bridgeExtBg = {
      ports,
      request: jest.fn(() => new Promise(() => undefined)),
    } as unknown as JsBridgeExtBackground;

    const quiesce = quiesceExtensionForegrounds({ bridgeExtBg });
    await Promise.resolve();
    delete ports['ui-one'];
    uiOne.disconnect();

    await expect(quiesce).resolves.toEqual([]);
  });

  it('does not let a replacement runtime inherit an ACK from the same port id', async () => {
    const originalUi = buildPort();
    const replacementUi = buildPort();
    const ports: Record<string, chrome.runtime.Port> = {
      'ui-one': originalUi.port,
    };
    const request = jest
      .fn()
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce(undefined);
    const bridgeExtBg = {
      ports,
      request,
    } as unknown as JsBridgeExtBackground;

    const quiesce = quiesceExtensionForegrounds({ bridgeExtBg });
    await Promise.resolve();
    ports['ui-one'] = replacementUi.port;
    originalUi.disconnect();

    await expect(quiesce).resolves.toEqual(['ui-one']);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ remoteId: 'ui-one' }),
    );
  });

  it('does not reset an already acknowledged foreground twice', async () => {
    const uiOne = buildPort();
    const acknowledgedPorts = new Set<chrome.runtime.Port>();
    const request = jest.fn().mockResolvedValue(undefined);
    const bridgeExtBg = {
      ports: { 'ui-one': uiOne.port },
      request,
    } as unknown as JsBridgeExtBackground;

    await quiesceExtensionForegrounds({
      acknowledgedPorts,
      bridgeExtBg,
    });
    await quiesceExtensionForegrounds({
      acknowledgedPorts,
      bridgeExtBg,
    });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not carry a prepared lease across same-id Port replacement', async () => {
    const originalUi = buildPort();
    const replacementUi = buildPort();
    const preparedPorts = new Set<chrome.runtime.Port>();
    const ports: Record<string, chrome.runtime.Port> = {
      'ui-one': originalUi.port,
    };
    const request = jest.fn().mockResolvedValue(undefined);
    const bridgeExtBg = {
      ports,
      request,
    } as unknown as JsBridgeExtBackground;

    await quiesceExtensionForegrounds({
      acknowledgedPorts: preparedPorts,
      bridgeExtBg,
    });
    ports['ui-one'] = replacementUi.port;
    await quiesceExtensionForegrounds({
      acknowledgedPorts: preparedPorts,
      bridgeExtBg,
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('commits every prepared foreground before browser-storage clear', async () => {
    const uiOne = buildPort();
    const acknowledgedPorts = new Set<chrome.runtime.Port>();
    const request = jest.fn().mockResolvedValue(undefined);
    const bridgeExtBg = {
      ports: { 'ui-one': uiOne.port },
      request,
    } as unknown as JsBridgeExtBackground;

    await quiesceExtensionForegrounds({
      acknowledgedPorts,
      bridgeExtBg,
    });
    await commitExtensionForegrounds({
      bridgeExtBg,
      preparedPorts: acknowledgedPorts,
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(2, {
      data: { method: 'extensionForegroundResetCommit' },
      remoteId: 'ui-one',
    });
  });

  it('prepares a port that joins during commit before committing that port', async () => {
    const uiOne = buildPort();
    const uiTwo = buildPort();
    const ports: Record<string, chrome.runtime.Port> = {
      'ui-one': uiOne.port,
    };
    let revision = 0;
    let addedSecondPort = false;
    const request = jest.fn(
      ({
        data,
        remoteId,
      }: {
        data?: { method?: string };
        remoteId?: string | number | null;
      }) => {
        if (
          data?.method === 'extensionForegroundResetCommit' &&
          remoteId === 'ui-one' &&
          !addedSecondPort
        ) {
          addedSecondPort = true;
          ports['ui-two'] = uiTwo.port;
          revision += 1;
        }
        return Promise.resolve(undefined);
      },
    );
    const bridgeExtBg = {
      ports,
      request,
    } as unknown as JsBridgeExtBackground;

    await prepareAndCommitExtensionForegrounds({
      bridgeExtBg,
      connectionTracker: {
        dispose: jest.fn(),
        getRevision: () => revision,
      },
    });

    const calls = request.mock.calls.map(
      ([{ data, remoteId }]) => `${data?.method}:${String(remoteId)}`,
    );
    expect(calls.indexOf('extensionForegroundReset:ui-two')).toBeLessThan(
      calls.indexOf('extensionForegroundResetCommit:ui-two'),
    );
  });

  it('reports a partial commit failure after waiting for every prepared port', async () => {
    const uiOne = buildPort();
    const uiTwo = buildPort();
    const preparedPorts = new Set([uiOne.port, uiTwo.port]);
    const request = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('commit failed'));
    const bridgeExtBg = {
      ports: { 'ui-one': uiOne.port, 'ui-two': uiTwo.port },
      request,
    } as unknown as JsBridgeExtBackground;

    await expect(
      commitExtensionForegrounds({ bridgeExtBg, preparedPorts }),
    ).rejects.toThrow('commit failed');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('waits for every pending port before reporting an acknowledgement failure', async () => {
    let acknowledgeSecond: (() => void) | undefined;
    const secondAcknowledgement = new Promise<void>((resolve) => {
      acknowledgeSecond = resolve;
    });
    const uiOne = buildPort();
    const uiTwo = buildPort();
    const bridgeExtBg = {
      ports: { 'ui-one': uiOne.port, 'ui-two': uiTwo.port },
      request: jest
        .fn()
        .mockRejectedValueOnce(new Error('first failed'))
        .mockReturnValueOnce(secondAcknowledgement),
    } as unknown as JsBridgeExtBackground;

    let rejected = false;
    const quiesce = quiesceExtensionForegrounds({ bridgeExtBg }).catch(
      (error: unknown) => {
        rejected = true;
        throw error;
      },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(rejected).toBe(false);

    acknowledgeSecond?.();
    await expect(quiesce).rejects.toThrow('first failed');
  });

  it('sends an idempotent resume request to every connected UI', async () => {
    const uiOne = buildPort();
    const request = jest.fn().mockResolvedValue(undefined);
    const bridgeExtBg = {
      ports: { 'ui-one': uiOne.port },
      request,
    } as unknown as JsBridgeExtBackground;

    await resumeExtensionForegrounds({ bridgeExtBg });

    expect(request).toHaveBeenCalledWith({
      data: { method: 'extensionForegroundResetResume' },
      remoteId: 'ui-one',
    });
  });
});

describe('createExtensionForegroundConnectionTracker', () => {
  const originalChrome = globalThis.chrome;

  afterEach(() => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome,
      writable: true,
    });
  });

  it('records even short-lived UI connections and detaches cleanly', () => {
    const listeners = new Set<(port: chrome.runtime.Port) => void>();
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          onConnect: {
            addListener: (listener: (port: chrome.runtime.Port) => void) =>
              listeners.add(listener),
            removeListener: (listener: (port: chrome.runtime.Port) => void) =>
              listeners.delete(listener),
          },
        },
      },
      writable: true,
    });
    const tracker = createExtensionForegroundConnectionTracker();

    listeners.forEach((listener) =>
      listener(buildPort('onekey@EXT_PORT_CS_TO_BG').port),
    );
    expect(tracker.getRevision()).toBe(0);

    listeners.forEach((listener) => listener(buildPort().port));
    expect(tracker.getRevision()).toBe(1);

    tracker.dispose();
    listeners.forEach((listener) => listener(buildPort().port));
    expect(tracker.getRevision()).toBe(1);
  });
});
