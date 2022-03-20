/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
// https://www.npmjs.com/package/ws
import { useEffect } from 'react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Hook, Unhook } from 'console-feed';
import { replicator } from 'console-feed/lib/Transform';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

function useRemoteConsole() {
  // Ext is NOT allowed remote-console (like: eval() call)
  const remoteConsoleEnabled =
    process.env.NODE_ENV !== 'production' && !platformEnv.isExtension;
  // run once!
  useEffect(() => {
    let ws: WebSocket | null = null;
    if (remoteConsoleEnabled) {
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
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data) as {
          type: string;
          payload: any;
        };
        if (message.type === 'RemoteConsoleCustomCommand') {
          try {
            // eslint-disable-next-line no-eval
            const result = eval(message.payload);
            if (result instanceof Promise) {
              result.then(console.log).catch(console.error);
            } else {
              console.log(result);
            }
          } catch (e) {
            console.error(e);
          }
        }
      });
      Hook(
        global.console,
        (msg) => {
          if (ws && ws.readyState === ws.OPEN) {
            // console.log('useWebConsolePush >>>>>>>>> ', msg);
            // ws?.send(JSON.stringify(msg));
            const data: string = replicator.encode(msg);
            ws?.send(data);
          }
        },
        false,
      );
    }

    return () => {
      if (remoteConsoleEnabled) {
        ws?.close();
        Unhook(global.console as any);
      }
    };
  }, [remoteConsoleEnabled]);
}

export default useRemoteConsole;
