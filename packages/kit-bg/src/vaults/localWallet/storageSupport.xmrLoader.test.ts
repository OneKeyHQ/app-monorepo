import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { loadXmrRuntime } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/carrier/loadRuntime';
import {
  createPrivacyChainWorkerClient,
  servePrivacyChainWorker,
} from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

import { isLocalWalletStorageUnsupportedError } from './storageSupport';

const mockInit = jest.fn<Promise<void>, []>();

jest.mock('@onekeyfe/monero-runtime', () => {
  const { XMR_RUNTIME_METHODS: methods } = jest.requireActual<
    typeof import('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/methods')
  >('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/methods');
  const mod: Record<string, unknown> = { __esModule: true };
  for (const method of methods) mod[method] = async () => '{}';
  mod.init = () => mockInit();
  mod.storageRequiresWorkerRestart = () => false;
  return mod;
});

describe('xmr storage unsupported across the Worker', () => {
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: (message: unknown) => void;
  };
  const saved = {
    onmessage: scope.onmessage,
    postMessage: scope.postMessage,
  };

  afterEach(() => {
    Object.assign(scope, saved);
  });

  it('stays recognisable after the loader retry fails and the Worker serializes it', async () => {
    // wasm-bindgen rejects with the runtime's JSON string, not an Error.
    mockInit.mockImplementation(() =>
      Promise.reject(
        JSON.stringify({
          code: 'STORAGE_UNSUPPORTED',
          params: { missing: 'getDirectory' },
        }),
      ),
    );
    const client = createPrivacyChainWorkerClient<IXmrRuntimeApi>({
      label: 'xmr',
      methods: ['openWallet'],
      createWorker: () => {
        const worker = {
          onmessage: null as ((event: MessageEvent) => void) | null,
          onerror: null,
          onmessageerror: null,
          terminate: jest.fn(),
          postMessage: (_message: unknown): void => undefined,
        };
        scope.postMessage = (message) =>
          queueMicrotask(() =>
            worker.onmessage?.({ data: message } as MessageEvent),
          );
        servePrivacyChainWorker({
          label: 'xmr',
          methods: ['openWallet'],
          loadApi: loadXmrRuntime,
        });
        const receive = scope.onmessage;
        worker.postMessage = (message) =>
          queueMicrotask(() => receive?.({ data: message } as MessageEvent));
        return worker as unknown as Worker;
      },
    });
    try {
      const error = await client.api
        .openWallet('xmr-mainnet', 'mainnet')
        .catch((e: unknown) => e);
      // Installed at load, then retried by openWallet.
      expect(mockInit).toHaveBeenCalledTimes(2);
      expect(error).toBeInstanceOf(Error);
      expect(isLocalWalletStorageUnsupportedError(error)).toBe(true);
    } finally {
      client.reset();
    }
  });
});
