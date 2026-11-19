import {
  createWorkerHostStreamRequester,
  servePrivacyChainWorker,
  workerCarrierHasHostStreamRequest,
} from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

import {
  installXmrHostRequester,
  loadXmrRuntime,
  xmrStorageRequiresWorkerRestart,
} from '../carrier/loadRuntime';

import './xmrSdkWorker';

jest.mock('@onekeyhq/core/src/utils/privacyChainWorkerClient', () => ({
  servePrivacyChainWorker: jest.fn(),
  workerCarrierHasHostStreamRequest: jest.fn(),
  createWorkerHostStreamRequester: jest.fn(),
}));
jest.mock('../carrier/loadRuntime', () => ({
  loadXmrRuntime: jest.fn(),
  installXmrHostRequester: jest.fn(),
  xmrStorageRequiresWorkerRestart: jest.fn(() => false),
}));

afterEach(() => jest.clearAllMocks());

// Captured before call counts are cleared between test cases.
const config = jest.mocked(servePrivacyChainWorker).mock.calls[0][0];

it('relays through the host stream when the carrier has one', async () => {
  jest.mocked(workerCarrierHasHostStreamRequest).mockReturnValue(true);
  await config.loadApi();
  expect(loadXmrRuntime).toHaveBeenCalled();
  expect(createWorkerHostStreamRequester).toHaveBeenCalledTimes(1);
  expect(installXmrHostRequester).toHaveBeenCalledWith(expect.any(Function));
});

it('uses bounded Fetch inside the Worker when the web carrier has no relay', async () => {
  jest.mocked(workerCarrierHasHostStreamRequest).mockReturnValue(false);
  const savedFetch = globalThis.fetch;
  const pageFetch = jest.fn(
    async () => new Response(new Uint8Array([1, 2, 3])),
  );
  globalThis.fetch = pageFetch;
  try {
    await config.loadApi();
    const request = jest.mocked(installXmrHostRequester).mock.calls[0][0];
    await expect(
      request(
        'https://node.example/get_height',
        'application/json',
        new Uint8Array(),
      ),
    ).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(pageFetch).toHaveBeenCalledTimes(1);
    expect(createWorkerHostStreamRequester).not.toHaveBeenCalled();
  } finally {
    globalThis.fetch = savedFetch;
  }
});

it('reports poisoned storage so the client retires the Worker', async () => {
  jest.mocked(workerCarrierHasHostStreamRequest).mockReturnValue(false);
  expect(config.storageRequiresRestart?.()).toBe(false);
  await config.loadApi();
  jest.mocked(xmrStorageRequiresWorkerRestart).mockReturnValue(true);
  expect(config.storageRequiresRestart?.()).toBe(true);
  jest.mocked(xmrStorageRequiresWorkerRestart).mockReturnValue(false);
  expect(config.storageRequiresRestart?.()).toBe(false);
});
