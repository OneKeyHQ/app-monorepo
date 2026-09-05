import type { AxiosAdapter, AxiosResponse } from 'axios';

const mockRunOrReject = jest.fn();

jest.mock('./runtimeWalletEffect', () => ({
  runRuntimeWalletEffect: mockRunOrReject,
}));

const { createRuntimeNetworkAdapter } =
  require('./runtimeNetworkAdapter.native') as typeof import('./runtimeNetworkAdapter.native');

describe('createRuntimeNetworkAdapter.native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the complete request through the runtime effect capability', async () => {
    const response = { data: 'ok', status: 200 } as AxiosResponse;
    const delegate = jest.fn<
      ReturnType<AxiosAdapter>,
      Parameters<AxiosAdapter>
    >(async () => response);
    mockRunOrReject.mockImplementation(
      async (operation: () => Promise<AxiosResponse>) => operation(),
    );

    const adapter = createRuntimeNetworkAdapter(delegate);
    const config = { url: '/test' } as Parameters<AxiosAdapter>[0];

    await expect(adapter(config)).resolves.toBe(response);
    expect(mockRunOrReject).toHaveBeenCalledTimes(1);
    expect(delegate).toHaveBeenCalledWith(config);
  });

  it('does not invoke the transport when runtime effects are suppressed', async () => {
    const delegate = jest.fn<
      ReturnType<AxiosAdapter>,
      Parameters<AxiosAdapter>
    >();
    mockRunOrReject.mockRejectedValue(new Error('Unknown error'));

    const adapter = createRuntimeNetworkAdapter(delegate);

    await expect(adapter({} as Parameters<AxiosAdapter>[0])).rejects.toThrow(
      'Unknown error',
    );
    expect(delegate).not.toHaveBeenCalled();
  });
});
