import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { openPrimeSubscriptionFromWebLanding } from './openPrimeSubscriptionFromWebLanding';

type IPrivateProviderHost = {
  $onekey?: {
    $private?: {
      request?: (args: { method: string }) => Promise<unknown>;
    };
  };
};

describe('openPrimeSubscriptionFromWebLanding', () => {
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
    const openViaDeepLink = jest.fn();
    const privateProvider = {
      request: jest.fn(function request(this: unknown) {
        expect(this).toBe(privateProvider);
        return Promise.resolve({ success: true });
      }),
    };
    host.$onekey = { $private: privateProvider };

    await openPrimeSubscriptionFromWebLanding({ openViaDeepLink });

    expect(privateProvider.request).toHaveBeenCalledWith({
      method: 'wallet_openPrimeSubscription',
    });
    expect(openViaDeepLink).not.toHaveBeenCalled();
  });

  it('falls back to the custom scheme when no extension provider is present', async () => {
    const openViaDeepLink = jest.fn();
    delete host.$onekey;

    await openPrimeSubscriptionFromWebLanding({ openViaDeepLink });

    expect(openViaDeepLink).toHaveBeenCalledTimes(1);
  });

  it('falls back to the custom scheme when the extension request fails', async () => {
    const openViaDeepLink = jest.fn();
    host.$onekey = {
      $private: {
        request: async () => {
          throw new OneKeyLocalError('unsupported method');
        },
      },
    };

    await openPrimeSubscriptionFromWebLanding({ openViaDeepLink });

    expect(openViaDeepLink).toHaveBeenCalledTimes(1);
  });
});
