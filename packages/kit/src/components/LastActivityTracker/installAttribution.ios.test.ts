const mockReadPending = jest.fn();
const mockClearPending = jest.fn(async () => {});
const mockPost = jest.fn();
const mockReportAttribution = jest.fn();

jest.mock('react-native', () => ({
  NativeModules: {
    AppClipAttribution: {
      clearPending: mockClearPending,
      readPending: mockReadPending,
    },
  },
}));

jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(async () => ({ post: mockPost })),
  },
}));

jest.mock('@onekeyhq/shared/src/config/endpointsMap', () => ({
  getEndpointByServiceName: jest.fn(async () => 'https://utility.onekeycn.com'),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      install: {
        reportAppClipInstallAttribution: mockReportAttribution,
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeMainThread: true,
  },
}));

const { reportInstallAttribution } = jest.requireActual<
  typeof import('./installAttribution.ios')
>('./installAttribution.ios');

const pendingRecord = {
  clickId: '0123456789ABCDEFGHIJKL',
  experience: 'market',
  lastAction: 'install_cta',
  route: '/clip/market',
  schemaVersion: 1,
  selectedAddress: '',
  selectedIsNative: true,
  selectedNetwork: 'btc--0',
  selectedSymbol: 'BTC',
};

describe('reportInstallAttribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadPending.mockResolvedValue(pendingRecord);
  });

  it('reports a first claim and clears the shared record', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          alreadyClaimed: false,
          attribution: { utmSource: 'app-clip' },
          found: true,
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        clickId: pendingRecord.clickId,
        selectedAddress: '',
        selectedIsNative: true,
        utmSource: 'app-clip',
      }),
    );
    expect(mockClearPending).toHaveBeenCalledTimes(1);
  });

  it('clears a repeated claim without reporting analytics again', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          alreadyClaimed: true,
          found: true,
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).not.toHaveBeenCalled();
    expect(mockClearPending).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent attribution consumption', async () => {
    let resolvePending: ((value: unknown) => void) | undefined;
    mockReadPending.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );

    const first = reportInstallAttribution();
    const second = reportInstallAttribution();
    expect(first).toBe(second);
    expect(mockReadPending).toHaveBeenCalledTimes(1);

    resolvePending?.(null);
    await Promise.all([first, second]);
  });
});
