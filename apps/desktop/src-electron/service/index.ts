import path from 'path';

import { utilityProcess } from 'electron/main';
import Logger from 'electron-log/main';

import type { UtilityProcess } from 'electron/main';

let child: UtilityProcess | null = null;
let onMessageCallbacks: { type: string; callback: (e: any) => void }[] = [];
export const startServices = () => {
  child = utilityProcess.fork(
    // After build, the directory is 'dist' and WindowsHello file is located in 'dist/service'
    path.join(__dirname, './service/windowsHello.js'),
  );
  child.on('message', (e: { data: { type: string; result: boolean } }) => {
    const callbacks = onMessageCallbacks.filter(
      (callbackItem) => callbackItem.type === e.data.type,
    );
    if (callbacks.length) {
      callbacks.forEach((callbackItem) => {
        callbackItem.callback(e.data.result);
      });
      onMessageCallbacks = onMessageCallbacks.filter(
        (callbackItem) => !callbacks.includes(callbackItem),
      );
    }
  });
};

let isSupport = true;

export const checkAvailabilityAsync = () =>
  isSupport
    ? Promise.race([
        new Promise((resolve) => {
          onMessageCallbacks.push({
            type: 'checkAvailabilityAsync',
            callback: resolve,
          });
          child?.postMessage({ type: 'checkAvailabilityAsync' });
        }),
        new Promise((resolve) =>
          setTimeout(() => {
            isSupport = false;
            resolve(false);
          }, 500),
        ),
      ])
    : Promise.resolve(false);
