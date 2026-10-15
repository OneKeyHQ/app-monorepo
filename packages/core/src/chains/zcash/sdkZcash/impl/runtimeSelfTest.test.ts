import { getKeys, getRuntime, getRuntimeWasm } from './carrier';
import { runRuntimeSelfTest } from './runtimeSelfTest';

jest.mock('./carrier', () => ({
  getKeys: jest.fn(),
  getRuntime: jest.fn(),
  getRuntimeWasm: jest.fn(),
}));

const runtime = {
  storageRequiresWorkerRestart: jest.fn(() => false),
  diagDatabaseExists: jest.fn(),
  chainTipAt: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getRuntime)
    .mockResolvedValue(
      runtime as unknown as Awaited<ReturnType<typeof getRuntime>>,
    );
  jest
    .mocked(getRuntimeWasm)
    .mockResolvedValue(
      runtime as unknown as Awaited<ReturnType<typeof getRuntimeWasm>>,
    );
  runtime.diagDatabaseExists.mockResolvedValue(false);
});

it('checks WASM without initializing the storage VFS', async () => {
  await expect(runRuntimeSelfTest({ stage: 'wasm' })).resolves.toEqual({
    stage: 'wasm',
  });
  expect(getKeys).toHaveBeenCalledTimes(1);
  expect(getRuntimeWasm).toHaveBeenCalledTimes(1);
  expect(getRuntime).not.toHaveBeenCalled();
});

it('waits for the asynchronous VFS probe and propagates its failure', async () => {
  runtime.diagDatabaseExists.mockRejectedValueOnce(
    new Error('VFS unavailable'),
  );
  await expect(runRuntimeSelfTest({ stage: 'storage' })).rejects.toThrow(
    'VFS unavailable',
  );
  expect(runtime.chainTipAt).not.toHaveBeenCalled();
});

it('accepts a missing probe DB without opening a wallet', async () => {
  await expect(runRuntimeSelfTest({ stage: 'storage' })).resolves.toEqual({
    stage: 'storage',
  });
  expect(runtime.diagDatabaseExists).toHaveBeenCalledWith(
    'onekey-zcash-runtime-self-test.db',
  );
});

it('rejects an invalid network height', async () => {
  runtime.chainTipAt.mockResolvedValueOnce(0);
  await expect(runRuntimeSelfTest({ stage: 'network' })).rejects.toThrow(
    'invalid chain tip',
  );
  expect(getRuntime).not.toHaveBeenCalled();
});
