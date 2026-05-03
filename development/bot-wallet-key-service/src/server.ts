import { createServer } from 'node:http';
import { join } from 'node:path';

import { createRequestHandler } from './router';
import { Store } from './store';

// Hard-coded loopback only — no env vars, no externalization. PoC scope.
const HOST = '127.0.0.1';
const PORT = 8787;
const DATA_FILE = join(__dirname, '..', 'data', 'keys.json');

export function startServer(): { close: () => Promise<void> } {
  const store = new Store({ filePath: DATA_FILE });
  const handler = createRequestHandler({ store });
  const server = createServer((req, res) => {
    void handler(req, res);
  });

  server.listen(PORT, HOST, () => {
    process.stderr.write(`listening on ${HOST}:${PORT}\n`);
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

if (require.main === module) {
  startServer();
}
