import path from 'path';

import { utilityProcess } from 'electron/main';
import Logger from 'electron-log/main';

import {
  ECheckBiometricAuthChangedEventType,
  EWindowHelloEventType,
} from './enum';

import type { UtilityProcess } from 'electron/main';

const processConfig: Record<
  string,
  {
    childProcess: UtilityProcess | null;
    callbacks: {
      type: string;
      callback: (e: any) => void;
      timestamp: number;
    }[];
  }
> = {
  windowsHello: {
    childProcess: null,
    callbacks: [],
  },
  checkBiometricAuthChanged: {
    childProcess: null,
    callbacks: [],
  },
};

const startService = (key: keyof typeof processConfig) => {
  if (!processConfig[key].childProcess) {
    processConfig[key].childProcess = utilityProcess.fork(
      path.join(__dirname, `./service/${key}.js`),
    );
  }

  processConfig[key].childProcess.on(
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
  processConfig[key].childProcess.on('exit', (code) => {
    Logger.info(`${key}ChildProcess--onExit`, code);
  });
};

export const startServices = () => {
  Object.keys(processConfig).forEach((key) => {
    startService(key);
  });
};

let cacheWindowsHelloSupported: boolean | null = null;
export const checkAvailabilityAsync = async () => {
  if (cacheWindowsHelloSupported === null) {
    cacheWindowsHelloSupported = await Promise.race<boolean>([
      new Promise<boolean>((resolve) => {
        processConfig.windowsHello.callbacks.push({
          type: EWindowHelloEventType.CheckAvailabilityAsync,
          callback: resolve,
          timestamp: Date.now(),
        });
        processConfig.windowsHello.childProcess?.postMessage({
          type: EWindowHelloEventType.CheckAvailabilityAsync,
        });
      }),
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
  new Promise<{
    success: boolean;
    error?: string;
  }>((resolve) => {
    processConfig.windowsHello.callbacks.push({
      type: EWindowHelloEventType.RequestVerificationAsync,
      callback: resolve,
      timestamp: Date.now(),
    });
    processConfig.windowsHello.childProcess?.postMessage({
      type: EWindowHelloEventType.RequestVerificationAsync,
      params: message,
    });
  });

export const checkBiometricAuthChanged = async () =>
  Promise.race<boolean>([
    new Promise<boolean>((resolve) => {
      processConfig.checkBiometricAuthChanged.callbacks.push({
        type: ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged,
        callback: resolve,
        timestamp: Date.now(),
      });
      processConfig.checkBiometricAuthChanged.childProcess?.postMessage({
        type: ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged,
      });
    }),
    new Promise((resolve) =>
      setTimeout(() => {
        resolve(false);
      }, 500),
    ),
  ]);
