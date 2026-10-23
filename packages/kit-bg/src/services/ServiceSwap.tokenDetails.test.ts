import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import ServiceSwap from './ServiceSwap';

describe('ServiceSwap token detail errors', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  beforeEach(() => {
    jest.spyOn(travelModeManager, 'isActive').mockResolvedValue(false);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it.each([false, true])(
    'retains request errors only when requested (%s)',
    async (throwOnError) => {
      const service = new ServiceSwap({ backgroundApi: {} });
      const error = {
        className: 'OneKeyServerApiError',
        message: 'Token detail unavailable',
      };
      jest.spyOn(service, 'getClient').mockRejectedValueOnce(error);
      const operation = service.fetchSwapTokenDetails({
        networkId: 'evm--1',
        contractAddress: '0xtoken',
        throwOnError,
      });
      if (throwOnError) {
        await expect(operation).rejects.toBe(error);
      } else {
        await expect(operation).resolves.toEqual([]);
      }
    },
  );
});
