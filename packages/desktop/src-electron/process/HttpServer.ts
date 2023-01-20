/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createServer } from 'http';

import { ipcMain } from 'electron';
import RNUUID from 'react-native-uuid';

import type { IncomingMessage, Server, ServerResponse } from 'http';

const init = () => {
  let server: Server;

  const resMap: Record<string, ServerResponse | null> = {};
  ipcMain.on('server/start', (event, port: number) => {
    try {
      if (!server) {
        server = createServer(
          { keepAlive: true },
          (request: IncomingMessage, response: ServerResponse) => {
            const requestId = RNUUID.v4() as string;
            const { method, url } = request;
            if (method === 'GET') {
              event.reply('server/listener', {
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

                  event.reply('server/listener', {
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

  ipcMain.on('server/stop', () => {
    server.close();
  });
};

export default init;
