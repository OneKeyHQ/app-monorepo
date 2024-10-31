import path from 'path';

import { MessageChannelMain, utilityProcess } from 'electron/main';

import type { UtilityProcess } from 'electron/main';

const { port1, port2 } = new MessageChannelMain();

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
          child?.on('message', (e: { data: { result: boolean } }) => {
            resolve(e.data.result);
            port1.removeAllListeners('message');
          });
          child?.postMessage({ type: 'checkAvailabilityAsync' });
        }),
        new Promise((resolve) =>
          setTimeout(() => {
            isSupport = false;
            resolve(false);
          }, 100),
        ),
      ])
    : Promise.resolve(false);
