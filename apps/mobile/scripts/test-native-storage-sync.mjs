import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { getBridgeServer } from '@react-native-harness/bridge/server';
import {
  getMetroInstance,
  prewarmMetroBundle,
} from '@react-native-harness/bundler-metro';
import { getConfig } from '@react-native-harness/config';

const { values } = parseArgs({
  options: { platform: { type: 'string' }, output: { type: 'string' } },
});
assert(
  ['ios', 'android'].includes(values.platform),
  'Pass --platform ios|android',
);
const output = values.output && path.resolve(values.output);
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
process.env.RN_HARNESS = 'true';
if (values.platform === 'android') {
  process.env.RN_HARNESS_NATIVE_STORAGE_BACKGROUND = 'true';
}
const { config, projectRoot } = await getConfig(process.cwd());
const platform = config.runners.find(
  (runner) => runner.name === values.platform,
);
assert(platform, 'No matching harness runner');
const controller = new AbortController();
const bridges = [];
let metro;
let timeout;
async function dispose() {
  clearTimeout(timeout);
  controller.abort();
  for (const bridge of bridges) {
    for (const socket of bridge.ws.clients) socket.terminate();
    bridge.dispose();
  }
  await metro?.dispose();
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => void dispose().then(() => process.exit(130)));
}
try {
  const mainBridge = await getBridgeServer({
    port: config.webSocketPort,
    timeout: config.bridgeTimeout,
    context: { platform },
  });
  bridges.push(mainBridge);
  let testBridge = mainBridge;
  if (values.platform === 'android') {
    testBridge = await getBridgeServer({
      port: config.webSocketPort + 1,
      timeout: config.bridgeTimeout,
      context: { platform },
    });
    bridges.push(testBridge);
  }
  const ready = new Promise((resolve) => testBridge.once('ready', resolve));
  metro = await getMetroInstance(
    { projectRoot, harnessConfig: config },
    controller.signal,
  );
  await prewarmMetroBundle({
    projectRoot,
    entryPoint: config.entryPoint,
    platform: values.platform,
    dev: true,
    minify: false,
    signal: controller.signal,
  });
  console.log(
    'Ready for one manual App launch. This script never starts or restarts the App.',
  );
  await Promise.race([
    ready,
    new Promise((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new Error('Test runtime did not connect; no App restart attempted'),
          ),
        config.bundleStartTimeout,
      );
    }),
  ]);
  clearTimeout(timeout);
  const client = testBridge.rpc.clients.at(-1);
  assert(client, 'No connected native test runtime');
  const result = await client.runTests(
    'e2e/native-storage-sync.native-harness.ts',
    {
      setupFiles: [],
      setupFilesAfterEnv: [],
      runner: platform.runner,
    },
  );
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (output) fs.writeFileSync(output, json);
  console.log(json);
  const tests = result.suites.flatMap((suite) => suite.tests);
  assert.equal(result.status, 'passed');
  assert.equal(tests.length, 3);
  assert(tests.every((test) => test.status === 'passed'));
} finally {
  await dispose();
}
