describe('Zcash desktop carrier reset', () => {
  const originalWorkerDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'Worker',
  );

  afterEach(() => {
    jest.resetModules();
    if (originalWorkerDescriptor) {
      Object.defineProperty(globalThis, 'Worker', originalWorkerDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'Worker');
    }
  });

  it('terminates a wedged worker without queueing reset behind it', async () => {
    let markCallStarted: (() => void) | undefined;
    const callStarted = new Promise<void>((resolve) => {
      markCallStarted = resolve;
    });

    class MockWorker {
      static instances: MockWorker[] = [];

      onmessage: ((event: MessageEvent) => void) | null = null;

      onerror: ((event: ErrorEvent) => void) | null = null;

      terminate = jest.fn();

      constructor() {
        MockWorker.instances.push(this);
      }

      postMessage(message: { id: number; method: string }) {
        if (message.method === 'ping') {
          queueMicrotask(() => {
            this.onmessage?.(
              new MessageEvent('message', {
                data: { id: message.id, ok: true, result: true },
              }),
            );
          });
        } else if (message.method === 'capabilities') {
          markCallStarted?.();
        }
      }
    }

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: MockWorker as unknown as typeof Worker,
    });

    const { default: sdk } = await import('./index.web');
    const api = await sdk.getZcashApi();
    const pendingCall = api.capabilities();
    await callStarted;

    await api.resetCarrier();

    await expect(pendingCall).rejects.toThrow('carrier reset');
    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0]?.terminate).toHaveBeenCalledTimes(1);
  });
});
