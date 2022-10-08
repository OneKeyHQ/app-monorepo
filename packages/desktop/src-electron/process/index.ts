import { BrowserWindow, app, session } from 'electron';
import logger from 'electron-log';

import autoUpdateInit from './AutoUpdate';
import BridgeProcess, { BridgeHeart } from './Bridge';

export type Dependencies = {
  mainWindow: BrowserWindow;
};

const filter = {
  urls: ['http://127.0.0.1:21320/*', 'http://localhost:21320/*'],
};

let bridgeInstance: BridgeProcess;
export const launchBridge = async () => {
  const bridge = new BridgeProcess();
  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details, callback) => {
      // @ts-ignore electron declares requestHeaders as an empty interface
      details.requestHeaders.Origin = 'https://electron.onekey.so';
      logger.debug('bridge', `Setting header for ${details.url}`);
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    },
  );

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
