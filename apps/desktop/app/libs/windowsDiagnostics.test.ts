import { EventEmitter } from 'events';
import { PassThrough } from 'stream';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// cspell:ignore dacl

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('electron', () => ({ app: { getVersion: () => '6.7.0' } }));

type SpawnMock = jest.Mock;

function arrangeChild(payload: unknown): { spawn: SpawnMock; input: string[] } {
  const { spawn } = jest.requireMock('child_process') as { spawn: SpawnMock };
  const input: string[] = [];
  spawn.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stdin: PassThrough;
      kill: jest.Mock;
    };
    child.stdout = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = jest.fn();
    child.stdin.on('data', (chunk: Buffer) =>
      input.push(chunk.toString('utf8')),
    );
    child.stdin.on('finish', () => {
      process.nextTick(() => {
        child.stdout.write(JSON.stringify(payload));
        child.stdout.end();
        child.emit('close', 0);
      });
    });
    return child;
  });
  return { spawn, input };
}

function arrangePendingChild(): {
  child: EventEmitter & {
    stdout: PassThrough;
    stdin: PassThrough;
    kill: jest.Mock;
  };
} {
  const { spawn } = jest.requireMock('child_process') as { spawn: SpawnMock };
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stdin: PassThrough;
    kill: jest.Mock;
  };
  child.stdout = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = jest.fn();
  spawn.mockReturnValue(child);
  return { child };
}

describe('Windows diagnostics collector', () => {
  const originalSystemRoot = process.env.SystemRoot;
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.resetModules();
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.SystemRoot = 'C:\\Windows';
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (originalSystemRoot === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = originalSystemRoot;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('whitelists event fields and reports bounded source status', async () => {
    const now = new Date(Date.now() - 1000).toISOString();
    const { spawn, input } = arrangeChild({
      events: [
        {
          timeUtc: now,
          provider: 'Application Error',
          eventId: 1000,
          recordId: 123,
          matchStrength: 'exact_path',
          appVersion: '6.7.0',
          faultingModule: 'kernel32.dll',
          moduleVersion: '10.0.1',
          exceptionCode: '0xc0000005',
          faultOffset: '0xabc',
          processId: '0x1234',
          processStart: '0x123456789abc',
          reportId: '12345678-1234-1234-1234-123456789abc',
          Message: 'seed and C:\\Users\\private',
          rawXml: '<secret />',
        },
        {
          timeUtc: now,
          provider: 'Application Error',
          eventId: 1001,
          faultingModule: 'private',
        },
      ],
      sources: [
        {
          provider: 'Application Error',
          eventId: 1000,
          status: 'ok',
          candidates: 500,
          matched: 1,
          truncated: true,
        },
        {
          provider: 'Windows Error Reporting',
          eventId: 1001,
          status: 'access_denied',
          candidates: 0,
          matched: 0,
          truncated: false,
        },
      ],
      identityUnavailable: false,
    });
    const { collectWindowsDiagnostics } =
      require('./windowsDiagnostics') as typeof import('./windowsDiagnostics');
    const result = await collectWindowsDiagnostics({
      dacl: 'applied',
      extensionPoint: 'applied',
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      provider: 'Application Error',
      eventId: 1000,
      recordId: 123,
      matchStrength: 'exact_path',
      faultingModule: 'kernel32.dll',
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('seed');
    expect(result.collection).toMatchObject({
      status: 'partial',
      truncated: true,
      errors: ['1001:access_denied'],
    });
    expect(spawn).toHaveBeenCalledWith(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      expect.arrayContaining([
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
      ]),
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
    expect(JSON.parse(input.join(''))).toMatchObject({
      rangeStartUtc: expect.any(String),
      rangeEndUtc: expect.any(String),
    });
  });

  it('returns unavailable status without blocking logs if the child fails', async () => {
    const { spawn } = jest.requireMock('child_process') as { spawn: SpawnMock };
    spawn.mockImplementation(() => {
      throw new OneKeyLocalError('spawn failure');
    });
    const { collectWindowsDiagnostics } =
      require('./windowsDiagnostics') as typeof import('./windowsDiagnostics');
    const result = await collectWindowsDiagnostics({
      dacl: 'skipped',
      extensionPoint: 'skipped',
    });
    expect(result.collection).toMatchObject({ status: 'unavailable' });
    expect(result.events).toEqual([]);
  });

  it('kills a child that exceeds the 15-second collection deadline', async () => {
    jest.useFakeTimers();
    const { child } = arrangePendingChild();
    const { collectWindowsDiagnostics } =
      require('./windowsDiagnostics') as typeof import('./windowsDiagnostics');
    const pending = collectWindowsDiagnostics({
      dacl: 'applied',
      extensionPoint: 'applied',
    });
    jest.advanceTimersByTime(15_000);
    const result = await pending;
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(result.events).toEqual([]);
    expect(result.collection).toMatchObject({
      status: 'unavailable',
      errors: ['timeout'],
    });
  });

  it('kills a child whose stdout exceeds 2 MiB', async () => {
    const { child } = arrangePendingChild();
    const { collectWindowsDiagnostics } =
      require('./windowsDiagnostics') as typeof import('./windowsDiagnostics');
    const pending = collectWindowsDiagnostics({
      dacl: 'applied',
      extensionPoint: 'applied',
    });
    child.stdout.write(Buffer.alloc(2 * 1024 * 1024 + 1, 'x'));
    const result = await pending;
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(result.events).toEqual([]);
    expect(result.collection).toMatchObject({
      status: 'unavailable',
      errors: ['output_limit'],
    });
  });
});
