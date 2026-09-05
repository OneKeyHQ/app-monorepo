import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { openPrimeSubscriptionFromWebLanding } from './openPrimeSubscriptionFromWebLanding';

describe('openPrimeSubscriptionFromWebLanding', () => {
  it('opens in the extension when the private provider request succeeds', async () => {
    const openViaDeepLink = jest.fn();
    const request = jest.fn(async () => ({ success: true }));

    await expect(
      openPrimeSubscriptionFromWebLanding({
        getPrivateProvider: () => ({ request }),
        openViaDeepLink,
      }),
    ).resolves.toBe('extension');
    expect(request).toHaveBeenCalledWith({
      method: 'wallet_openPrimeSubscription',
    });
    expect(openViaDeepLink).not.toHaveBeenCalled();
  });

  it('falls back to the custom scheme when the extension request fails', async () => {
    const openViaDeepLink = jest.fn();

    await expect(
      openPrimeSubscriptionFromWebLanding({
        getPrivateProvider: () => ({
          request: async () => {
            throw new OneKeyLocalError('unsupported method');
          },
        }),
        openViaDeepLink,
      }),
    ).resolves.toBe('deeplink');
    expect(openViaDeepLink).toHaveBeenCalledTimes(1);
  });

  it('falls back to the custom scheme when no extension provider is present', async () => {
    const openViaDeepLink = jest.fn();

    await expect(
      openPrimeSubscriptionFromWebLanding({
        getPrivateProvider: () => undefined,
        openViaDeepLink,
      }),
    ).resolves.toBe('deeplink');
    expect(openViaDeepLink).toHaveBeenCalledTimes(1);
  });
});
