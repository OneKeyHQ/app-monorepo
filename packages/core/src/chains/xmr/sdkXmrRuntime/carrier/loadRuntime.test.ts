import { servePrivacyChainWorker } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

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
  mod.storageRequiresWorkerRestart = () => false;
  return mod;
});

// A stale Worker still holding the storage handles makes the first install
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

  const defaultCheck = runtimeModule.storageRequiresWorkerRestart;

  afterEach(() => {
    runtimeModule.storageRequiresWorkerRestart = defaultCheck;
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

describe('xmr runtime trap guard', () => {
  it('blocks an already admitted call before a second synchronous export runs', async () => {
    const api = await loadXmrRuntime();
    const scope = globalThis as unknown as {
      onmessage: ((event: MessageEvent) => void) | null;
      postMessage: (message: unknown) => void;
    };
    const saved = {
      onmessage: scope.onmessage,
      postMessage: scope.postMessage,
    };
    const callsBeforeTrap = mockOpenWallet.mock.calls.length;
    mockOpenWallet.mockImplementationOnce(() => {
      throw new WebAssembly.RuntimeError('unreachable');
    });
    const responses: unknown[] = [];
    const answered = new Promise<void>((resolve) => {
      scope.postMessage = (message) => {
        responses.push(message);
        if (responses.length === 2) resolve();
      };
    });
    try {
      servePrivacyChainWorker({
        label: 'xmr',
        methods: ['openWallet'],
        loadApi: async () => api,
      });
      for (const id of [1, 2]) {
        scope.onmessage?.({
          data: { id, method: 'openWallet', args: ['xmr-mainnet', 'mainnet'] },
        } as MessageEvent);
      }
      await answered;
      expect(mockOpenWallet.mock.calls.length - callsBeforeTrap).toBe(1);
      expect(responses).toEqual([
        expect.objectContaining({
          ok: false,
          requiresWorkerRestart: true,
          workerRestartReason: 'trapped',
        }),
        expect.objectContaining({
          ok: false,
          requiresWorkerRestart: true,
          workerRestartReason: 'trapped',
        }),
      ]);
    } finally {
      Object.assign(scope, saved);
    }
  });
});
