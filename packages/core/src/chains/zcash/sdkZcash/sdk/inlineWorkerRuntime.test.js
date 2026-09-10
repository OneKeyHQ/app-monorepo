import createInlineWorker from './inlineWorkerRuntime';

describe('Zcash inline Worker origin lifetime', () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalWorker)
      Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  });

  it('keeps the Blob URL until termination and releases it once', () => {
    const terminate = jest.fn();
    class MockWorker {
      terminate = terminate;
    }
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: MockWorker,
    });
    const create = jest
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:test');
    const revoke = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const worker = createInlineWorker('postMessage(true)', 'Worker');
    expect(create.mock.calls[0][0].type).toBe('text/javascript');
    expect(revoke).not.toHaveBeenCalled();
    worker.terminate();
    worker.terminate();
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });

  it('releases the URL if construction fails', () => {
    const failed = new TypeError('Worker unavailable');
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: jest.fn(() => {
        throw failed;
      }),
    });
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    expect(() => createInlineWorker('', 'Worker')).toThrow(failed);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
