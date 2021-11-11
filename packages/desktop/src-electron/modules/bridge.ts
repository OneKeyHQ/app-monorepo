/* eslint-disable no-param-reassign */
/**
 * Bridge runner
 */
import { app, session } from 'electron';
import BridgeProcess from '../libs/processes/BridgeProcess';

const filter = {
  urls: ['http://127.0.0.1:21320/*', 'http://localhost:21320/*'],
};

const bridgeDev = app.commandLine.hasSwitch('bridge-dev');

const init = async () => {
  const { logger } = global;
  const bridge = new BridgeProcess();

  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details, callback) => {
      details.requestHeaders.Origin = 'http://localhost:8000';
      logger.debug('bridge', `Setting header for ${details.url}`);
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    },
  );

  try {
    if (bridgeDev) {
      await bridge.startDev();
    } else {
      await bridge.start();
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.error('bridge', `Start failed: ${err.message}`);
    }
  }

  app.on('before-quit', () => {
    logger.info('bridge', 'Stopping (app quit)');
    bridge.stop();
  });
};

export default init;
