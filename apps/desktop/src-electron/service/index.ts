import path from 'path';

import { utilityProcess } from 'electron/main';
import Logger from 'electron-log/main';

import { EWindowHelloEventType } from './enum';

import type { UtilityProcess } from 'electron/main';

let windowsHelloChild: UtilityProcess | null = null;
let windowsHelloCallbacks: { type: string; callback: (e: any) => void }[] = [];
export const startServices = () => {
  windowsHelloChild = utilityProcess.fork(
    // After build, the directory is 'dist' and WindowsHello file is located in 'dist/service'
    path.join(__dirname, './service/windowsHello.js'),
  );
  windowsHelloChild.on('message', (e: { type: string; result: boolean }) => {
    Logger.info('parent process--onMessage', e);
    const callbacks = windowsHelloCallbacks.filter(
      (callbackItem) => callbackItem.type === e.type,
    );
    if (callbacks.length) {
      callbacks.forEach((callbackItem) => {
        callbackItem.callback(e.result);
      });
      windowsHelloCallbacks = windowsHelloCallbacks.filter(
        (callbackItem) => !callbacks.includes(callbackItem),
      );
    }
  });
};

let cacheWindowsHelloSupported: boolean | null = null;
export const checkWindowsHelloAvailabilityAsync = async () => {
  if (cacheWindowsHelloSupported === null) {
    cacheWindowsHelloSupported = await Promise.race<boolean>([
      new Promise<boolean>((resolve) => {
        windowsHelloCallbacks.push({
          type: EWindowHelloEventType.CheckAvailabilityAsync,
          callback: resolve,
        });
        windowsHelloChild?.postMessage({
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
    });
    windowsHelloChild?.postMessage({
      type: EWindowHelloEventType.RequestVerificationAsync,
      params: message,
    });
  });
