import { app } from 'electron';
import logger from 'electron-log';

import autoUpdateInit from './AutoUpdate';
import BridgeProcess, { BridgeHeart } from './Bridge';
import updateTouchResInit from './TouchRes';

import type { LocalStore } from '../libs/store';
import type { BrowserWindow } from 'electron';

export type Dependencies = {
  mainWindow: BrowserWindow;
  store: LocalStore;
};

let bridgeInstance: BridgeProcess;
export const launchBridge = async () => {
  const bridge = new BridgeProcess();

  try {
    logger.info('bridge: Staring');
    await bridge.start();
    bridgeInstance = bridge;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    BridgeHeart.start(() => restartBridge());
  } catch (err) {
    logger.error(`bridge: Start failed: ${(err as Error).message}`);
    logger.error(err);
  }

  app.on('before-quit', () => {
    logger.info('bridge', 'Stopping when app quit');
    bridge.stop();
  });
};

export const restartBridge = async () => {
  logger.debug('bridge: ', 'Restarting');
  await bridgeInstance?.restart();
};

const init = async ({ mainWindow, store }: Dependencies) => {
  logger.info('Electron main process log path: ', logger.transports.file.file);
  await launchBridge();
  if (!process.mas) {
    autoUpdateInit({ mainWindow, store });
  }
  updateTouchResInit({ mainWindow });
};

export default init;
