import {
  buildSwapQuoteSessionTransportErrorEventV2,
  normalizeSwapQuoteSessionTransportErrorV2,
} from './ServiceSwapQuoteEvent';

describe('ServiceSwapQuoteEvent', () => {
  it('preserves the extension transport payload without reading readyState as HTTP status', () => {
    expect(
      normalizeSwapQuoteSessionTransportErrorV2({
        type: 'error',
        message: 'Service unavailable',
        xhrState: 4,
        xhrStatus: 503,
        readyState: 2,
      }),
    ).toEqual({
      message: 'Service unavailable',
      xhrState: 4,
      xhrStatus: 503,
    });
  });

  it('normalizes the npm polyfill error and connection event shapes', () => {
    expect(
      normalizeSwapQuoteSessionTransportErrorV2({
        type: 'error',
        error: new Error('NetworkError'),
      }),
    ).toEqual({ message: 'NetworkError' });
    expect(
      normalizeSwapQuoteSessionTransportErrorV2({
        type: 'error',
        status: 401,
        statusText: 'Unauthorized',
      }),
    ).toEqual({ message: 'Unauthorized', xhrStatus: 401 });
  });

  it('keeps an error callback terminal even when the polyfill omits metadata', () => {
    expect(
      buildSwapQuoteSessionTransportErrorEventV2({
        type: 'error',
        target: {},
        readyState: 0,
      }),
    ).toEqual({
      kind: 'transportError',
      error: {},
    });
  });

  it('normalizes timeout and server-sent error message payloads', () => {
    expect(
      normalizeSwapQuoteSessionTransportErrorV2({ type: 'timeout' }),
    ).toEqual({
      message: 'Swap quote event timeout',
    });
    expect(
      normalizeSwapQuoteSessionTransportErrorV2({
        type: 'error',
        data: 'stream failed',
      }),
    ).toEqual({ message: 'stream failed' });
  });
});
