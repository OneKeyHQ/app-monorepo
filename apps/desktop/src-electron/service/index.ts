import path from 'path';

import { utilityProcess } from 'electron/main';
import Logger from 'electron-log/main';

import {
  ECheckBiometricAuthChangedEventType,
  EWindowHelloEventType,
} from './enum';

import type { UtilityProcess } from 'electron/main';

let windowsHelloChildProcess: UtilityProcess | null = null;
let windowsHelloCallbacks: {
  type: string;
  callback: (e: any) => void;
  timestamp: number;
}[] = [];

export const startWindowsHelloService = () => {
  windowsHelloChildProcess = utilityProcess.fork(
    // After build, the directory is 'dist' and WindowsHello file is located in 'dist/service'
    path.join(__dirname, './service/windowsHello.js'),
  );
  windowsHelloChildProcess.on(
    'message',
    (e: { type: string; result: boolean }) => {
      Logger.info('windowsHelloChildProcess-onMessage', e);
      const callbacks = windowsHelloCallbacks.filter(
        (callbackItem) => callbackItem.type === e.type,
      );
      if (callbacks.length) {
        callbacks.forEach((callbackItem) => {
          // Callbacks older than 1 minute will not be executed
          if (Date.now() - callbackItem.timestamp < 60 * 1000) {
            callbackItem.callback(e.result);
          }
        });
        windowsHelloCallbacks = windowsHelloCallbacks.filter(
          (callbackItem) => !callbacks.includes(callbackItem),
        );
      }
    },
  );
  windowsHelloChildProcess.on('exit', (code) => {
    Logger.info('windowsHelloChildProcess--onExit', code);
  });
};

let checkBiometricAuthChangedChildProcess: UtilityProcess | null = null;
let checkBiometricAuthChangedCallbacks: {
  type: string;
  callback: (e: any) => void;
  timestamp: number;
}[] = [];
const startCheckBiometricAuthChangedService = () => {
  checkBiometricAuthChangedChildProcess = utilityProcess.fork(
    path.join(__dirname, './service/checkBiometricAuthChanged.js'),
  );
  checkBiometricAuthChangedChildProcess.on(
    'message',
    (e: { type: string; result: boolean }) => {
      Logger.info('checkBiometricAuthChangedChildProcess-onMessage', e);
      const callbacks = checkBiometricAuthChangedCallbacks.filter(
        (callbackItem) => callbackItem.type === e.type,
      );
      if (callbacks.length) {
        callbacks.forEach((callbackItem) => {
          // Callbacks older than 1 minute will not be executed
          if (Date.now() - callbackItem.timestamp < 60 * 1000) {
            callbackItem.callback(e.result);
          }
        });
        checkBiometricAuthChangedCallbacks =
          checkBiometricAuthChangedCallbacks.filter(
            (callbackItem) => !callbacks.includes(callbackItem),
          );
      }
    },
  );
  checkBiometricAuthChangedChildProcess.on('exit', (code) => {
    Logger.info('checkBiometricAuthChangedChildProcess--onExit', code);
  });
};

export const startServices = () => {
  startWindowsHelloService();
  startCheckBiometricAuthChangedService();
};

let cacheWindowsHelloSupported: boolean | null = null;
export const checkAvailabilityAsync = async () => {
  if (cacheWindowsHelloSupported === null) {
    cacheWindowsHelloSupported = await Promise.race<boolean>([
      new Promise<boolean>((resolve) => {
        windowsHelloCallbacks.push({
          type: EWindowHelloEventType.CheckAvailabilityAsync,
          callback: resolve,
          timestamp: Date.now(),
        });
        windowsHelloChildProcess?.postMessage({
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
    windowsHelloCallbacks.push({
      type: EWindowHelloEventType.RequestVerificationAsync,
      callback: resolve,
      timestamp: Date.now(),
    });
    windowsHelloChildProcess?.postMessage({
      type: EWindowHelloEventType.RequestVerificationAsync,
      params: message,
    });
  });

export const checkBiometricAuthChanged = async () =>
  Promise.race<boolean>([
    new Promise<boolean>((resolve) => {
      checkBiometricAuthChangedCallbacks.push({
        type: ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged,
        callback: resolve,
        timestamp: Date.now(),
      });
      checkBiometricAuthChangedChildProcess?.postMessage({
        type: ECheckBiometricAuthChangedEventType.CheckBiometricAuthChanged,
      });
    }),
    new Promise((resolve) =>
      setTimeout(() => {
        resolve(false);
      }, 500),
    ),
  ]);
