import path from 'path';

import { utilityProcess } from 'electron';
import Logger from 'electron-log/main';

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
