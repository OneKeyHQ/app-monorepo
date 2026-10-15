import { randomUUID } from 'crypto';
import path from 'path';

import { utilityProcess } from 'electron';
import Logger from 'electron-log/main';

import { BIOLOGY_AUTH_ABORTED_ERROR } from '@onekeyhq/shared/types/password';

import {
  ECheckBiometricAuthChangedEventType,
  EWindowHelloEventType,
} from './enum';

import type { UtilityProcess } from 'electron';

enum EServiceName {
  WindowsHello = 'windowsHello',
  CheckBiometricAuthChanged = 'checkBiometricAuthChanged',
}

let biometricRequestId = 0;
const biometricRequests = new Map<
  number,
  {
    resolve: (result: boolean) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

const processConfig: Record<
  EServiceName,
  {
    childProcess: UtilityProcess | null;
    platforms: NodeJS.Platform[];
    callbacks: {
      type: string;
      callback: (e: any) => void;
      timestamp: number;
    }[];
  }
> = {
  [EServiceName.WindowsHello]: {
    childProcess: null,
    platforms: ['win32'],
    callbacks: [],
  },
  [EServiceName.CheckBiometricAuthChanged]: {
    childProcess: null,
    platforms: ['darwin'],
    callbacks: [],
  },
};

let cacheWindowsHelloSupported: boolean | null = null;

const startService = (key: EServiceName) => {
  const config = processConfig[key];
  if (!config.platforms.includes(process.platform)) {
    return;
  }
  if (config.childProcess) return;
  const child = utilityProcess.fork(
    path.join(__dirname, `./service/${key}.js`),
  );
  config.childProcess = child;

  child.on(
    'message',
    (e: {
      type: string;
      result: boolean;
      requestId?: number;
      error?: boolean;
      diagnostic?: string;
    }) => {
      if (config.childProcess !== child) return;
      if (key === EServiceName.CheckBiometricAuthChanged) {
        if (e.requestId === undefined) return;
        const pending = biometricRequests.get(e.requestId);
        if (!pending) return;
        biometricRequests.delete(e.requestId);
        clearTimeout(pending.timer);
        if (e.error || typeof e.result !== 'boolean')
          pending.reject(new Error('Biometric state check failed'));
        else pending.resolve(e.result);
        return;
      }
      Logger.info(`${key}ChildProcess-onMessage`, e);
      const callbacks = processConfig[key].callbacks.filter(
        (callbackItem) => callbackItem.type === e.type,
      );
      if (callbacks.length) {
        callbacks.forEach((callbackItem) => {
          // Callbacks older than 1 minute will not be executed
          if (Date.now() - callbackItem.timestamp < 60 * 1000) {
            callbackItem.callback(e.result);
          }
        });
        config.callbacks = config.callbacks.filter(
          (callbackItem) => !callbacks.includes(callbackItem),
        );
      }
    },
  );
  child.on('exit', (code) => {
    Logger.info(`${key}ChildProcess--onExit`, code);
    if (config.childProcess !== child) return;
    if (key === EServiceName.WindowsHello) {
      config.childProcess = null;
      cacheWindowsHelloSupported = null;
      config.callbacks = [];
    }
    if (key === EServiceName.CheckBiometricAuthChanged) {
      config.childProcess = null;
      biometricRequests.forEach((pending) => {
        clearTimeout(pending.timer);
        pending.reject(new Error('Biometric state service exited'));
      });
      biometricRequests.clear();
    }
  });
};
export const startServices = () => {
  (Object.keys(processConfig) as EServiceName[]).forEach((key) => {
    startService(key);
  });
};

const postServiceMessage = <T>(
  serviceName: EServiceName,
  type: string,
  params?: any,
): Promise<T> =>
  new Promise<T>((resolve) => {
    processConfig[serviceName].callbacks.push({
      type,
      callback: resolve,
      timestamp: Date.now(),
    });
    processConfig[serviceName].childProcess?.postMessage({
      type,
      params,
    });
  });

const checkServiceExist = (serviceName: EServiceName) => {
  return processConfig[serviceName].childProcess !== null;
};

let windowsHelloVerificationPending = false;
const WINDOWS_HELLO_FOCUS_TIMEOUT_MS = 5000;
const WINDOWS_HELLO_VERIFICATION_TIMEOUT_MS = 5 * 60 * 1000;
export const checkAvailabilityAsync = async () => {
  if (process.platform === 'win32') {
    startService(EServiceName.WindowsHello);
  }
  if (!checkServiceExist(EServiceName.WindowsHello)) {
    return false;
  }
  if (cacheWindowsHelloSupported === null) {
    const child = processConfig[EServiceName.WindowsHello].childProcess;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        postServiceMessage<boolean>(
          EServiceName.WindowsHello,
          EWindowHelloEventType.CheckAvailabilityAsync,
        ).then((supported) => {
          if (processConfig[EServiceName.WindowsHello].childProcess === child) {
            cacheWindowsHelloSupported = supported;
          }
          return supported;
        }),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  return cacheWindowsHelloSupported;
};

export const requestVerificationAsync = async (
  message: string,
): Promise<{ success: boolean; error?: string }> => {
  if (process.platform !== 'win32') {
    return { success: false, error: '' };
  }
  const child = processConfig[EServiceName.WindowsHello].childProcess;
  const processId = child?.pid;
  if (!child || !processId) {
    Logger.info(
      'Windows Hello verification interrupted',
      'Service unavailable',
    );
    return {
      success: false,
      error: BIOLOGY_AUTH_ABORTED_ERROR,
    };
  }
  if (windowsHelloVerificationPending) {
    Logger.info(
      'Windows Hello verification interrupted',
      'Verification pending',
    );
    return { success: false, error: BIOLOGY_AUTH_ABORTED_ERROR };
  }
  const owner = globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
  if (!owner || owner.isDestroyed()) {
    Logger.info('Windows Hello verification interrupted', 'Owner unavailable');
    return { success: false, error: BIOLOGY_AUTH_ABORTED_ERROR };
  }
  windowsHelloVerificationPending = true;
  const requestId = randomUUID();
  try {
    return await new Promise<{ success: boolean; error?: string }>(
      (resolve) => {
        const ownerWindow = owner;
        const helloProcess = child;
        const helloProcessId = processId;
        let dispatched = false;
        let settled = false;
        let completionTimer: ReturnType<typeof setTimeout> | undefined;
        const completionDeadline =
          Date.now() + WINDOWS_HELLO_VERIFICATION_TIMEOUT_MS;
        const focusDeadline = Date.now() + WINDOWS_HELLO_FOCUS_TIMEOUT_MS;
        const focusTimer = setTimeout(
          () => abort('Windows Hello owner focus timed out'),
          WINDOWS_HELLO_FOCUS_TIMEOUT_MS,
        );
        function finish(
          result: { success: boolean; error?: string },
          diagnostic?: string,
        ) {
          if (settled) return;
          settled = true;
          clearTimeout(focusTimer);
          clearTimeout(completionTimer);
          ownerWindow.removeListener('focus', dispatch);
          ownerWindow.removeListener('closed', onClosed);
          helloProcess.removeListener('message', onMessage);
          helloProcess.removeListener('exit', onExit);
          if (diagnostic) {
            Logger.info('Windows Hello verification interrupted', diagnostic);
          } else if (
            !result.success &&
            result.error &&
            result.error !== 'user_cancel' &&
            result.error !== BIOLOGY_AUTH_ABORTED_ERROR
          ) {
            Logger.info('Windows Hello verification failed', result.error);
          }
          resolve(
            result.success
              ? { success: true }
              : {
                  success: false,
                  error:
                    result.error === 'user_cancel' ||
                    result.error === BIOLOGY_AUTH_ABORTED_ERROR
                      ? result.error
                      : '',
                },
          );
        }
        function abort(diagnostic: string) {
          if (settled) return;
          finish(
            { success: false, error: BIOLOGY_AUTH_ABORTED_ERROR },
            diagnostic,
          );
          const config = processConfig[EServiceName.WindowsHello];
          if (dispatched && config.childProcess === helloProcess) {
            config.childProcess = null;
            config.callbacks = [];
            cacheWindowsHelloSupported = null;
            try {
              helloProcess.kill();
            } catch (error) {
              Logger.info('Windows Hello service termination failed', error);
            }
          }
        }
        function onClosed() {
          abort('Windows Hello owner window closed');
        }
        function onExit() {
          abort('Windows Hello service exited');
        }
        function onMessage(event: {
          type: EWindowHelloEventType;
          requestId: string;
          result: { success: boolean; error?: string };
        }) {
          if (
            dispatched &&
            event.requestId === requestId &&
            event.type === EWindowHelloEventType.RequestVerificationAsync
          ) {
            if (Date.now() >= completionDeadline) {
              abort('Windows Hello verification timed out');
              return;
            }
            finish(event.result);
          }
        }
        function dispatch() {
          if (settled || dispatched) return;
          if (Date.now() >= focusDeadline) {
            abort('Windows Hello owner focus timed out');
            return;
          }
          try {
            if (!ownerWindow.isFocused()) return;
            const { allowSetForegroundWindow } =
              require('electron-windows-hello') as typeof import('electron-windows-hello');
            if (!allowSetForegroundWindow(helloProcessId)) {
              abort('Windows Hello foreground denied');
              return;
            }
            dispatched = true;
            clearTimeout(focusTimer);
            completionTimer = setTimeout(
              () => abort('Windows Hello verification timed out'),
              completionDeadline - Date.now(),
            );
            helloProcess.postMessage({
              type: EWindowHelloEventType.RequestVerificationAsync,
              requestId,
              params: {
                message: `OneKey — ${message}`,
                windowHandle: Array.from(ownerWindow.getNativeWindowHandle()),
              },
            });
          } catch (error) {
            abort(
              error instanceof Error ? error.message : 'Windows Hello failed',
            );
          }
        }
        ownerWindow.once('closed', onClosed);
        ownerWindow.once('focus', dispatch);
        helloProcess.on('message', onMessage);
        helloProcess.once('exit', onExit);
        try {
          if (ownerWindow.isMinimized()) ownerWindow.restore();
          ownerWindow.show();
          ownerWindow.focus();
          dispatch();
        } catch (error) {
          abort(
            error instanceof Error ? error.message : 'Windows Hello failed',
          );
        }
      },
    );
  } finally {
    windowsHelloVerificationPending = false;
  }
};

export const checkBiometricAuthChanged = async () => {
  const child =
    processConfig[EServiceName.CheckBiometricAuthChanged].childProcess;
  if (!child) {
    // eslint-disable-next-line onekey/no-raw-error -- app error imports exceed the utility bundle budget.
    throw new Error('Biometric state service unavailable');
  }
  biometricRequestId += 1;
  const requestId = biometricRequestId;
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      biometricRequests.delete(requestId);
      reject(new Error('Biometric state check timed out'));
    }, 500);
    biometricRequests.set(requestId, { resolve, reject, timer });
    try {
      child.postMessage({
        type: ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged,
        requestId,
      });
    } catch (error) {
      clearTimeout(timer);
      biometricRequests.delete(requestId);
      reject(error);
    }
  });
};
