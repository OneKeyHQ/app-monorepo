// https://www.npmjs.com/package/ws
import { useEffect } from 'react';

import { Hook, Unhook } from 'console-feed';

function useRemoteConsole() {
  // run once!
  useEffect(() => {
    let ws: WebSocket | null = null;
    if (process.env.NODE_ENV !== 'production') {
      let serverIp = process.env.REMOTE_CONSOLE_SERVER || '';
      console.log(
        'process.env.REMOTE_CONSOLE_SERVER',
        process.env.REMOTE_CONSOLE_SERVER,
      );
      if (!serverIp) {
        console.error(
          'process.env.REMOTE_CONSOLE_SERVER not set, fallback to 127.0.0.1',
        );
        serverIp = '127.0.0.1';
      }

      ws = new WebSocket(`ws://${serverIp}:8136/remote-console`);
      Hook(
        global.console,
        (msg) => {
          if (ws && ws.readyState === ws.OPEN) {
            // console.log('useWebConsolePush >>>>>>>>> ', msg);
            // TODO push to websocket server, server push to ConsoleFeed Web
            ws?.send(JSON.stringify(msg));
          }
        },
        false,
      );
    }

    return () => {
      if (process.env.NODE_ENV !== 'production') {
        ws?.close();
        Unhook(global.console as any);
      }
    };
  }, []);
}

export default useRemoteConsole;
