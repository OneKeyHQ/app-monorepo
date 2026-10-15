import { randomUUID } from 'crypto';
import path from 'path';

import { utilityProcess } from 'electron';
import Logger from 'electron-log/main';
import { allowSetForegroundWindow } from 'electron-windows-hello';

import {
  ECheckBiometricAuthChangedEventType,
  EWindowHelloEventType,
} from './enum';

import type { UtilityProcess } from 'electron';

enum EServiceName {
  WindowsHello = 'windowsHello',
  CheckBiometricAuthChanged = 'checkBiometricAuthChanged',
}

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
  if (!config.childProcess) {
    config.childProcess = utilityProcess.fork(
      path.join(__dirname, `./service/${key}.js`),
    );
  }

  config.childProcess?.on('message', (e: { type: string; result: boolean }) => {
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
  });
  config.childProcess?.on('exit', (code) => {
    Logger.info(`${key}ChildProcess--onExit`, code);
    if (key === EServiceName.WindowsHello) {
      config.childProcess = null;
      cacheWindowsHelloSupported = null;
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
export const checkAvailabilityAsync = async () => {
  if (!checkServiceExist(EServiceName.WindowsHello)) {
    return false;
  }
  if (cacheWindowsHelloSupported === null) {
    cacheWindowsHelloSupported = await Promise.race([
      postServiceMessage<boolean>(
        EServiceName.WindowsHello,
        EWindowHelloEventType.CheckAvailabilityAsync,
      ),
      new Promise<boolean>((resolve) =>
        setTimeout(() => {
          resolve(false);
        }, 5000),
      ),
    ]);
  }
  return cacheWindowsHelloSupported;
};

export const requestVerificationAsync = async (
  message: string,
): Promise<{ success: boolean; error?: string }> => {
  const child = processConfig[EServiceName.WindowsHello].childProcess;
  const processId = child?.pid;
  if (!child || !processId) {
    return {
      success: false,
      error: 'Windows Hello service not found',
    };
  }
  if (windowsHelloVerificationPending) {
    return { success: false, error: 'device_busy' };
  }
  const owner = globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
  if (!owner || owner.isDestroyed()) {
    return { success: false, error: 'Windows Hello owner window not found' };
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
        function finish(result: { success: boolean; error?: string }) {
          if (settled) return;
          settled = true;
          ownerWindow.removeListener('focus', dispatch);
          ownerWindow.removeListener('closed', onClosed);
          helloProcess.removeListener('message', onMessage);
          helloProcess.removeListener('exit', onExit);
          resolve(result);
        }
        function onClosed() {
          finish({
            success: false,
            error: 'Windows Hello owner window closed',
          });
        }
        function onExit() {
          finish({ success: false, error: 'Windows Hello service exited' });
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
            finish(event.result);
          }
        }
        function dispatch() {
          if (settled || dispatched || !ownerWindow.isFocused()) return;
          try {
            if (!allowSetForegroundWindow(helloProcessId)) {
              finish({
                success: false,
                error: 'Windows Hello foreground denied',
              });
              return;
            }
            dispatched = true;
            helloProcess.postMessage({
              type: EWindowHelloEventType.RequestVerificationAsync,
              requestId,
              params: {
                message: `OneKey — ${message}`,
                windowHandle: Array.from(ownerWindow.getNativeWindowHandle()),
              },
            });
          } catch (error) {
            finish({
              success: false,
              error:
                error instanceof Error ? error.message : 'Windows Hello failed',
            });
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
          finish({
            success: false,
            error:
              error instanceof Error ? error.message : 'Windows Hello failed',
          });
        }
      },
    );
  } finally {
    windowsHelloVerificationPending = false;
  }
};

export const checkBiometricAuthChanged = async () => {
  if (!checkServiceExist(EServiceName.CheckBiometricAuthChanged)) {
    return false;
  }

  return Promise.race<boolean>([
    postServiceMessage<boolean>(
      EServiceName.CheckBiometricAuthChanged,
      ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged,
    ),
    new Promise<boolean>((resolve) =>
      setTimeout(() => {
        resolve(false);
      }, 500),
    ),
  ]);
};
