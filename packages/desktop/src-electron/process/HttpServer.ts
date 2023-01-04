/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createServer } from 'http';

import { ipcMain } from 'electron';

import type { Server, ServerResponse } from 'http';

const init = () => {
  // Enable feature on FE once it's ready

  let server: Server;

  const resMap: Record<string, ServerResponse> = {};
  ipcMain.on('server/start', (event, port: number) => {
    try {
      if (!server) {
        server = createServer({ keepAlive: true }, (req, res) => {
          const timestamp = Date.now();
          const requestId = `${timestamp}:${Math.floor(
            Math.random() * 1000000,
          )}`;

          event.reply('server/listener', {
            requestId,
            type: req.method,
            url: req.url,
          });
          resMap[requestId] = res;
        });
      }

      if (!server.listening) {
        server.listen(port);
      }
      const { address } = require('ip');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const ipAddress = address();
      event.reply('server/start/res', {
        data: `${ipAddress as string}:${port}`,
        success: true,
      });
    } catch (e: any) {
      event.reply('server/start/res', { success: false });
    }
  });

  ipcMain.on('server/respond', (_, args) => {
    const { requestId, code, type, body } = args;
    const res = resMap[requestId];
    if (res) {
      res.writeHead(200);
      res.end(body);
    }
  });

  ipcMain.on('server/stop', () => {
    server.close();
  });
};

export default init;
