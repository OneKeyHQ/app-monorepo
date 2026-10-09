import { EventEmitter } from 'events';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { parseNativeMinidump } from './nativeCrashMinidump';
import { MAX_NATIVE_DUMP_BYTES } from './nativeCrashReport';
import { makeSyntheticDump } from './nativeCrashTestFixture';

const mockApp = Object.assign(new EventEmitter(), {
  getPath: jest.fn(),
  whenReady: jest.fn(() => new Promise<void>(() => {})),
});
const mockCrashReporter = { start: jest.fn() };
const mockFork = jest.fn();
let mockLogPath = '';
jest.mock('electron', () => ({
  app: mockApp,
  crashReporter: mockCrashReporter,
  utilityProcess: { fork: mockFork },
}));
jest.mock('electron-log/main', () => ({
  transports: { file: { getFile: () => ({ path: mockLogPath }) } },
  warn: jest.fn(),
}));

describe('independent native crash process and lifecycle', () => {
  let directory: string;
  let native: typeof import('./nativeCrash');
  let child: EventEmitter & { kill: jest.Mock };
  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    mockCrashReporter.start.mockClear();
    mockFork.mockReset();
    directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-native-fixture-'),
    );
    mockLogPath = path.join(directory, 'logs', 'app.log');
    await fs.mkdir(path.dirname(mockLogPath));
    mockApp.getPath.mockReturnValue(directory);
    child = Object.assign(new EventEmitter(), {
      kill: jest.fn(() => {
        queueMicrotask(() => child.emit('exit', 0));
        return true;
      }),
    });
    mockFork.mockReturnValue(child);
    native = await import('./nativeCrash');
  });
  afterEach(async () => {
    jest.useRealTimers();
    await fs.rm(directory, { recursive: true, force: true });
  });
  test('starts local-only collection once and uses a separate bounded process without inherited environment or streams', async () => {
    native.startNativeCrashCollection();
    native.startNativeCrashCollection();
    expect(mockCrashReporter.start).toHaveBeenCalledTimes(1);
    expect(mockCrashReporter.start).toHaveBeenCalledWith({
      uploadToServer: false,
      ignoreSystemCrashHandler: false,
    });
    const result = native.parseNativeCrashInUtilityProcess('synthetic.dmp');
    expect(mockFork).toHaveBeenCalledWith(
      expect.stringContaining('nativeCrashWorker.js'),
      ['synthetic.dmp'],
      {
        execArgv: ['--max-old-space-size=64'],
        env: {},
        stdio: 'ignore',
        serviceName: 'OneKey native crash parser',
      },
    );
    child.emit('exit', 17);
    await expect(result).resolves.toBeUndefined();
  });
  test('kills a hung parser after five seconds and returns no report', async () => {
    const result = native.parseNativeCrashInUtilityProcess('synthetic.dmp');
    jest.advanceTimersByTime(5000);
    await expect(result).resolves.toBeUndefined();
    expect(child.kill).toHaveBeenCalled();
  });
  test('unavailable crash storage never prevents app startup', () => {
    mockApp.getPath.mockImplementationOnce(() => {
      throw new OneKeyLocalError('fixture path unavailable');
    });
    mockApp.getPath.mockImplementationOnce(() => {
      throw new OneKeyLocalError('fixture path unavailable');
    });
    expect(() => native.startNativeCrashCollection()).not.toThrow();
  });
  test('invalid IPC never becomes a stored report', async () => {
    const result = native.parseNativeCrashInUtilityProcess('synthetic.dmp');
    child.emit('message', { source: 'electron-native', memory: 'SECRET' });
    child.emit('exit', 0);
    await expect(result).resolves.toBeUndefined();
  });
  test('parser launch failure is contained and raw synthetic dump is discarded', async () => {
    jest.useRealTimers();
    native.startNativeCrashCollection();
    mockFork.mockImplementation(() => {
      throw new OneKeyLocalError('simulated launch failure');
    });
    const dump = path.join(directory, 'fixture.dmp');
    await fs.writeFile(dump, makeSyntheticDump());
    const old = new Date(Date.now() - 10_000);
    await fs.utimes(dump, old, old);
    await native.collectNativeCrashReports();
    await expect(fs.stat(dump)).rejects.toThrow();
    expect(
      await fs.readdir(path.join(path.dirname(mockLogPath), 'crashes')),
    ).toEqual([]);
  });
  test('concurrent collectors share one parser and delete the raw fixture after storing validated JSON', async () => {
    jest.useRealTimers();
    native.startNativeCrashCollection();
    const dump = path.join(directory, 'fixture.dmp');
    await fs.writeFile(dump, makeSyntheticDump());
    const report = parseNativeMinidump(dump);
    const old = new Date(Date.now() - 10_000);
    await fs.utimes(dump, old, old);
    let launched: (() => void) | undefined;
    const spawned = new Promise<void>((resolve) => {
      launched = resolve;
    });
    mockFork.mockImplementation(() => {
      launched?.();
      return child;
    });
    const first = native.collectNativeCrashReports();
    const second = native.collectNativeCrashReports();
    await spawned;
    child.emit('message', { ...report, token: 'SECRET' });
    child.emit('exit', 0);
    await Promise.all([first, second]);
    expect(mockFork).toHaveBeenCalledTimes(1);
    await expect(fs.stat(dump)).rejects.toThrow();
    const reportDirectory = path.join(path.dirname(mockLogPath), 'crashes');
    const names = await fs.readdir(reportDirectory);
    expect(names).toHaveLength(1);
    expect(
      await fs.readFile(path.join(reportDirectory, names[0]), 'utf8'),
    ).not.toContain('SECRET');
  });
  test('bounds raw dump size/count/age and leaves symlink targets untouched', async () => {
    jest.useRealTimers();
    native.startNativeCrashCollection();
    const buffer = makeSyntheticDump();
    const fixture = path.join(directory, 'one.dmp');
    await fs.writeFile(fixture, buffer);
    const report = parseNativeMinidump(fixture);
    mockFork.mockImplementation(() => {
      const processChild = Object.assign(new EventEmitter(), {
        kill: jest.fn(() => true),
      });
      queueMicrotask(() => {
        processChild.emit('message', report);
        processChild.emit('exit', 0);
      });
      return processChild;
    });
    const settled = new Date(Date.now() - 10_000);
    for (let index = 0; index < 8; index += 1) {
      const file = path.join(directory, `fixture-${index}.dmp`);
      await fs.writeFile(file, buffer);
      await fs.utimes(file, settled, settled);
    }
    await fs.utimes(fixture, settled, settled);
    const stale = path.join(directory, 'stale.dmp');
    await fs.writeFile(stale, buffer);
    const expired = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await fs.utimes(stale, expired, expired);
    const oversized = path.join(directory, 'oversized.dmp');
    await fs.writeFile(oversized, buffer);
    await fs.truncate(oversized, MAX_NATIVE_DUMP_BYTES + 1);
    await fs.utimes(oversized, settled, settled);
    const target = path.join(directory, 'untouched.txt');
    await fs.writeFile(target, 'SECRET');
    await fs.symlink(target, path.join(directory, 'link.dmp'));
    await native.collectNativeCrashReports();
    expect(mockFork).toHaveBeenCalledTimes(5);
    const remaining = (await fs.readdir(directory)).filter((name) =>
      name.endsWith('.dmp'),
    );
    expect(remaining).toEqual(['link.dmp']);
    expect(await fs.readFile(target, 'utf8')).toBe('SECRET');
    expect(
      await fs.readdir(path.join(path.dirname(mockLogPath), 'crashes')),
    ).toHaveLength(5);
  });
});
