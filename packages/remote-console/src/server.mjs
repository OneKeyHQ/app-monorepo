import WebSocket, { WebSocketServer } from 'ws';

const PORT = 8136;
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.on('message', (data, isBinary) => {
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
  });
});

const msg = `Remote Console websocket server running... \nws://127.0.0.1:${PORT}`;
console.log(msg);
console.log('----------------------------------------------');

export default {
  msg
}
