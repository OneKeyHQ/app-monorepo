import path from 'path';

import { MessageChannelMain, utilityProcess } from 'electron/main';
import Logger from 'electron-log/main';

import type { UtilityProcess } from 'electron/main';

let child: UtilityProcess | null = null;
export const startServices = () => {
  child = utilityProcess.fork(
    // After build, the directory is 'dist' and WindowsHello file is located in 'dist/service'
    path.join(__dirname, './service/windowsHello.js'),
  );
};

let isSupport = true;
export const checkAvailabilityAsync = () =>
  isSupport
    ? Promise.race([
        new Promise((resolve) => {
          child?.on(
            'message',
            (e: { data: { type: string; result: boolean } }) => {
              Logger.info('checkAvailabilityAsync', e);
              if (e.data.type === 'checkAvailabilityAsync') {
                resolve(e.data.result);
              }
            },
          );
          child?.removeAllListeners('message');
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
