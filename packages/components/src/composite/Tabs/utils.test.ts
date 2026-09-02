/** @jest-environment jsdom */

import { startViewTransition } from './utils';

const originalQueueMicrotask = globalThis.queueMicrotask;

function mockQueueMicrotask() {
  const queueMicrotaskMock = jest.fn<void, [callback: () => void]>();
  Object.defineProperty(globalThis, 'queueMicrotask', {
    configurable: true,
    value: queueMicrotaskMock,
  });
  return queueMicrotaskMock;
}

function mockStartViewTransition(ready: Promise<void>) {
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: jest.fn((callback: () => void) => {
      callback();
      return { ready };
    }),
  });
}

describe('startViewTransition', () => {
  afterEach(() => {
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'queueMicrotask', {
      configurable: true,
      value: originalQueueMicrotask,
    });
    jest.restoreAllMocks();
  });

  it('consumes the browser skipped-transition rejection', async () => {
    const error = new Error('Transition was skipped');
    error.name = 'AbortError';
    const queueMicrotaskMock = mockQueueMicrotask();
    mockStartViewTransition(Promise.reject(error));
    const callback = jest.fn();

    startViewTransition(callback);
    await Promise.resolve();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(queueMicrotaskMock).not.toHaveBeenCalled();
  });

  it('consumes AbortError rejections regardless of engine-specific message', async () => {
    // Safari/Firefox reject skipped transitions with AbortError but different
    // message text than Chromium; only the error name is specified.
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    const queueMicrotaskMock = mockQueueMicrotask();
    mockStartViewTransition(Promise.reject(error));
    const callback = jest.fn();

    startViewTransition(callback);
    await Promise.resolve();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(queueMicrotaskMock).not.toHaveBeenCalled();
  });

  it('rethrows unexpected transition failures in a microtask', async () => {
    const error = new Error('Unexpected transition failure');
    const queueMicrotaskMock = mockQueueMicrotask();
    mockStartViewTransition(Promise.reject(error));

    startViewTransition(jest.fn());
    await Promise.resolve();

    const rethrow = queueMicrotaskMock.mock.calls[0]?.[0];
    expect(rethrow).toBeDefined();
    expect(() => rethrow?.()).toThrow(error);
  });

  it('runs synchronously when View Transitions are unavailable', () => {
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: undefined,
    });
    const callback = jest.fn();

    startViewTransition(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
