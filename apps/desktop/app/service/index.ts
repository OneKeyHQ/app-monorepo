import path from 'path';

import { utilityProcess } from 'electron';
import Logger from 'electron-log/main';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

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

  config.childProcess?.on(
    'message',
    (e: {
      type: string;
      result: boolean;
      requestId?: number;
      error?: boolean;
    }) => {
      if (key === EServiceName.CheckBiometricAuthChanged) {
        if (e.requestId === undefined) return;
        const pending = biometricRequests.get(e.requestId);
        if (!pending) return;
        biometricRequests.delete(e.requestId);
        clearTimeout(pending.timer);
        if (e.error || typeof e.result !== 'boolean')
          pending.reject(new OneKeyLocalError('Biometric state check failed'));
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
  config.childProcess?.on('exit', (code) => {
    Logger.info(`${key}ChildProcess--onExit`, code);
    if (key === EServiceName.CheckBiometricAuthChanged) {
      config.childProcess = null;
      biometricRequests.forEach((pending) => {
        clearTimeout(pending.timer);
        pending.reject(new OneKeyLocalError('Biometric state service exited'));
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

let cacheWindowsHelloSupported: boolean | null = null;
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
          cacheWindowsHelloSupported = false;
          resolve(cacheWindowsHelloSupported);
        }, 500),
      ),
    ]);
  }
  return cacheWindowsHelloSupported;
};

export const requestVerificationAsync = async (message: string) => {
  if (!checkServiceExist(EServiceName.WindowsHello)) {
    return {
      success: false,
      error: 'Windows Hello service not found',
    };
  }
  return postServiceMessage<{
    success: boolean;
    error?: string;
  }>(
    EServiceName.WindowsHello,
    EWindowHelloEventType.RequestVerificationAsync,
    message,
  );
};

export const checkBiometricAuthChanged = async () => {
  const child =
    processConfig[EServiceName.CheckBiometricAuthChanged].childProcess;
  if (!child) throw new OneKeyLocalError('Biometric state service unavailable');
  biometricRequestId += 1;
  const requestId = biometricRequestId;
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      biometricRequests.delete(requestId);
      reject(new OneKeyLocalError('Biometric state check timed out'));
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
