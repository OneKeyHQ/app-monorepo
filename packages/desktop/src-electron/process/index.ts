import { app, session } from 'electron';
import logger from 'electron-log';

import BridgeProcess from './Bridge';

const filter = {
  urls: ['http://127.0.0.1:21320/*', 'http://localhost:21320/*'],
};

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
  } catch (err) {
    logger.error(`bridge: Start failed: ${(err as Error).message}`);
    logger.error(err);
  }

  app.on('before-quit', () => {
    logger.info('bridge', 'Stopping when app quit');
    bridge.stop();
  });
};

const init = async () => {
  await launchBridge();
};

export default init;
