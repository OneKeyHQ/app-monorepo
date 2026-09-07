/* eslint-disable onekey/no-raw-error */

const mockCallNativeStorage = jest.fn();
const mockReportUnsupportedAsyncStorageApi = jest.fn();

jest.mock('../nativeStorageBridge', () => ({
  callNativeStorage: (request: unknown): Promise<unknown> =>
    mockCallNativeStorage(request) as Promise<unknown>,
}));

jest.mock('../nativeStorageContractViolation', () => ({
  reportUnsupportedAsyncStorageApi: (apiName: string): Error =>
    mockReportUnsupportedAsyncStorageApi(apiName) as Error,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('./nativeAsyncStorageInstance')
  .default as typeof import('./nativeAsyncStorageInstance').default;

describe('nativeAsyncStorageInstance', () => {
  beforeEach(() => {
    mockCallNativeStorage.mockReset();
    mockReportUnsupportedAsyncStorageApi.mockReset();
  });

  it('maps reads and writes to the native bg storage protocol', async () => {
    mockCallNativeStorage.mockResolvedValueOnce('value');
    const readCallback = jest.fn();

    await expect(storage.getItem('key', readCallback)).resolves.toBe('value');
    expect(readCallback).toHaveBeenCalledWith(null, 'value');
    expect(mockCallNativeStorage).toHaveBeenCalledWith({
      scope: 'asyncStorage',
      operation: 'getItem',
      key: 'key',
    });

    mockCallNativeStorage.mockResolvedValueOnce(undefined);
    await storage.multiSet([
      ['a', '1'],
      ['b', '2'],
    ]);
    expect(mockCallNativeStorage).toHaveBeenLastCalledWith({
      scope: 'asyncStorage',
      operation: 'multiSet',
      entries: [
        ['a', '1'],
        ['b', '2'],
      ],
    });
  });

  it('preserves AsyncStorage callback and promise error behavior', async () => {
    const error = new Error('bg unavailable');
    const callback = jest.fn();
    mockCallNativeStorage.mockRejectedValueOnce(error);

    await expect(storage.setItem('key', 'value', callback)).rejects.toBe(error);
    expect(callback).toHaveBeenCalledWith(error);
  });

  it('throws an explicit contract violation for an unsupported API', () => {
    const error = new Error('unsupported AsyncStorage API');
    mockReportUnsupportedAsyncStorageApi.mockReturnValue(error);

    expect(
      () => (storage as unknown as Record<string, unknown>).useAsyncStorage,
    ).toThrow(error);
    expect(mockReportUnsupportedAsyncStorageApi).toHaveBeenCalledWith(
      'useAsyncStorage',
    );
  });

  it('does not look promise-like', async () => {
    await expect(Promise.resolve(storage)).resolves.toBe(storage);
    expect(mockReportUnsupportedAsyncStorageApi).not.toHaveBeenCalled();
  });

  it('allows React element type metadata probes', () => {
    expect(
      (storage as unknown as Record<string, unknown>).$$typeof,
    ).toBeUndefined();
    expect(mockReportUnsupportedAsyncStorageApi).not.toHaveBeenCalled();
  });
});
