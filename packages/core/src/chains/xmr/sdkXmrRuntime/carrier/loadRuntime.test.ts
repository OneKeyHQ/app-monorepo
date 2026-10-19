import { XMR_RUNTIME_METHODS } from '../methods';

import { loadXmrRuntime, xmrStorageRequiresWorkerRestart } from './loadRuntime';

const mockInit = jest.fn<Promise<void>, []>();
const mockOpenWallet = jest.fn(async () => '{}');

jest.mock('onekey-monero-runtime', () => {
  const { XMR_RUNTIME_METHODS: methods } =
    jest.requireActual<typeof import('../methods')>('../methods');
  const mod: Record<string, unknown> = { __esModule: true };
  for (const method of methods) mod[method] = async () => '{}';
  mod.init = () => mockInit();
  mod.openWallet = () => mockOpenWallet();
  return mod;
});

// An old Worker still holding the storage handles makes the first install
// fail; that must not leave the chain on NOT_INITIALIZED until restart.
describe('xmr runtime storage install', () => {
  it('retries the install when a wallet is opened', async () => {
    expect(XMR_RUNTIME_METHODS).toContain('openWallet');
    mockInit
      .mockRejectedValueOnce(new Error('NoModificationAllowedError'))
      .mockResolvedValueOnce(undefined);

    const api = await loadXmrRuntime();
    await expect(api.openWallet('xmr-mainnet', 'mainnet')).resolves.toBe('{}');
    expect(mockInit).toHaveBeenCalledTimes(2);
    expect(mockOpenWallet).toHaveBeenCalledTimes(1);
  });
});

describe('xmr storage restart signal', () => {
  const runtimeModule = jest.requireMock<Record<string, unknown>>(
    'onekey-monero-runtime',
  );

  afterEach(() => {
    delete runtimeModule.storageRequiresWorkerRestart;
  });

  it('reads as false for an artifact without the export', async () => {
    mockInit.mockResolvedValue(undefined);
    await loadXmrRuntime();
    expect(runtimeModule.storageRequiresWorkerRestart).toBeUndefined();
    expect(xmrStorageRequiresWorkerRestart()).toBe(false);
  });

  it('forwards the runtime export', async () => {
    mockInit.mockResolvedValue(undefined);
    await loadXmrRuntime();
    const check = jest.fn(() => false);
    runtimeModule.storageRequiresWorkerRestart = check;
    expect(xmrStorageRequiresWorkerRestart()).toBe(false);
    check.mockReturnValue(true);
    expect(xmrStorageRequiresWorkerRestart()).toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
  });
});
