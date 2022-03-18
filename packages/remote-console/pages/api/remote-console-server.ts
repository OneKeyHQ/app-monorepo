/* eslint-disable  */
// @ts-nocheck
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import WebSocket, { WebSocketServer } from 'ws';

import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  name: string;
};

const PORT = 8136;
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.on('message', (data: any, isBinary: any) => {
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
  });
});

const msg = `Console server running2... \nws://127.0.0.1:${PORT}`;
console.log(msg);
console.log('----------------------------------------------');

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  res.status(200).json({ message: msg });
}
