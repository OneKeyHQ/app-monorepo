import { BrowserWindow, app } from 'electron';
import logger from 'electron-log';

import autoUpdateInit from './AutoUpdate';
import BridgeProcess, { BridgeHeart } from './Bridge';

export type Dependencies = {
  mainWindow: BrowserWindow;
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

const init = async ({ mainWindow }: Dependencies) => {
  await launchBridge();
  autoUpdateInit({ mainWindow });
};

export default init;
