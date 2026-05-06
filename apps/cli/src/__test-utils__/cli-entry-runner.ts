import fs from 'node:fs/promises';

import { VAULT_FILE } from '../infra/vault/paths';

class CliExitError extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`CLI exited with ${String(code ?? 0)}`);
    this.name = 'CliExitError';
  }
}

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

type ISignalName = (typeof SIGNALS)[number];
type IProcessListener = Parameters<typeof process.on>[1];

export type ICliSideEffects = {
  axiosCalls: number;
  keychainGetCalls: number;
  vaultReadCount: number;
};

export type ICliEntryRunResult = {
  exitCode: number | string | null | undefined;
  sideEffects: ICliSideEffects;
  stderr: string;
  stdout: string;
};

function isVaultFilePath(filePath: unknown): boolean {
  if (typeof filePath === 'string') {
    return filePath === VAULT_FILE;
  }
  if (Buffer.isBuffer(filePath)) {
    return filePath.toString() === VAULT_FILE;
  }
  if (filePath instanceof URL) {
    return filePath.pathname === VAULT_FILE;
  }
  return false;
}

function chunkToString(chunk: unknown): string {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk.toString();
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString();
  }
  return String(chunk);
}

export async function runCliEntry(args: string[]): Promise<ICliEntryRunResult> {
  jest.resetModules();

  const keychainGet = jest.fn<Promise<Buffer | null>, [string]>(() =>
    Promise.resolve(null),
  );
  const keychainSet = jest.fn<Promise<void>, [string, Buffer]>(() =>
    Promise.resolve(),
  );
  const keychainDelete = jest.fn<Promise<void>, [string]>(() =>
    Promise.resolve(),
  );
  const axiosGet = jest.fn();
  const axiosPost = jest.fn();
  const axiosDelete = jest.fn();
  const axiosRequest = jest.fn();
  const axiosCreate = jest.fn(() => ({
    delete: axiosDelete,
    get: axiosGet,
    interceptors: { response: { use: jest.fn() } },
    post: axiosPost,
    request: axiosRequest,
  }));

  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;
  const originalSignalListeners = new Map<ISignalName, IProcessListener[]>(
    SIGNALS.map((signal) => [
      signal,
      process.listeners(signal) as IProcessListener[],
    ]),
  );
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const createMockKeychainStorage = () => ({
    delete: keychainDelete,
    get: keychainGet,
    getBackendType: () => 'mock',
    set: keychainSet,
  });
  const MockKeychainStorage = jest.fn(createMockKeychainStorage);

  const mockStorageFactory = jest.fn(createMockKeychainStorage);
  const axiosMock = {
    create: axiosCreate,
    delete: axiosDelete,
    get: axiosGet,
    post: axiosPost,
    request: axiosRequest,
  };

  jest.doMock('../infra/keychain-storage', () => ({
    KeychainStorage: MockKeychainStorage,
    LinuxSecureStorage: MockKeychainStorage,
    MacOSSecureStorage: MockKeychainStorage,
    createSecureStorage: mockStorageFactory,
  }));
  jest.doMock('axios', () => ({
    __esModule: true,
    default: axiosMock,
    ...axiosMock,
  }));

  const fsReadFile = jest.spyOn(fs, 'readFile');
  const processExit = jest.spyOn(process, 'exit').mockImplementation(((
    code?: number | string | null,
  ) => {
    throw new CliExitError(code);
  }) as typeof process.exit);
  const stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(((
    chunk: string | Uint8Array,
  ) => {
    stdoutChunks.push(chunkToString(chunk));
    return true;
  }) as typeof process.stdout.write);
  const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(((
    chunk: string | Uint8Array,
  ) => {
    stderrChunks.push(chunkToString(chunk));
    return true;
  }) as typeof process.stderr.write);

  process.argv = ['node', 'onekey', ...args];
  process.exitCode = 0;

  let exitCode: number | string | null | undefined = 0;
  let importError: unknown;

  try {
    await jest.isolateModulesAsync(async () => {
      try {
        const cliModule = (await import('../cli')) as {
          cliRunPromise?: Promise<void>;
        };
        if (cliModule.cliRunPromise) {
          await cliModule.cliRunPromise.catch((error) => {
            if (error instanceof CliExitError) {
              exitCode = error.code ?? 0;
              return;
            }
            throw error;
          });
        }
        exitCode = process.exitCode ?? exitCode;
      } catch (error) {
        if (error instanceof CliExitError) {
          exitCode = error.code ?? 0;
          return;
        }
        importError = error;
      }
    });
  } finally {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    for (const signal of SIGNALS) {
      const originalListeners = originalSignalListeners.get(signal) ?? [];
      for (const listener of process.listeners(signal)) {
        if (!originalListeners.includes(listener as IProcessListener)) {
          process.off(signal, listener);
        }
      }
    }
  }

  const vaultReadCount = fsReadFile.mock.calls.filter(([filePath]) =>
    isVaultFilePath(filePath),
  ).length;

  const result: ICliEntryRunResult = {
    exitCode,
    sideEffects: {
      axiosCalls:
        axiosGet.mock.calls.length +
        axiosPost.mock.calls.length +
        axiosDelete.mock.calls.length +
        axiosRequest.mock.calls.length +
        axiosCreate.mock.calls.length,
      keychainGetCalls: keychainGet.mock.calls.length,
      vaultReadCount,
    },
    stderr: stderrChunks.join(''),
    stdout: stdoutChunks.join(''),
  };

  processExit.mockRestore();
  stdoutWrite.mockRestore();
  stderrWrite.mockRestore();
  fsReadFile.mockRestore();
  jest.dontMock('../infra/keychain-storage');
  jest.dontMock('axios');

  if (importError) {
    throw importError instanceof Error
      ? importError
      : new CliExitError(String(importError));
  }

  return result;
}
