const mockReadPending = jest.fn();
const mockClearPending = jest.fn(async () => {});
const mockPost = jest.fn();
const mockGetClient = jest.fn(async () => ({ post: mockPost }));
const mockReportAttribution = jest.fn();
const mockWhenInitialized = jest.fn(async () => {});

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
    getClient: mockGetClient,
  },
}));

jest.mock('@onekeyhq/shared/src/analytics', () => ({
  analytics: {
    whenInitialized: mockWhenInitialized,
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

  it('reports the pending record for a repeated claim before clearing it', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          alreadyClaimed: true,
          found: true,
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        clickId: pendingRecord.clickId,
        lastAction: pendingRecord.lastAction,
      }),
    );
    expect(mockClearPending).toHaveBeenCalledTimes(1);
  });

  it('clears a terminal missing claim', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          found: false,
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).not.toHaveBeenCalled();
    expect(mockClearPending).toHaveBeenCalledTimes(1);
  });

  it('waits for analytics initialization before claiming', async () => {
    let resolveAnalytics: (() => void) | undefined;
    mockWhenInitialized.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveAnalytics = resolve;
        }),
    );
    mockPost.mockResolvedValue({
      data: {
        data: {
          found: false,
        },
      },
    });

    const report = reportInstallAttribution();
    await Promise.resolve();
    expect(mockGetClient).not.toHaveBeenCalled();

    resolveAnalytics?.();
    await report;
    expect(mockGetClient).toHaveBeenCalledTimes(1);
  });

  it('keeps the final local interaction over the server snapshot', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          appClip: {
            lastAction: 'viewed',
            selectedSymbol: 'ETH',
          },
          found: true,
          shortLink: {
            path: '/clip/market',
            version: 1,
          },
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        lastAction: pendingRecord.lastAction,
        selectedSymbol: pendingRecord.selectedSymbol,
        shortLinkPath: '/clip/market',
        shortLinkVersion: 1,
      }),
    );
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
