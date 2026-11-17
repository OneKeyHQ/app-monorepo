import { startViewTransition } from './utils';

const documentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'document',
);
const domExceptionDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'DOMException',
);

function mockTransition(ready: Promise<void>) {
  const readyCatch = jest.spyOn(ready, 'catch');
  const startTransition = jest.fn(() => ({ ready }));
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { startViewTransition: startTransition },
  });
  return { readyCatch, startTransition };
}

afterEach(() => {
  for (const [key, descriptor] of [
    ['document', documentDescriptor],
    ['DOMException', domExceptionDescriptor],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
  jest.restoreAllMocks();
});

describe('startViewTransition', () => {
  it('passes the update callback to the browser and observes ready', async () => {
    const { readyCatch, startTransition } = mockTransition(Promise.resolve());
    const update = jest.fn();

    startViewTransition(update);

    expect(startTransition).toHaveBeenCalledWith(update);
    expect(readyCatch).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    await expect(readyCatch.mock.results[0].value).resolves.toBeUndefined();
  });

  it.each(['AbortError', 'InvalidStateError'])(
    'ignores a DOMException named %s',
    async (name) => {
      const { readyCatch } = mockTransition(
        Promise.reject(new DOMException('Transition interrupted', name)),
      );

      startViewTransition(jest.fn());

      await expect(readyCatch.mock.results[0].value).resolves.toBeUndefined();
    },
  );

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string', 'Update failed'],
    ['plain object', { name: 'AbortError' }],
    ['Error', new Error('Update failed')],
    [
      'Error named AbortError',
      Object.assign(new Error('Update failed'), { name: 'AbortError' }),
    ],
    [
      'Error named InvalidStateError',
      Object.assign(new Error('Update failed'), { name: 'InvalidStateError' }),
    ],
    ['other DOMException', new DOMException('Update failed', 'OperationError')],
  ])('preserves the original %s rejection', async (_label, reason) => {
    const { readyCatch } = mockTransition(Promise.reject(reason));

    startViewTransition(jest.fn());

    await expect(readyCatch.mock.results[0].value).rejects.toBe(reason);
  });

  it('preserves rejections when DOMException is unavailable', async () => {
    const reason = new Error('Update failed');
    const { readyCatch } = mockTransition(Promise.reject(reason));
    Object.defineProperty(globalThis, 'DOMException', {
      configurable: true,
      value: undefined,
    });

    startViewTransition(jest.fn());

    await expect(readyCatch.mock.results[0].value).rejects.toBe(reason);
  });

  it.each([undefined, {}])(
    'runs the update directly without View Transition support (%p)',
    (documentValue) => {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: documentValue,
      });
      const update = jest.fn();

      startViewTransition(update);

      expect(update).toHaveBeenCalledTimes(1);
    },
  );
});
