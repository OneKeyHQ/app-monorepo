import { quiesceExtensionForegrounds } from '@onekeyhq/kit-bg/src/services/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EXT_UI_TO_BG_PORT_NAME } from '@onekeyhq/shared/types';

import {
  commitExtensionForegroundReset,
  quiesceExtensionForeground,
  resumeExtensionForeground,
} from './extensionForegroundReset';

import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

function buildPort() {
  const disconnectListeners = new Set<() => void>();
  return {
    name: EXT_UI_TO_BG_PORT_NAME,
    onDisconnect: {
      addListener: (listener: () => void) => disconnectListeners.add(listener),
      removeListener: (listener: () => void) =>
        disconnectListeners.delete(listener),
    },
  } as unknown as chrome.runtime.Port;
}

describe('quiesceExtensionForeground', () => {
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );
  const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'sessionStorage',
  );

  afterEach(() => {
    resumeExtensionForeground();
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
    timerUtils.enableSetTimeout();
    timerUtils.enableSetInterval();
    jest.restoreAllMocks();
    for (const [key, descriptor] of [
      ['localStorage', originalLocalStorageDescriptor],
      ['sessionStorage', originalSessionStorageDescriptor],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
  });

  it('prepares reversibly, then clears browser storage only on commit', async () => {
    let finishWrites: (() => void) | undefined;
    const writesSettled = new Promise<void>((resolve) => {
      finishWrites = resolve;
    });
    const startResetting = jest.spyOn(resetUtils, 'startResetting');
    const disableSetTimeout = jest.spyOn(timerUtils, 'disableSetTimeout');
    const disableSetInterval = jest.spyOn(timerUtils, 'disableSetInterval');
    jest
      .spyOn(resetUtils, 'waitForResetSensitiveTasksToSettle')
      .mockReturnValue(writesSettled);
    const localStorage = { clear: jest.fn() };
    const sessionStorage = { clear: jest.fn() };

    const quiesce = quiesceExtensionForeground();

    expect(startResetting).toHaveBeenCalledTimes(1);
    expect(disableSetTimeout).not.toHaveBeenCalled();
    expect(disableSetInterval).toHaveBeenCalledTimes(1);
    expect(localStorage.clear).not.toHaveBeenCalled();
    expect(sessionStorage.clear).not.toHaveBeenCalled();

    finishWrites?.();
    await quiesce;
    expect(disableSetTimeout).not.toHaveBeenCalled();
    expect(disableSetInterval).toHaveBeenCalledTimes(1);
    expect(localStorage.clear).not.toHaveBeenCalled();
    expect(sessionStorage.clear).not.toHaveBeenCalled();

    disableSetInterval.mockClear();
    commitExtensionForegroundReset({ localStorage, sessionStorage });
    expect(disableSetTimeout).toHaveBeenCalledTimes(1);
    expect(disableSetInterval).toHaveBeenCalledTimes(1);
    expect(localStorage.clear).toHaveBeenCalledTimes(1);
    expect(sessionStorage.clear).toHaveBeenCalledTimes(1);
  });

  it('uses one idempotent lease across repeated acknowledgements and resumes it', async () => {
    const startResetting = jest.spyOn(resetUtils, 'startResetting');
    const endResetting = jest.spyOn(resetUtils, 'endResetting');
    const enableSetTimeout = jest.spyOn(timerUtils, 'enableSetTimeout');
    const enableSetInterval = jest.spyOn(timerUtils, 'enableSetInterval');
    const localStorage = { clear: jest.fn() };
    const sessionStorage = { clear: jest.fn() };

    await quiesceExtensionForeground();
    await quiesceExtensionForeground();
    commitExtensionForegroundReset({ localStorage, sessionStorage });
    commitExtensionForegroundReset({ localStorage, sessionStorage });

    expect(startResetting).toHaveBeenCalledTimes(1);
    expect(resetUtils.getIsResetting()).toBe(true);
    expect(localStorage.clear).toHaveBeenCalledTimes(2);
    expect(sessionStorage.clear).toHaveBeenCalledTimes(2);

    resumeExtensionForeground();
    resumeExtensionForeground();

    expect(endResetting).toHaveBeenCalledTimes(1);
    expect(enableSetTimeout).toHaveBeenCalledTimes(2);
    expect(enableSetInterval).toHaveBeenCalledTimes(1);
    expect(resetUtils.getIsResetting()).toBe(false);
  });

  it('rejects the acknowledgement when foreground storage cannot be cleared', async () => {
    const localStorage = {
      clear: jest.fn(() => {
        throw new OneKeyLocalError('local clear failed');
      }),
    };
    const sessionStorage = { clear: jest.fn() };

    await quiesceExtensionForeground();
    expect(() =>
      commitExtensionForegroundReset({ localStorage, sessionStorage }),
    ).toThrow(
      'Extension foreground storage clear failed: localStorage: local clear failed',
    );
    expect(sessionStorage.clear).toHaveBeenCalledTimes(1);
    expect(resetUtils.getIsResetting()).toBe(true);
  });

  it('does not let a timed-out acknowledgement freeze a UI after resume', async () => {
    let finishWrites: (() => void) | undefined;
    const writesSettled = new Promise<void>((resolve) => {
      finishWrites = resolve;
    });
    jest
      .spyOn(resetUtils, 'waitForResetSensitiveTasksToSettle')
      .mockReturnValue(writesSettled);
    const disableSetTimeout = jest.spyOn(timerUtils, 'disableSetTimeout');
    const localStorage = { clear: jest.fn() };
    const sessionStorage = { clear: jest.fn() };

    const staleAcknowledgement = quiesceExtensionForeground();
    resumeExtensionForeground();
    finishWrites?.();

    await expect(staleAcknowledgement).rejects.toThrow(
      'Extension foreground reset was resumed',
    );
    expect(disableSetTimeout).not.toHaveBeenCalled();
    expect(localStorage.clear).not.toHaveBeenCalled();
    expect(sessionStorage.clear).not.toHaveBeenCalled();
    expect(resetUtils.getIsResetting()).toBe(false);
  });

  it('keeps storage intact when one of two foregrounds times out in prepare', async () => {
    jest.useFakeTimers();
    const localStorageClear = jest.fn();
    const sessionStorageClear = jest.fn();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { clear: localStorageClear },
      writable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: { clear: sessionStorageClear },
      writable: true,
    });
    await quiesceExtensionForeground();
    const bridgeExtBg = {
      ports: {
        'ui-one': buildPort(),
        'ui-two': buildPort(),
      },
      request: jest.fn(({ remoteId }: { remoteId?: string | number | null }) =>
        remoteId === 'ui-one'
          ? Promise.resolve(undefined)
          : new Promise(() => undefined),
      ),
    } as unknown as JsBridgeExtBackground;

    const prepareError = quiesceExtensionForegrounds({
      bridgeExtBg,
      deadlineAt: Date.now() + 1000,
    }).catch((error: unknown) => error as Error);
    await Promise.resolve();
    jest.advanceTimersByTime(1000);

    await expect(prepareError).resolves.toThrow(
      'Extension foreground reset deadline exceeded: ui-two',
    );
    expect(localStorageClear).not.toHaveBeenCalled();
    expect(sessionStorageClear).not.toHaveBeenCalled();
  });
});
