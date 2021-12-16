/* eslint-disable no-undef */
/**
 * Helps pointing to the right folder to load
 */
import path from 'path';

import { session } from 'electron';

import { PROTOCOL } from '../libs/constants';

const init = ({ mainWindow, src }: Dependencies): void => {
  session.defaultSession.protocol.interceptFileProtocol(
    PROTOCOL,
    (request, callback) => {
      let url = request.url.substr(PROTOCOL.length + 1);
      url = path.join(__dirname, '..', '..', 'build', url);
      callback(url);
    },
  );

  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadURL(src);
  });
};

export default init;
