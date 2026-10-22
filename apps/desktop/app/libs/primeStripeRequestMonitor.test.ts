import { EDesktopIpcChannel } from '@onekeyhq/shared/src/consts/desktopIpcChannels';

import { createPrimeStripeRequestMonitor } from './primeStripeRequestMonitor';

const paymentScript =
  'https://js.stripe.com/v3/fingerprinted/js/elements-inner-payment-234d3eb494a5eb5be3b8cfc6dbf115d7.js';

describe('Prime Stripe HTTP failure monitor', () => {
  const send = jest.fn();
  const isDestroyed = jest.fn(() => false);
  let mainId = 10;
  const monitor = createPrimeStripeRequestMonitor(() => ({
    id: mainId,
    send,
    isDestroyed,
  }));

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(5000);
    jest.clearAllMocks();
    mainId = 10;
    isDestroyed.mockReturnValue(false);
  });

  afterEach(() => {
    monitor.forgetRequest(1);
    jest.useRealTimers();
  });

  it.each([
    paymentScript,
    'https://js.stripe.com/v3/elements-inner-payment-0eb8f51ef43e813487d91f6e011d427f.html',
    'https://js.stripe.com/v3/fingerprinted/js/controller-eac1b5a1da091fd105294d747d70a2bf.js',
    'https://js.stripe.com/v3/controller-with-preconnect-dbb4500af186f85aefed00e840b3844f.html',
    'https://js.stripe.com/v3/fingerprinted/css/elements-inner-payment-e-5f133dbf15102a2d57d73689e0c8c9bc.css',
    'https://js.stripe.com/v3/elements-inner-accessory-target-6340a50f892ae857b4c7ee76f02f0744.html',
  ])(
    'signals a real 403 at response headers without exposing the URL: %s',
    (url) => {
      const request = { id: 1, webContentsId: 10, url: `${url}?private=value` };
      monitor.recordRequest(request);
      jest.advanceTimersByTime(100);
      monitor.receiveResponse({ ...request, statusCode: 403 });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        EDesktopIpcChannel.PRIME_STRIPE_RESOURCE_FORBIDDEN,
        { requestStartedAt: 5000, statusCode: 403 },
      );
      monitor.receiveResponse({ ...request, statusCode: 403 });
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  it.each([200, 302, 404, 500])(
    'does not signal HTTP %i as 403',
    (statusCode) => {
      const request = { id: 1, webContentsId: 10, url: paymentScript };
      monitor.recordRequest(request);
      monitor.receiveResponse({ ...request, statusCode });
      expect(send).not.toHaveBeenCalled();
    },
  );

  it.each([
    'https://js.stripe.com.evil.test/v3/fingerprinted/js/elements-inner-payment-123.js',
    'http://js.stripe.com/v3/elements-inner-payment-123.html',
    'https://js.stripe.com/v3/m-outer-123.html',
    'https://js.stripe.com/v3/hcaptcha-invisible-123.html',
    'not-a-url',
  ])('ignores unrelated resources and lookalike origins: %s', (url) => {
    const request = { id: 1, webContentsId: 10, url };
    monitor.recordRequest(request);
    monitor.receiveResponse({ ...request, statusCode: 403 });
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores another window and requests which were not observed starting', () => {
    const request = { id: 1, webContentsId: 20, url: paymentScript };
    monitor.recordRequest(request);
    monitor.receiveResponse({ ...request, statusCode: 403 });
    monitor.receiveResponse({ ...request, webContentsId: 10, statusCode: 403 });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not forward an old window response to a replacement window', () => {
    const request = { id: 1, webContentsId: 10, url: paymentScript };
    monitor.recordRequest(request);
    mainId = 20;
    monitor.receiveResponse({ ...request, statusCode: 403 });
    expect(send).not.toHaveBeenCalled();
  });

  it('cleans up aborted requests and ignores destroyed windows', () => {
    const request = { id: 1, webContentsId: 10, url: paymentScript };
    monitor.recordRequest(request);
    monitor.forgetRequest(1);
    monitor.receiveResponse({ ...request, statusCode: 403 });
    monitor.recordRequest(request);
    isDestroyed.mockReturnValue(true);
    monitor.receiveResponse({ ...request, statusCode: 403 });
    expect(send).not.toHaveBeenCalled();
  });
});
