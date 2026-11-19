import type * as raw from '@onekeyfe/zcash-runtime';

jest.mock('@onekeyfe/zcash-runtime', () => ({
  __esModule: true,
  default: async () => undefined,
  init: jest.fn(async () => undefined),
  storageRequiresWorkerRestart: () => false,
  chainTipAt: jest.fn(),
  openWallet: jest.fn(async () => undefined),
  setLightwalletdUrl: jest.fn(),
  accountByUfvk: jest.fn(() =>
    JSON.stringify({ uuid: 'synthetic-runtime-id' }),
  ),
}));

test.each(['tip', 'initialization'] as const)(
  'a %s trap retires the worker before any later leased runtime call',
  async (phase) => {
    jest.resetModules();
    const runtime = jest.requireMock<typeof raw>('@onekeyfe/zcash-runtime');
    const freshSdk =
      jest.requireActual<typeof import('./index')>('./index').default;
    const carrier = jest.requireActual<typeof import('./carrier')>('./carrier');
    const worker = jest.requireActual<
      typeof import('../../../../utils/privacyChainWorkerClient')
    >('../../../../utils/privacyChainWorkerClient');
    const scope = globalThis as unknown as {
      onmessage: ((event: MessageEvent) => void) | null;
      postMessage: (message: unknown) => void;
    };
    const previous = {
      onmessage: scope.onmessage,
      postMessage: scope.postMessage,
    };
    const messages: Record<string, unknown>[] = [];
    const waiters = new Map<number, (value: Record<string, unknown>) => void>();
    scope.postMessage = (message: unknown) => {
      const reply = message as Record<string, unknown>;
      messages.push(reply);
      waiters.get(reply.id as number)?.(reply);
    };
    const call = (id: number, method: string, args: unknown[]) =>
      new Promise<Record<string, unknown>>((resolve) => {
        waiters.set(id, resolve);
        scope.onmessage?.({ data: { id, method, args } } as MessageEvent);
      });
    try {
      if (phase === 'tip')
        jest
          .mocked(runtime.chainTipAt)
          .mockRejectedValueOnce(new WebAssembly.RuntimeError('unreachable'));
      else
        jest
          .mocked(runtime.init)
          .mockRejectedValueOnce(
            new WebAssembly.RuntimeError('initialization trap'),
          );
      worker.servePrivacyChainWorker({
        label: 'zcash',
        methods: ['runRuntimeSelfTest', 'prepareWalletAccounts'],
        loadApi: async () => freshSdk.getZcashApi(),
        storageRequiresRestart: carrier.storageRequiresWorkerRestart,
      });
      // The network stage asks the node without initializing storage; the storage stage initializes it.
      const first = await call(1, 'runRuntimeSelfTest', [
        phase === 'tip'
          ? { stage: 'network', lightwalletdUrl: 'https://example.invalid' }
          : { stage: 'storage' },
      ]);
      expect(first).toMatchObject({
        id: 1,
        ok: false,
        requiresWorkerRestart: true,
        workerRestartReason: 'trapped',
      });
      const account = {
        network: 'main',
        lightwalletdUrl: 'https://example.invalid',
        ufvk: 'synthetic-ufvk',
        seedFingerprintHex: '00'.repeat(32),
        hdIndex: 0,
        birthdayHeight: 2_000_000,
      };
      const second = await call(2, 'prepareWalletAccounts', [[account]]);
      expect(second).toMatchObject({
        id: 2,
        ok: false,
        requiresWorkerRestart: true,
        workerRestartReason: 'trapped',
      });
      expect(runtime.openWallet).not.toHaveBeenCalled();
      expect(runtime.accountByUfvk).not.toHaveBeenCalled();
      expect(messages).toHaveLength(2);
    } finally {
      Object.assign(scope, previous);
    }
  },
);
