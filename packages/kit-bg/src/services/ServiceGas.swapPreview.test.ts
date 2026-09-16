import { CanceledError } from 'axios';

import { unwrapSwapPreviewTask } from '@onekeyhq/shared/src/utils/swapPreviewTask';

import ServiceGas from './ServiceGas';

type IRequest = {
  signal?: AbortSignal;
  resolve: (value: typeof response) => void;
};
const requests: IRequest[] = [];
const response = {
  data: { data: { result: [], gas: [], feeDecimals: 9, nativeDecimals: 18 } },
};
const mockRequest = jest.fn(
  (_params: unknown, options?: { signal?: AbortSignal }) =>
    new Promise<typeof response>((resolve, reject) => {
      requests.push({ signal: options?.signal, resolve });
      const abort = () => reject(new CanceledError('scope closed'));
      options?.signal?.addEventListener('abort', abort, { once: true });
      if (options?.signal?.aborted) abort();
    }),
);

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('../vaults/impls/fil/utils', () => ({ FIL_MIN_BASE_FEE: '100' }));
jest.mock('../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: { get: async () => ({}) },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: async () => ({ estimateFee: mockRequest }) },
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi = {
      serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
    };
    async getClient() {
      return {
        post: (
          _url: string,
          params: unknown,
          options?: { signal?: AbortSignal },
        ) => mockRequest(params, options),
      };
    }
  },
}));

const params = {
  accountId: 'scope-test',
  networkId: 'evm--1',
  encodedTxs: [{}],
};
const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe('Swap preview fee isolation', () => {
  beforeEach(() => {
    requests.length = 0;
    mockRequest.mockClear();
  });

  it('keeps the Send cancellation handle while Swap finishes', async () => {
    const service = new ServiceGas({ backgroundApi: {} });
    const send = service.batchEstimateFee(params);
    const sendOutcome = send.catch((error: unknown) => error);
    await flush();
    const swap = unwrapSwapPreviewTask(
      service.batchEstimateSwapPreviewFee(params),
    );
    await flush();
    expect(requests[1].signal).toBeUndefined();
    requests[1].resolve(response);
    await swap;
    await service.abortEstimateFee();
    await expect(sendOutcome).resolves.toMatchObject({ name: 'CanceledError' });
  });

  it('does not cancel Swap when Send is cancelled', async () => {
    const service = new ServiceGas({ backgroundApi: {} });
    const swap = unwrapSwapPreviewTask(
      service.batchEstimateSwapPreviewFee(params),
    );
    await flush();
    const send = service.batchEstimateFee(params);
    const sendOutcome = send.catch((error: unknown) => error);
    await flush();
    await service.abortEstimateFee();
    await expect(sendOutcome).resolves.toMatchObject({ name: 'CanceledError' });
    requests[0].resolve(response);
    await expect(swap).resolves.toHaveProperty('txFees');
  });

  it.each([false, true])(
    'preserves the Vault single-fee call without a signal: preview=%s',
    async (preview) => {
      mockRequest.mockImplementationOnce(async (_params, options) => {
        expect(options).toBeUndefined();
        return response;
      });
      const service = new ServiceGas({ backgroundApi: {} });
      const single = {
        networkId: params.networkId,
        accountId: params.accountId,
        accountAddress: '0x0000000000000000000000000000000000000001',
        encodedTx: {},
      };
      if (preview)
        await unwrapSwapPreviewTask(service.estimateSwapPreviewFee(single));
      else await service.estimateFee(single);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    },
  );
});
