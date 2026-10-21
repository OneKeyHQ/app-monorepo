import {
  createPrivacyChainWorkerClient,
  getPrivacyChainRuntimeFailure,
} from './privacyChainWorkerClient';

// A Worker that crashed at load, or never answered, must reject with an
// error the app can word for the user, not a bare transport message.
describe('privacy chain worker carrier failures', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createSilentWorker() {
    const worker = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      onmessageerror: null as (() => void) | null,
      postMessage: jest.fn(),
      terminate: jest.fn(),
    };
    return worker;
  }

  it('tags a handshake that never answers', async () => {
    const worker = createSilentWorker();
    const client = createPrivacyChainWorkerClient<{ ping: () => void }>({
      label: 'zcash',
      methods: ['ping'],
      createWorker: () => worker as unknown as Worker,
      handshakeTimeoutMs: 100,
    });

    const ready = client.ensureReady();
    const settled = ready.catch((error: unknown) => error);
    jest.advanceTimersByTime(100);
    const error = await settled;

    expect((error as Error).message).toBe('zcash worker: handshake timed out');
    expect(getPrivacyChainRuntimeFailure(error)).toBe('handshake');
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('tags a Worker that crashes while booting', async () => {
    const worker = createSilentWorker();
    const client = createPrivacyChainWorkerClient<{ ping: () => void }>({
      label: 'xmr',
      methods: ['ping'],
      createWorker: () => worker as unknown as Worker,
    });

    const settled = client.ensureReady().catch((error: unknown) => error);
    worker.onerror?.({ message: 'wasm load failed' } as ErrorEvent);
    const error = await settled;

    expect(getPrivacyChainRuntimeFailure(error)).toBe('crashed');
  });

  it('leaves runtime errors untagged', () => {
    expect(
      getPrivacyChainRuntimeFailure(
        Object.assign(new Error('NETWORK_ERROR'), { code: 'NETWORK_ERROR' }),
      ),
    ).toBeUndefined();
    expect(getPrivacyChainRuntimeFailure(undefined)).toBeUndefined();
  });
});
