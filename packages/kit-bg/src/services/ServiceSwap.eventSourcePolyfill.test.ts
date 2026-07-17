import { isEventSourcePolyfillCleanEof } from './ServiceSwap';

describe('ServiceSwap EventSourcePolyfill EOF classification', () => {
  it.each([null, undefined])(
    'treats an explicitly %s polyfill error as clean EOF',
    (error) => {
      expect(
        isEventSourcePolyfillCleanEof({
          type: 'error',
          error,
        }),
      ).toBe(true);
    },
  );

  it.each([
    { type: 'error', error: new Error('NetworkError') },
    { type: 'error', error: 'NetworkError' },
    { type: 'error', error: null, status: 503 },
    { type: 'error', error: null, status: '503' },
    { type: 'error', error: undefined, xhrStatus: 401 },
    { type: 'timeout', error: null },
    { type: 'exception', error: null },
    { type: 'error', error: null, message: 'Service unavailable' },
    { type: 'error', error: null, data: { message: 'Service unavailable' } },
    { type: 'error', target: {} },
  ])('keeps a real transport failure terminal: %p', (event) => {
    expect(isEventSourcePolyfillCleanEof(event)).toBe(false);
  });
});
