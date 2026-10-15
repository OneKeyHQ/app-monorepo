import {
  servePrivacyChainWorker,
  workerCarrierHasHostRequest,
} from './privacyChainWorkerClient';

// The Worker side of the handshake, driven through its message handler the
// way a carrier's `ping` reaches it.
describe('privacy chain worker handshake', () => {
  const scope = globalThis as unknown as {
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage: (message: unknown) => void;
  };
  const originalPostMessage = scope.postMessage;

  beforeEach(() => {
    scope.postMessage = jest.fn();
    servePrivacyChainWorker({
      label: 'test',
      methods: [],
      loadApi: async () => ({}),
    });
  });

  afterEach(() => {
    scope.postMessage = originalPostMessage;
    scope.onmessage = null;
  });

  const ping = async (args: unknown[]) => {
    scope.onmessage?.({ data: { id: 1, method: 'ping', args } });
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  // A Worker that installs a relay nobody answers fails every request: the
  // runtime stops using its own fetch once a relay is installed.
  it('records whether the carrier relays HTTP', async () => {
    await ping([{ hostRequest: true }]);
    expect(workerCarrierHasHostRequest()).toBe(true);

    await ping([{ hostRequest: false }]);
    expect(workerCarrierHasHostRequest()).toBe(false);
  });

  it('treats a handshake without the flag as no relay', async () => {
    await ping([{ hostRequest: true }]);
    await ping([]);
    expect(workerCarrierHasHostRequest()).toBe(false);
  });
});
