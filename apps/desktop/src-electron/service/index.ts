import path from 'path';

import { utilityProcess } from 'electron/main';
import Logger from 'electron-log/main';

import { EWindowHelloEventType } from './enum';

import type { UtilityProcess } from 'electron/main';

let windowsHelloChildProcess: UtilityProcess | null = null;
let windowsHelloCallbacks: {
  type: string;
  callback: (e: any) => void;
  timestamp: number;
}[] = [];
export const startServices = () => {
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
