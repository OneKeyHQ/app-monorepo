/*
- node: node_modules/ws/index.js
- browser: window.WebSocket
- rn: global.WebSocket
*/
// import { usingBrowserWebSocket } from 'engine.io-client/build/esm/transports/websocket-constructor.js';
import ws from 'ws';

/*
socket.io-client -> engine.io-client -> ws

- browser or RN
node_modules/engine.io-client/build/esm/transports/websocket-constructor.browser.js
- NODE
node_modules/engine.io-client/build/esm/transports/websocket-constructor.js
 */

import platformEnv from '../../platformEnv';

// xrpl browser defined ws:  node_modules/xrpl/dist/npm/client/WSWrapper.js
export function normalizeWs() {
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    global.$$ws =
      platformEnv.isRuntimeBrowser || platformEnv.isNative ? WebSocket : ws;

    // console.log(
    //   'list all ws object keys >>>>> ',
    //   {
    //     usingBrowserWebSocket,
    //   },
    //   Object.keys(ws),
    // );
  }
  // TODO node ws and rn WebSocket supprts custom headers, but NOT browser WebSocket
}
