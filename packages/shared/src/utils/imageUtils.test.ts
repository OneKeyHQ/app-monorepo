const mockReadAsStringAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  copyAsync: mockCopyAsync,
  deleteAsync: mockDeleteAsync,
  downloadAsync: jest.fn(),
  getInfoAsync: mockGetInfoAsync,
  makeDirectoryAsync: mockMakeDirectoryAsync,
  readAsStringAsync: mockReadAsStringAsync,
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Image: {
    resolveAssetSource: jest.fn(() => ({
      uri: 'onekeyhq_shared_src_assets_hardware_homescreens_t1_blank',
    })),
  },
}));

jest.mock('../logger/logger', () => ({
  defaultLogger: {},
}));

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeAndroid: true,
  },
}));

describe('imageUtils Android bundled resources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInfoAsync.mockResolvedValue({ exists: false });
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockCopyAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
  });

  it('passes regular URIs directly to Expo FileSystem', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('file contents');

    const { readAsStringAsync } = await import('./imageUtils');
    const result = await readAsStringAsync('file:///cache/example.txt', {
      encoding: 'utf8',
    });

    expect(result).toBe('file contents');
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/example.txt',
      { encoding: 'utf8' },
    );
    expect(mockCopyAsync).not.toHaveBeenCalled();
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it('reads a require() asset through an Android drawable resource copy', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    mockReadAsStringAsync
      .mockRejectedValueOnce(new Error('Unsupported scheme'))
      .mockResolvedValueOnce(pngBase64);

    const { readAsStringAsync } = await import('./imageUtils');
    const result = await readAsStringAsync(1, { encoding: 'base64' });

    expect(result).toBe(pngBase64);
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: 'onekeyhq_shared_src_assets_hardware_homescreens_t1_blank',
      to: expect.stringMatching(
        /^file:\/\/\/cache\/react-native-image-crop-picker\/bundled-resource-1-\d+-\d+$/,
      ),
    });
    const copiedUri = mockCopyAsync.mock.calls[0]?.[0]?.to;
    expect(mockReadAsStringAsync).toHaveBeenNthCalledWith(2, copiedUri, {
      encoding: 'base64',
    });
    expect(mockDeleteAsync).toHaveBeenCalledWith(copiedUri, {
      idempotent: true,
    });
  });

  it('uses readAsStringAsync for required image Base64 conversion', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    mockReadAsStringAsync
      .mockRejectedValueOnce(new Error('Unsupported scheme'))
      .mockResolvedValueOnce(pngBase64);

    const imageUtils = (await import('./imageUtils')).default;
    const result = await imageUtils.getBase64FromRequiredImageSource(1);

    expect(result).toBe(`data:image/png;base64,${pngBase64}`);
  });
});
