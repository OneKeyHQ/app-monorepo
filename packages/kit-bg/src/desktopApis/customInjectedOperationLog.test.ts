import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  CUSTOM_INJECTED_OPERATION_LOG_RELATIVE_DIRECTORY,
  appendCustomInjectedOperationLog,
  readCustomInjectedOperationLogs,
  selectCustomInjectedRecentOperationLogs,
} from './customInjectedOperationLog';

import type { ICustomInjectedOperationLogRecord } from './customInjectedOperationLog';

type ITestOperationEvent = {
  input: Record<string, unknown>;
  error: {
    name: string;
    message: string;
    process: Record<string, unknown>;
  };
};

describe('custom injection operation log', () => {
  let workspace = '';

  beforeEach(async () => {
    workspace = await fs.mkdtemp(
      path.join(os.tmpdir(), 'custom-injection-log-'),
    );
  });

  afterEach(async () => {
    await fs.rm(workspace, { force: true, recursive: true });
  });

  it('writes structured operation lifecycle events and redacts sensitive fields', async () => {
    const operationId = 'operation-1';
    await appendCustomInjectedOperationLog(workspace, {
      operationId,
      operation: 'recording.save',
      status: 'start',
      input: { protocolId: '2626', token: 'must-not-be-logged' },
    });
    const processFailure = Object.assign(new Error('save failed'), {
      process: {
        exitCode: 1,
        stderr: 'generator failed',
        apiKey: 'must-not-be-logged',
      },
    });
    const file = await appendCustomInjectedOperationLog(workspace, {
      operationId,
      operation: 'recording.save',
      status: 'error',
      durationMs: 25,
      error: processFailure,
      result: { relativeFile: 'dapps/defillama/example/recording.json' },
    });

    const events = (await fs.readFile(file, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as unknown as ITestOperationEvent);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(
      expect.objectContaining({
        kind: 'onekey-custom-injection-operation',
        operationId,
        operation: 'recording.save',
        status: 'start',
      }),
    );
    expect(events[0].input.token).toBe('[REDACTED]');
    expect(events[1].error).toEqual(
      expect.objectContaining({ name: 'Error', message: 'save failed' }),
    );
    expect(events[1].error.process).toEqual({
      exitCode: 1,
      stderr: 'generator failed',
      apiKey: '[REDACTED]',
    });
  });

  it('rotates logs and keeps only the configured bounded file count', async () => {
    for (let index = 0; index < 30; index += 1) {
      await appendCustomInjectedOperationLog(
        workspace,
        {
          operationId: `operation-${String(index)}`,
          operation: 'e2e.validate',
          status: 'result',
          result: { output: 'x'.repeat(300) },
        },
        { maxBytes: 1024, maxFiles: 3 },
      );
    }

    const directory = path.join(
      workspace,
      CUSTOM_INJECTED_OPERATION_LOG_RELATIVE_DIRECTORY,
    );
    expect((await fs.readdir(directory)).toSorted()).toEqual([
      'operations.1.jsonl',
      'operations.2.jsonl',
      'operations.jsonl',
    ]);
  });

  it('reads the latest records across active and rotated files', async () => {
    for (let index = 0; index < 20; index += 1) {
      await appendCustomInjectedOperationLog(
        workspace,
        {
          operationId: `operation-${String(index)}`,
          operation: 'protocol.update',
          status: 'result',
          result: { index, output: 'x'.repeat(300) },
        },
        { maxBytes: 1024, maxFiles: 5 },
      );
    }

    const records = await readCustomInjectedOperationLogs(workspace, 5);
    expect(records).toHaveLength(5);
    expect(records.map(({ operationId }) => operationId)).toEqual([
      'operation-15',
      'operation-16',
      'operation-17',
      'operation-18',
      'operation-19',
    ]);
  });

  it('retains older failures alongside the latest records', () => {
    const records = Array.from({ length: 120 }, (_, index) => ({
      schemaVersion: 1 as const,
      kind: 'onekey-custom-injection-operation' as const,
      timestamp: new Date(index * 1000).toISOString(),
      operationId: `operation-${String(index)}`,
      operation: 'e2e.validate',
      status: 'result' as const,
      result: { passed: index !== 5 },
    })) satisfies ICustomInjectedOperationLogRecord[];

    expect(
      selectCustomInjectedRecentOperationLogs(records, 10, 10).map(
        ({ operationId }) => operationId,
      ),
    ).toEqual([
      'operation-5',
      ...Array.from(
        { length: 10 },
        (_, index) => `operation-${String(index + 110)}`,
      ),
    ]);
  });
});
