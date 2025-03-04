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
    callbacks: {
      type: string;
      callback: (e: any) => void;
      timestamp: number;
    }[];
  }
> = {
  [EServiceName.WindowsHello]: {
    childProcess: null,
    callbacks: [],
  },
  [EServiceName.CheckBiometricAuthChanged]: {
    childProcess: null,
    callbacks: [],
  },
};

const startService = (key: EServiceName) => {
  if (!processConfig[key].childProcess) {
    processConfig[key].childProcess = utilityProcess.fork(
      path.join(__dirname, `./service/${key}.js`),
    );
  }

  processConfig[key].childProcess?.on(
    'message',
    (e: { type: string; result: boolean }) => {
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
        processConfig[key].callbacks = processConfig[key].callbacks.filter(
          (callbackItem) => !callbacks.includes(callbackItem),
        );
      }
    },
  );
  processConfig[key].childProcess?.on('exit', (code) => {
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

let cacheWindowsHelloSupported: boolean | null = null;
export const checkAvailabilityAsync = async () => {
  if (cacheWindowsHelloSupported === null) {
    cacheWindowsHelloSupported = await Promise.race<boolean>([
      postServiceMessage<boolean>(
        EServiceName.WindowsHello,
        EWindowHelloEventType.CheckAvailabilityAsync,
      ),
      new Promise((resolve) =>
        setTimeout(() => {
          cacheWindowsHelloSupported = false;
          resolve(cacheWindowsHelloSupported);
        }, 500),
      ),
    ]);
  }
  return cacheWindowsHelloSupported;
};

export const requestVerificationAsync = (message: string) =>
  postServiceMessage<{
    success: boolean;
    error?: string;
  }>(
    EServiceName.WindowsHello,
    EWindowHelloEventType.RequestVerificationAsync,
    message,
  );

export const checkBiometricAuthChanged = async () =>
  Promise.race<boolean>([
    postServiceMessage<boolean>(
      EServiceName.CheckBiometricAuthChanged,
      ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged,
    ),
    new Promise((resolve) =>
      setTimeout(() => {
        resolve(false);
      }, 500),
    ),
  ]);
