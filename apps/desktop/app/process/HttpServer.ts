/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createServer } from 'http';

import { type BrowserWindow, ipcMain } from 'electron';
import logger from 'electron-log/main';
import RNUUID from 'react-native-uuid';

import { ipcMessageKeys } from '../config';

import type { IncomingMessage, Server, ServerResponse } from 'http';

// Tray window shares the same preload and would otherwise reach the
// SERVER_* handlers; gate all of them on main-window sender id.
let mainWindow: BrowserWindow | null = null;

export function setMainWindowForHttpServer(window: BrowserWindow | null) {
  mainWindow = window;
}

function isFromMainWindow(event: Electron.IpcMainEvent): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  return event.sender.id === mainWindow.webContents.id;
}

const init = () => {
  let server: Server;

  const resMap: Record<string, ServerResponse | null> = {};
  ipcMain.on(ipcMessageKeys.SERVER_START, (event, port: number) => {
    if (!isFromMainWindow(event)) {
      logger.warn('[HttpServer] rejected SERVER_START from non-main window');
      return;
    }
    try {
      if (!server) {
        server = createServer(
          { keepAlive: true },
          (request: IncomingMessage, response: ServerResponse) => {
            const requestId = RNUUID.v4() as string;
            const { method, url } = request;
            if (method === 'GET') {
              event.reply(ipcMessageKeys.SERVER_LISTENER, {
                requestId,
                type: method,
                url,
                postData: undefined,
              });
            } else if (method === 'POST') {
              let body: any = [];
              request
                .on('error', (err) => {
                  console.error(err);
                })
                .on('data', (chunk) => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                  body.push(chunk);
                })
                .on('end', () => {
                  body = Buffer.concat(body).toString();

                  event.reply(ipcMessageKeys.SERVER_LISTENER, {
                    requestId,
                    type: method,
                    url,
                    postData: body,
                  });
                });
            }
            resMap[requestId] = response;
          },
        );
      }

      if (!server.listening) {
        server.listen(port);
      }
      const { address } = require('ip');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const ipAddress = address();
      event.reply(ipcMessageKeys.SERVER_START_RES, {
        data: `${ipAddress as string}:${port}`,
        success: true,
      });
    } catch (_e: any) {
      event.reply(ipcMessageKeys.SERVER_START_RES, { success: false });
    }
  });

  ipcMain.on(ipcMessageKeys.SERVER_RESPOND, (event, args) => {
    if (!isFromMainWindow(event)) {
      logger.warn('[HttpServer] rejected SERVER_RESPOND from non-main window');
      return;
    }
    const { requestId, code, type, body } = args;
    const res = resMap[requestId];
    if (res) {
      res.writeHead(code, {
        'Content-Type': type,
        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
      res.end(body);
      resMap[requestId] = null;
    }
  });

  ipcMain.on(ipcMessageKeys.SERVER_STOP, (event) => {
    if (!isFromMainWindow(event)) {
      logger.warn('[HttpServer] rejected SERVER_STOP from non-main window');
      return;
    }
    server?.close();
  });
};

export default init;
