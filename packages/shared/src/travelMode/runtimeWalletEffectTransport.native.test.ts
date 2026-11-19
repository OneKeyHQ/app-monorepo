const mockRunRuntimeWalletEffect = jest.fn();

jest.mock('./runtimeWalletEffect', () => ({
  runRuntimeWalletEffect: mockRunRuntimeWalletEffect,
}));

const { createRuntimeWalletEffectTransport } =
  require('./runtimeWalletEffectTransport.native') as typeof import('./runtimeWalletEffectTransport.native');

describe('createRuntimeWalletEffectTransport.native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the complete transport operation through the runtime effect capability', async () => {
    const delegate = {
      upload: jest.fn(async (value: string) => `uploaded:${value}`),
    };
    mockRunRuntimeWalletEffect.mockImplementation(
      async (operation: () => Promise<unknown>) => operation(),
    );

    const transport = createRuntimeWalletEffectTransport(delegate);

    await expect(transport.upload('payload')).resolves.toBe('uploaded:payload');
    expect(mockRunRuntimeWalletEffect).toHaveBeenCalledTimes(1);
    expect(delegate.upload).toHaveBeenCalledWith('payload');
  });

  it('does not invoke the transport when runtime effects are suppressed', async () => {
    const delegate = {
      delete: jest.fn(async () => undefined),
    };
    mockRunRuntimeWalletEffect.mockRejectedValue(new Error('Unknown error'));

    const transport = createRuntimeWalletEffectTransport(delegate);

    await expect(transport.delete()).rejects.toThrow('Unknown error');
    expect(delegate.delete).not.toHaveBeenCalled();
  });

  it('tracks fire-and-forget transport work independently of its caller', async () => {
    let finishUpload: (() => void) | undefined;
    const uploadPending = new Promise<void>((resolve) => {
      finishUpload = resolve;
    });
    const delegate = {
      upload: jest.fn(() => uploadPending),
    };
    const trackedOperations = new Set<Promise<unknown>>();
    mockRunRuntimeWalletEffect.mockImplementation(
      (operation: () => Promise<unknown>) => {
        const tracked = operation().finally(() =>
          trackedOperations.delete(tracked),
        );
        trackedOperations.add(tracked);
        return tracked;
      },
    );
    const transport = createRuntimeWalletEffectTransport(delegate);

    void transport.upload();

    expect(trackedOperations.size).toBe(1);
    finishUpload?.();
    await Promise.all(trackedOperations);
    expect(trackedOperations.size).toBe(0);
  });
});
