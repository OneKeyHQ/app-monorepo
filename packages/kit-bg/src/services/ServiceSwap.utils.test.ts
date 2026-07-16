import { buildSwapRequestErrorToastPayload } from './ServiceSwap.utils';

describe('buildSwapRequestErrorToastPayload', () => {
  it('keeps the request ID out of visible text while preserving diagnostics', () => {
    const payload = buildSwapRequestErrorToastPayload({
      message: 'Minimum value is 10 USDT',
      requestId: 'req-123',
    });

    expect(payload).toEqual({
      diagnosticText: 'RequestId: req-123',
      method: 'error',
      requestId: 'req-123',
      title: 'Minimum value is 10 USDT',
    });
    expect(payload).not.toHaveProperty('message');
  });

  it('omits request diagnostics when the error has no request ID', () => {
    expect(buildSwapRequestErrorToastPayload()).toEqual({
      diagnosticText: undefined,
      method: 'error',
      requestId: undefined,
      title: 'Request failed',
    });
  });
});
