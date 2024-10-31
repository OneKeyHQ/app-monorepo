import path from 'path';

import { utilityProcess } from 'electron/main';
import Logger from 'electron-log/main';

import { EWindowHelloEventType } from './enum';

import type { UtilityProcess } from 'electron/main';

let child: UtilityProcess | null = null;
let onMessageCallbacks: { type: string; callback: (e: any) => void }[] = [];
export const startServices = () => {
  child = utilityProcess.fork(
    // After build, the directory is 'dist' and WindowsHello file is located in 'dist/service'
    path.join(__dirname, './service/windowsHello.js'),
  );
  child.on('message', (e: { type: string; result: boolean }) => {
    Logger.info('parent process--onMessage', e);
    const callbacks = onMessageCallbacks.filter(
      (callbackItem) => callbackItem.type === e.type,
    );
    if (callbacks.length) {
      callbacks.forEach((callbackItem) => {
        callbackItem.callback(e.result);
      });
      onMessageCallbacks = onMessageCallbacks.filter(
        (callbackItem) => !callbacks.includes(callbackItem),
      );
    }
  });
};

let isSupport: boolean | null = null;

export const checkAvailabilityAsync = async () => {
  if (isSupport === null) {
    isSupport = await Promise.race<boolean>([
      new Promise<boolean>((resolve) => {
        onMessageCallbacks.push({
          type: EWindowHelloEventType.CheckAvailabilityAsync,
          callback: resolve,
        });
        child?.postMessage({
          type: EWindowHelloEventType.CheckAvailabilityAsync,
        });
      }),
      new Promise((resolve) =>
        setTimeout(() => {
          isSupport = false;
          resolve(false);
        }, 500),
      ),
    ]);
  }
  return isSupport;
};

export const requestVerificationAsync = (message: string) =>
  new Promise<{
    success: boolean;
    error?: string;
  }>((resolve) => {
    onMessageCallbacks.push({
      type: EWindowHelloEventType.RequestVerificationAsync,
      callback: resolve,
    });
    child?.postMessage({
      type: EWindowHelloEventType.RequestVerificationAsync,
      params: message,
    });
  });
