import { app } from 'electron';
import logger from 'electron-log/main';

import BridgeProcess, { BridgeHeart } from './Bridge';
import HttpServerInit from './HttpServer';

import type { ILocalStore } from '../libs/store';
import type { BrowserWindow } from 'electron';

export type IDependencies = {
  mainWindow: BrowserWindow;
  store: ILocalStore;
};

let bridgeInstance: BridgeProcess;

export const restartBridge = async () => {
  if (!bridgeInstance?.isCurrentSystemSupported()) {
    logger.info('bridge: Skip restart on unsupported system');
    return;
  }

  logger.debug('bridge: ', 'Restarting');
  await bridgeInstance?.restart();
};

export const launchBridge = async () => {
  const bridge = new BridgeProcess();
  if (!bridge.isCurrentSystemSupported()) {
    logger.info('bridge: Skip launch on unsupported system');
    return;
  }

  try {
    logger.info('bridge: Staring');
    await bridge.start();
    bridgeInstance = bridge;
    BridgeHeart.start(() => restartBridge());
  } catch (err) {
    logger.error(`bridge: Start failed: ${(err as Error).message}`);
    logger.error(err);
  }

  app.on('before-quit', () => {
    logger.info('bridge', 'Stopping when app quit');
    void bridge.stop();
  });
};

const init = async () => {
  await launchBridge();
  HttpServerInit();
};

export default init;
