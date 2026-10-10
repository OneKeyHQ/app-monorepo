import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { openPrimeSubscriptionInExtension } from './openPrimeSubscriptionInExtension';

type IPrivateProviderHost = {
  $onekey?: {
    $private?: {
      request?: (args: { method: string }) => Promise<unknown>;
    };
  };
};

describe('openPrimeSubscriptionInExtension', () => {
  const host = globalThis as IPrivateProviderHost;
  let originalOneKey: IPrivateProviderHost['$onekey'];

  beforeEach(() => {
    originalOneKey = host.$onekey;
  });

  afterEach(() => {
    if (originalOneKey === undefined) {
      delete host.$onekey;
    } else {
      host.$onekey = originalOneKey;
    }
  });

  it('opens in the extension when the private provider request succeeds', async () => {
    const privateProvider = {
      request: jest.fn(function request(this: unknown) {
        expect(this).toBe(privateProvider);
        return Promise.resolve({ success: true });
      }),
    };
    host.$onekey = { $private: privateProvider };

    await expect(openPrimeSubscriptionInExtension()).resolves.toBe(true);
    expect(privateProvider.request).toHaveBeenCalledWith({
      method: 'wallet_openPrimeSubscription',
    });
  });

  it('reports no extension when the private provider is missing', async () => {
    delete host.$onekey;

    await expect(openPrimeSubscriptionInExtension()).resolves.toBe(false);
  });

  it('reports failure when the extension request fails', async () => {
    host.$onekey = {
      $private: {
        request: async () => {
          throw new OneKeyLocalError('unsupported method');
        },
      },
    };

    await expect(openPrimeSubscriptionInExtension()).resolves.toBe(false);
  });
});
