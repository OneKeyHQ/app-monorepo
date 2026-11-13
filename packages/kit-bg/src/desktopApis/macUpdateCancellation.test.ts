import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  cancelMacUpdate,
  finishMacUpdateCancellation,
  getMacCancellationMarker,
} from './macUpdateCancellation';

const responses: Array<Record<string, unknown>> = [];
const requests: Array<Record<string, unknown>> = [];
jest.mock('electron', () => ({ app: { isPackaged: true } }));
jest.mock('electron-log/main', () => ({ warn: jest.fn() }));
jest.mock('child_process', () => ({
  execFile: (
    _file: string,
    _args: string[],
    _options: unknown,
    callback: (error: Error | null, output: string) => void,
  ) => ({
    stdin: {
      on: jest.fn(),
      end: (request: string) => {
        requests.push(JSON.parse(request));
        const response = responses.shift()!;
        queueMicrotask(() =>
          callback(
            response.error ? new Error('helper failed') : null,
            JSON.stringify(response),
          ),
        );
      },
    },
  }),
}));

let directory: string;
beforeEach(() => {
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: '/fixture/resources',
  });
  responses.length = 0;
  requests.length = 0;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-cancel-journal-'));
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

test('keeps the persistent barrier until cache and pending-task cleanup are acknowledged', async () => {
  const cache = path.join(directory, 'app-shell-updater');
  responses.push({ status: 'cancelled' }, { status: 'finished' });
  await cancelMacUpdate(cache, { captured: true });
  expect(fs.existsSync(getMacCancellationMarker(cache))).toBe(true);
  await finishMacUpdateCancellation(cache);
  expect(fs.existsSync(getMacCancellationMarker(cache))).toBe(false);
  expect(requests.map((request) => request.action)).toEqual([
    'cancel',
    'finish',
  ]);
});

test('a definite pre-removal refusal restores the original preparation without a barrier', async () => {
  const cache = path.join(directory, 'app-shell-updater');
  responses.push({ error: 'AUTHORIZATION_DENIED', unchanged: true });
  await expect(cancelMacUpdate(cache, { captured: true })).rejects.toThrow(
    'INSTALL_FAILED',
  );
  expect(fs.existsSync(getMacCancellationMarker(cache))).toBe(false);
});

test('uncertain removal or cleanup failure preserves the snapshot for an idempotent retry', async () => {
  const cache = path.join(directory, 'app-shell-updater');
  responses.push(
    { error: 'CLEANUP_FAILED', unchanged: false },
    { status: 'cancelled' },
    { status: 'finished' },
  );
  await expect(cancelMacUpdate(cache, { captured: true })).rejects.toThrow();
  await cancelMacUpdate(cache);
  expect(requests[1].snapshot).toEqual({ captured: true });
  await finishMacUpdateCancellation(cache);
  expect(fs.existsSync(getMacCancellationMarker(cache))).toBe(false);
});

test('a no-stage retry does not send JSON null as a native snapshot', async () => {
  const cache = path.join(directory, 'app-shell-updater');
  responses.push(
    { status: 'not-staged' },
    { status: 'not-staged' },
    { status: 'finished' },
  );
  await cancelMacUpdate(cache);
  await cancelMacUpdate(cache);
  expect(requests[1]).toEqual({ action: 'cancel' });
  await finishMacUpdateCancellation(cache);
});

test('cold retry preserves preparation build ownership and never sends it to the native helper', async () => {
  const cache = path.join(directory, 'app-shell-updater');
  const build = { current: 'cancelled-build', previous: 'previous-build' };
  responses.push(
    { error: 'CLEANUP_FAILED', unchanged: false },
    { status: 'cancelled' },
    { status: 'finished' },
  );
  await expect(
    cancelMacUpdate(cache, { captured: true }, build),
  ).rejects.toThrow();
  expect(
    JSON.parse(fs.readFileSync(getMacCancellationMarker(cache), 'utf8')).build,
  ).toEqual(build);
  jest.resetModules();
  const recovered =
    require('./macUpdateCancellation') as typeof import('./macUpdateCancellation');
  await expect(recovered.cancelMacUpdate(cache)).resolves.toEqual(build);
  expect(requests[1]).toEqual({
    action: 'cancel',
    snapshot: { captured: true },
  });
  await recovered.finishMacUpdateCancellation(cache);
});
